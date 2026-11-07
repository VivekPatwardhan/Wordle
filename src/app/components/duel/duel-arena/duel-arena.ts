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
import {
  Duel,
  DuelGame,
  DUEL_REACTIONS,
  DuelDraft,
  DuelReaction,
  DuelRound,
  RoundCount,
} from '../../../models/duel';
import { DefinitionState } from '../../../models/game';
import { DuelBoard } from '../duel-board/duel-board';
import { DuelKeyboard } from '../duel-keyboard/duel-keyboard';
import { WordDefinitionCard } from '../../shared/word-definition/word-definition';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';
import { Floater, ReactionLane } from '../reaction-lane/reaction-lane';
import { TimeLevel, TimeRing } from '../time-ring/time-ring';

const WORD_LENGTH = 5;
const REACTION_ANNOUNCE_MS = 3000;
/** Matches the server's limit (3 reactions per 3 s), so you never see one the opponent didn't get. */
const REACTION_LIMIT = 3;
const REACTION_WINDOW_MS = 3000;
const MAX_FLOATERS = 14;

/** Friendlier wording for refusals that happen while typing. */
const GUESS_ERRORS: Record<string, string> = {
  NOT_A_WORD: 'Not in word list',
  DUPLICATE_GUESS: 'You already tried that word',
  ROUND_TIME_UP: 'Time is up for this round',
};

/**
 * The live duel: score, clock, setting the word, guessing (or watching the
 * guesser type), reactions, round results with definitions, forfeits and the
 * final result. The server is the source of truth — every change arrives as
 * a new `duel` from the lobby (HTTP responses and `duel:updated` pushes).
 */
@Component({
  selector: 'app-duel-arena',
  imports: [DuelBoard, DuelKeyboard, WordDefinitionCard, PresenceDot, ReactionLane, TimeRing],
  templateUrl: './duel-arena.html',
  styleUrl: './duel-arena.css',
})
export class DuelArena {
  private readonly duelApi = inject(DuelApi);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  readonly playerCard = inject(PlayerCardService);

  readonly duel = input.required<Duel>();
  readonly myId = input.required<number>();
  /** Fresh state from an HTTP response, for the lobby to store. */
  readonly duelChange = output<Duel>();

  readonly reactions = DUEL_REACTIONS;

  // ---- derived from the server state ----
  // The lobby only hands duels (not races) to this arena.
  readonly game = computed(() => this.duel().game as DuelGame | null);
  readonly current = computed(() => this.game()?.current ?? null);
  readonly opponent = computed(() => this.duel().players.find((p) => p.userId !== this.myId()) ?? null);
  readonly isSetter = computed(() => this.current()?.setterId === this.myId());
  readonly isGuesser = computed(() => this.current()?.guesserId === this.myId());
  readonly phase = computed(() => this.current()?.status ?? null);
  readonly myScore = computed(() => this.game()?.score.find((s) => s.userId === this.myId()) ?? null);
  readonly opponentScore = computed(() => this.game()?.score.find((s) => s.userId !== this.myId()) ?? null);
  readonly result = computed(() => this.game()?.result ?? null);

  // ---- local UI state ----
  readonly draft = signal('');
  readonly watchedDraft = signal('');
  readonly wordInput = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly confirmForfeit = signal<'round' | 'duel' | null>(null);
  readonly floaters = signal<Floater[]>([]);
  /** Screen-reader text for the latest incoming reaction. */
  readonly reactionAnnouncement = signal('');

  /** The round result shown after a round ends (until dismissed). */
  readonly shownResult = signal<DuelRound | null>(null);
  readonly resultDefinition = signal<DefinitionState>({ status: 'loading' });
  readonly reportState = signal<'idle' | 'sent'>('idle');
  readonly blockState = signal<'idle' | 'confirm' | 'done'>('idle');

  // ---- the clock ----
  private readonly now = signal(Date.now());
  private readonly deadline = signal<number | null>(null);
  private readonly remainingMs = computed(() => {
    const deadline = this.deadline();
    return deadline === null ? null : Math.max(0, deadline - this.now());
  });
  readonly secondsLeft = computed(() => {
    const ms = this.remainingMs();
    return ms === null ? null : Math.ceil(ms / 1000);
  });
  /** Share of the phase left, 1 → 0, drawn as the shrinking ring. */
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

  private seenRounds = -1;
  private nextFloaterId = 1;
  private readonly floaterTimers = new Set<ReturnType<typeof setTimeout>>();
  private announceTimer?: ReturnType<typeof setTimeout>;
  private recentReactions: number[] = [];

  constructor() {
    const ticker = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(ticker);
      clearTimeout(this.announceTimer);
      this.floaterTimers.forEach(clearTimeout);
    });

    // Each new view restarts the clock from the server's msLeft, and resets
    // the typing row when the round or the guess count changes.
    let roundKey = '';
    effect(() => {
      const current = this.current();
      const msLeft = current?.msLeft;
      untracked(() => {
        const receivedAt = Date.now();
        this.now.set(receivedAt);
        this.deadline.set(msLeft === null || msLeft === undefined ? null : receivedAt + msLeft);
        const key = current ? `${current.number}:${current.status}:${current.guesses.length}` : '';
        if (key !== roundKey) {
          roundKey = key;
          this.draft.set('');
          this.watchedDraft.set('');
          this.wordInput.set('');
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

    this.realtime.on<DuelDraft>('duel:draft').pipe(
      filter((d) => d.duelId === this.duel().id && d.roundNumber === this.current()?.number),
      takeUntilDestroyed(),
    ).subscribe((d) => this.watchedDraft.set(d.letters));

    this.realtime.on<DuelReaction>('duel:reaction').pipe(
      filter((r) => r.duelId === this.duel().id),
      takeUntilDestroyed(),
    ).subscribe((r) => {
      this.addFloater(r.emoji, false);
      this.reactionAnnouncement.set(`${this.opponent()?.username ?? 'Opponent'} reacted ${r.emoji}`);
      clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => this.reactionAnnouncement.set(''), REACTION_ANNOUNCE_MS);
    });
  }

  // ---------- setting the word ----------

  onWordInput(value: string): void {
    this.wordInput.set(value.replace(/[^a-zA-Z]/g, '').slice(0, WORD_LENGTH).toLowerCase());
    this.message.set('');
  }

  submitWord(): void {
    const word = this.wordInput();
    if (word.length !== WORD_LENGTH || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    this.duelApi.setWord(this.duel().id, word).subscribe({
      next: ({ duel }) => {
        this.busy.set(false);
        this.duelChange.emit(duel);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(apiErrorMessage(error, 'Could not set the word. Please try again.'));
      },
    });
  }

  // ---------- guessing ----------

  readonly canType = computed(() => this.phase() === 'guessing' && this.isGuesser() && !this.busy());

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
    if (next === this.draft()) return;
    this.draft.set(next);
    this.message.set('');
    // The setter watches every key tap live.
    this.realtime.send('duel:draft', { duelId: this.duel().id, letters: next });
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

  /** Launches an emoji bubble up the reaction lane; it removes itself when done. */
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

  // ---------- round results ----------

  private showRoundResult(round: DuelRound): void {
    this.shownResult.set(round);
    this.reportState.set('idle');
    this.blockState.set('idle');
    this.resultDefinition.set({ status: 'loading' });
    if (!round.secretWord) return; // no word was set, so nothing to define
    this.duelApi.getRoundDefinition(this.duel().id, round.number).subscribe({
      next: ({ definition }) => this.resultDefinition.set({ status: 'ready', definition }),
      error: () => this.resultDefinition.set({ status: 'unavailable' }),
    });
  }

  dismissResult(): void {
    this.shownResult.set(null);
  }

  /** Text for a finished round, from this player's point of view. */
  roundHeadline(round: DuelRound): string {
    const iWon = round.winnerId === this.myId();
    const iGuessed = round.guesserId === this.myId();
    const tries = round.guesses.length;
    switch (round.status) {
      case 'solved':
        return iGuessed ? `You solved it in ${tries}!` : `${this.opponent()?.username} solved it in ${tries}.`;
      case 'failed':
        return iGuessed ? 'Out of guesses — round to your opponent.' : 'Your word survived all 6 guesses!';
      case 'timed_out':
        if (!round.secretWord) {
          // The setter never chose a word.
          return iGuessed
            ? `${this.opponent()?.username} didn't set a word in time — round to you.`
            : "You didn't set a word in time — round to your opponent.";
        }
        return iWon ? 'Your opponent ran out of time.' : 'Time ran out — round to your opponent.';
      case 'forfeited':
        return iWon ? 'Your opponent forfeited the round.' : 'You forfeited the round.';
      default:
        return '';
    }
  }

  report(): void {
    const round = this.shownResult();
    if (!round || this.reportState() === 'sent') return;
    this.duelApi.reportWord(this.duel().id, round.number).subscribe({
      next: () => this.reportState.set('sent'),
      error: (error: unknown) => this.message.set(apiErrorMessage(error, 'Could not send the report.')),
    });
  }

  block(): void {
    if (this.blockState() === 'idle') {
      this.blockState.set('confirm');
      return;
    }
    this.duelApi.blockOpponent(this.duel().id).subscribe({
      next: () => this.blockState.set('done'),
      error: (error: unknown) => this.message.set(apiErrorMessage(error, 'Could not block the player.')),
    });
  }

  // ---------- the end ----------

  readonly finalHeadline = computed(() => {
    const result = this.result();
    if (!result) return '';
    if (result.winnerId === null) return "It's a draw!";
    return result.winnerId === this.myId() ? 'You won the duel! 🏆' : `${this.opponent()?.username} won the duel.`;
  });

  readonly finalReason = computed(() => {
    switch (this.result()?.reason) {
      case 'forfeit':
        return 'The duel was forfeited.';
      case 'tiebreak':
        return 'Equal rounds — decided by fewer guesses used.';
      case 'draw':
        return 'Same rounds won and same guesses used.';
      default:
        return 'Most rounds won.';
    }
  });

  rematch(): void {
    const opponent = this.opponent();
    if (!opponent || this.busy()) return;
    this.busy.set(true);
    this.duelApi.createDuel({
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

  usernameOf(userId: number): string {
    return this.duel().players.find((p) => p.userId === userId)?.username ?? '';
  }

  formatClock(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
