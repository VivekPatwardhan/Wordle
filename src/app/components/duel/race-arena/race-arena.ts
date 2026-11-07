import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter } from 'rxjs';
import { DuelApi } from '../../../services/duel-api';
import { RealtimeService } from '../../../services/realtime-service';
import { PlayerCardService } from '../../../services/player-card-service';
import { apiErrorCode, apiErrorMessage } from '../../../services/api-error';
import { Duel, DUEL_REACTIONS, DuelReaction, RaceGame, RaceRound, RoundCount } from '../../../models/duel';
import { DefinitionState } from '../../../models/game';
import { DuelBoard } from '../duel-board/duel-board';
import { DuelKeyboard } from '../duel-keyboard/duel-keyboard';
import { ColorGrid } from '../color-grid/color-grid';
import { ReactionLane, Floater } from '../reaction-lane/reaction-lane';
import { TimeLevel, TimeRing } from '../time-ring/time-ring';
import { WordDefinitionCard } from '../../shared/word-definition/word-definition';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const REACTION_LIMIT = 3;
const REACTION_WINDOW_MS = 3000;
const MAX_FLOATERS = 14;

const GUESS_ERRORS: Record<string, string> = {
  NOT_A_WORD: 'Not in word list',
  DUPLICATE_GUESS: 'You already tried that word',
  ROUND_TIME_UP: 'Time is up for this round',
  ROUND_NOT_STARTED: 'Wait for the countdown',
  OUT_OF_GUESSES: 'You have used all 6 guesses',
};

/**
 * A live race: both players solve the same word; you see your own board and
 * the opponent's progress as colours only. Rounds start together after a
 * countdown. The server is the source of truth — every change arrives as a
 * new `duel` from the lobby.
 */
@Component({
  selector: 'app-race-arena',
  imports: [DuelBoard, DuelKeyboard, ColorGrid, ReactionLane, TimeRing, WordDefinitionCard, PresenceDot],
  templateUrl: './race-arena.html',
  // Shares the duel arena's scoreboard, overlay and button styles.
  styleUrls: ['../duel-arena/duel-arena.css', './race-arena.css'],
})
export class RaceArena {
  private readonly duelApi = inject(DuelApi);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  readonly playerCard = inject(PlayerCardService);

  readonly duel = input.required<Duel>();
  readonly myId = input.required<number>();
  readonly duelChange = output<Duel>();

  readonly reactions = DUEL_REACTIONS;

  readonly game = computed(() => this.duel().game as RaceGame | null);
  readonly current = computed(() => this.game()?.current ?? null);
  readonly result = computed(() => this.game()?.result ?? null);
  readonly opponent = computed(() => this.duel().players.find((p) => p.userId !== this.myId()) ?? null);
  readonly myScore = computed(() => this.game()?.score.find((s) => s.userId === this.myId()) ?? null);
  readonly opponentScore = computed(() => this.game()?.score.find((s) => s.userId !== this.myId()) ?? null);

  readonly draft = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly confirmForfeit = signal<'round' | 'duel' | null>(null);
  readonly floaters = signal<Floater[]>([]);
  readonly reactionAnnouncement = signal('');
  readonly shownResult = signal<RaceRound | null>(null);
  readonly resultDefinition = signal<DefinitionState>({ status: 'loading' });

  // ---- clocks: the countdown to the start, then the 3-minute round ----
  private readonly now = signal(Date.now());
  private readonly startAt = signal<number | null>(null);
  private readonly deadline = signal<number | null>(null);

  readonly startsIn = computed(() => {
    const startAt = this.startAt();
    return startAt === null ? 0 : Math.max(0, Math.ceil((startAt - this.now()) / 1000));
  });
  private readonly remainingMs = computed(() => {
    const deadline = this.deadline();
    if (deadline === null) return null;
    // During the countdown the round clock hasn't started yet.
    const total = this.current()?.phaseMs ?? 0;
    return Math.min(total, Math.max(0, deadline - this.now()));
  });
  readonly secondsLeft = computed(() => {
    const ms = this.remainingMs();
    return ms === null ? null : Math.ceil(ms / 1000);
  });
  readonly timeFraction = computed(() => {
    const ms = this.remainingMs();
    const total = this.current()?.phaseMs;
    if (ms === null || !total || this.result()) return null;
    return Math.min(1, ms / total);
  });
  readonly timeLevel = computed<TimeLevel>(() => {
    const fraction = this.timeFraction() ?? 1;
    if (fraction > 0.5) return 'safe';
    if (fraction > 0.25) return 'caution';
    if (fraction > 0.1) return 'warning';
    return 'danger';
  });

  readonly outOfGuesses = computed(() => (this.current()?.myGuesses.length ?? 0) >= MAX_GUESSES);
  readonly canType = computed(() => !!this.current() && !this.result() && this.startsIn() === 0
    && !this.outOfGuesses() && !this.busy());

  private seenRounds = -1;
  private nextFloaterId = 1;
  private readonly floaterTimers = new Set<ReturnType<typeof setTimeout>>();
  private recentReactions: number[] = [];

  constructor() {
    const ticker = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(ticker);
      this.floaterTimers.forEach(clearTimeout);
    });

    // Each view restarts both clocks from the server's numbers (so player
    // clocks don't matter) and clears the typing row when the round changes.
    let roundKey = '';
    effect(() => {
      const current = this.current();
      untracked(() => {
        const receivedAt = Date.now();
        this.now.set(receivedAt);
        this.startAt.set(current ? receivedAt + current.msUntilStart : null);
        this.deadline.set(current?.msLeft === null || current?.msLeft === undefined ? null : receivedAt + current.msLeft);
        const key = current ? `${current.number}` : '';
        if (key !== roundKey) {
          roundKey = key;
          this.draft.set('');
          this.message.set('');
          this.confirmForfeit.set(null);
        }
      });
    });

    // A newly finished round pops up its result (not on first load).
    effect(() => {
      const finished = this.game()?.rounds ?? [];
      untracked(() => {
        if (this.seenRounds >= 0 && finished.length > this.seenRounds) {
          this.showRoundResult(finished[finished.length - 1]);
        }
        this.seenRounds = finished.length;
      });
    });

    this.realtime.on<DuelReaction>('duel:reaction').pipe(
      filter((r) => r.duelId === this.duel().id),
      takeUntilDestroyed(),
    ).subscribe((r) => {
      this.addFloater(r.emoji, false);
      this.reactionAnnouncement.set(`${this.opponent()?.username ?? 'Opponent'} reacted ${r.emoji}`);
    });
  }

  // ---------- typing ----------

  @HostListener('window:keydown', ['$event'])
  onPhysicalKey(event: KeyboardEvent): void {
    if (!this.canType() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter') this.press('ENTER');
    else if (event.key === 'Backspace') this.press('BACKSPACE');
    else if (/^[a-zA-Z]$/.test(event.key)) this.press(event.key.toUpperCase());
  }

  press(key: string): void {
    if (!this.canType()) return;
    if (key === 'ENTER') {
      this.submitGuess();
      return;
    }
    const next = key === 'BACKSPACE'
      ? this.draft().slice(0, -1)
      : (this.draft() + key.toLowerCase()).slice(0, WORD_LENGTH);
    this.draft.set(next);
    this.message.set('');
  }

  private submitGuess(): void {
    const word = this.draft();
    if (word.length !== WORD_LENGTH) {
      this.message.set('Not enough letters');
      return;
    }
    this.busy.set(true);
    this.duelApi.submitGuess(this.duel().id, word).subscribe({
      next: ({ duel }) => {
        this.busy.set(false);
        this.draft.set('');
        this.duelChange.emit(duel);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const code = apiErrorCode(error);
        this.message.set((code && GUESS_ERRORS[code]) ?? apiErrorMessage(error, 'Could not submit your guess.'));
      },
    });
  }

  // ---------- reactions ----------

  react(emoji: string): void {
    const now = Date.now();
    this.recentReactions = this.recentReactions.filter((at) => now - at < REACTION_WINDOW_MS);
    if (this.recentReactions.length >= REACTION_LIMIT) return;
    this.recentReactions.push(now);
    this.realtime.send('duel:reaction', { duelId: this.duel().id, emoji });
    this.addFloater(emoji, true);
  }

  private addFloater(emoji: string, mine: boolean): void {
    const floater: Floater = {
      id: this.nextFloaterId++,
      emoji,
      mine,
      drift: Math.round((Math.random() - 0.5) * 36),
      tilt: Math.round((Math.random() - 0.5) * 40),
      durationMs: (mine ? 2200 : 2800) + Math.round(Math.random() * 600),
    };
    this.floaters.update((list) => [...list, floater].slice(-MAX_FLOATERS));
    const timer = setTimeout(() => {
      this.floaterTimers.delete(timer);
      this.floaters.update((list) => list.filter((f) => f.id !== floater.id));
    }, floater.durationMs);
    this.floaterTimers.add(timer);
  }

  // ---------- forfeits ----------

  forfeit(scope: 'round' | 'duel'): void {
    if (this.confirmForfeit() !== scope) {
      this.confirmForfeit.set(scope);
      return;
    }
    this.confirmForfeit.set(null);
    this.busy.set(true);
    this.duelApi.forfeit(this.duel().id, scope).subscribe({
      next: ({ duel }) => {
        this.busy.set(false);
        this.duelChange.emit(duel);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(apiErrorMessage(error, 'Could not forfeit. Please try again.'));
      },
    });
  }

  // ---------- results ----------

  private showRoundResult(round: RaceRound): void {
    this.shownResult.set(round);
    this.resultDefinition.set({ status: 'loading' });
    this.duelApi.getRoundDefinition(this.duel().id, round.number).subscribe({
      next: ({ definition }) => this.resultDefinition.set({ status: 'ready', definition }),
      error: () => this.resultDefinition.set({ status: 'unavailable' }),
    });
  }

  dismissResult(): void {
    this.shownResult.set(null);
  }

  roundHeadline(round: RaceRound): string {
    const opponent = this.opponent()?.username ?? 'Your opponent';
    if (round.status === 'draw') return 'Nobody solved it — this round is a draw.';
    const iWon = round.winnerId === this.myId();
    if (round.status === 'forfeited') return iWon ? `${opponent} forfeited the round.` : 'You forfeited the round.';
    return iWon
      ? `You solved it first in ${round.myGuesses.length}! 🏁`
      : `${opponent} solved it first in ${round.opponentGuesses.length}.`;
  }

  readonly finalHeadline = computed(() => {
    const result = this.result();
    if (!result) return '';
    if (result.winnerId === null) return "It's a draw!";
    return result.winnerId === this.myId() ? 'You won the race! 🏆' : `${this.opponent()?.username} won the race.`;
  });

  readonly finalReason = computed(() => {
    switch (this.result()?.reason) {
      case 'forfeit': return 'The race was forfeited.';
      case 'draw': return 'Equal rounds won.';
      default: return 'Most rounds won.';
    }
  });

  roundWinnerLabel(round: RaceRound): string {
    if (round.winnerId === null) return 'Draw';
    return round.winnerId === this.myId() ? 'You' : this.opponent()?.username ?? '';
  }

  rematch(): void {
    const opponent = this.opponent();
    if (!opponent || this.busy()) return;
    this.busy.set(true);
    this.duelApi.createDuel({
      mode: 'race',
      totalRounds: this.duel().totalRounds as RoundCount,
      opponentId: opponent.userId,
    }).subscribe({
      next: ({ duel }) => {
        this.busy.set(false);
        this.router.navigate(['/duel', duel.id]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(apiErrorMessage(error, 'Could not start a rematch.'));
      },
    });
  }

  formatClock(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
