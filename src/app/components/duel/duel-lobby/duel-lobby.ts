import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';
import { DuelApi } from '../../../services/duel-api';
import { RealtimeService } from '../../../services/realtime-service';
import { AuthService } from '../../../services/auth-service';
import { apiErrorCode, apiErrorMessage } from '../../../services/api-error';
import { Duel, DuelGame } from '../../../models/duel';
import { formatExpiresIn, inviteLink } from '../duel-format';
import { DuelArena } from '../duel-arena/duel-arena';
import { RaceArena } from '../race-arena/race-arena';
import { VersusIntro } from '../versus-intro/versus-intro';
import { loadSeenIntros, rememberIntroSeen } from '../intro-memory';
import { PlayerCardService } from '../../../services/player-card-service';

/** Waiting room of one duel: share the invite, see who joined, live. */
@Component({
  selector: 'app-duel-lobby',
  imports: [Header, Footer, RouterLink, PresenceDot, DuelArena, RaceArena, VersusIntro],
  templateUrl: './duel-lobby.html',
  styleUrl: '../duel-page.css',
})
export class DuelLobby {
  private readonly duelApi = inject(DuelApi);
  private readonly realtime = inject(RealtimeService);
  private readonly authService = inject(AuthService);

  /** From the route /duel/:duelId. */
  readonly duelId = input.required<string>();

  readonly duel = signal<Duel | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly busy = signal(false);
  readonly copied = signal(false);
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  readonly formatExpiresIn = formatExpiresIn;

  readonly myId = computed(() => this.authService.currentUser()?.id ?? null);
  readonly me = computed(() => this.duel()?.players.find((p) => p.userId === this.myId()) ?? null);
  readonly opponent = computed(() => this.duel()?.players.find((p) => p.userId !== this.myId()) ?? null);
  readonly playerCard = inject(PlayerCardService);
  private readonly seenIntros = signal(loadSeenIntros());
  /**
   * "You VS Bob" plays once at the start of every duel — random, invite link
   * or direct challenge: round 1, word not set yet, intro not seen here before.
   */
  readonly showIntro = computed(() => {
    const duel = this.duel();
    const game = duel?.game;
    return !!duel && !!game
      && game.rounds.length === 0
      && game.current?.number === 1
      // A duel's round 1 begins with setting the word; a race's with its countdown.
      && (game.mode === 'race' || game.current.status === 'setting')
      && !this.seenIntros().has(duel.id);
  });
  /** Who sets round 1's word, for the intro. */
  readonly firstSetterName = computed(() => {
    const game = this.duel()?.game as DuelGame | null | undefined;
    const setterId = game?.rounds[0]?.setterId ?? game?.current?.setterId;
    if (setterId === this.myId()) return 'You';
    return this.duel()?.players.find((p) => p.userId === setterId)?.username ?? '';
  });

  readonly link = computed(() => {
    const invite = this.duel()?.invite;
    return invite?.isLink ? inviteLink(invite.token) : null;
  });

  constructor() {
    // Load whenever the route's duel id changes.
    toObservable(this.duelId).pipe(
      switchMap((id) => this.duelApi.getDuel(id).pipe(
        map(({ duel }) => ({ duel, error: null as unknown })),
        catchError((error: unknown) => of({ duel: null, error })),
      )),
      takeUntilDestroyed(),
    ).subscribe(({ duel, error }) => {
      this.duel.set(duel);
      this.loadError.set(error
        ? (apiErrorCode(error) === 'DUEL_NOT_FOUND'
          ? 'This duel does not exist, or you are not playing in it.'
          : 'Could not load the duel. Please try again.')
        : '');
    });

    // Every change (opponent joined, word set, a guess, round over…) arrives live.
    this.realtime.on<{ duel: Duel }>('duel:updated').pipe(
      filter(({ duel }) => duel.id === Number(this.duelId())),
      takeUntilDestroyed(),
    ).subscribe(({ duel }) => this.applyDuel(duel));
  }

  /**
   * Stores a newer view of the duel. A push and an HTTP response can arrive in
   * either order, so a view older than the one shown (lower version) is ignored.
   */
  applyDuel(duel: Duel): void {
    const shown = this.duel();
    const shownVersion = shown?.id === duel.id ? shown.game?.version ?? -1 : -1;
    if ((duel.game?.version ?? 0) < shownVersion) return;
    this.duel.set(duel);
  }

  introDone(): void {
    const duel = this.duel();
    if (duel) this.seenIntros.update((seen) => rememberIntroSeen(seen, duel.id));
  }

  async copyLink(): Promise<void> {
    const link = this.link();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.actionError.set('Could not copy automatically — select the link and copy it.');
    }
  }

  async share(): Promise<void> {
    const link = this.link();
    const duel = this.duel();
    if (!link || !duel) return;
    try {
      await navigator.share({
        title: 'Wordle PvP duel',
        text: `Join my ${duel.totalRounds}-round Wordle duel!`,
        url: link,
      });
    } catch {
      // The player closed the share sheet; nothing to do.
    }
  }

  cancel(): void {
    const duel = this.duel();
    if (!duel || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.duelApi.cancelDuel(duel.id).subscribe({
      next: ({ duel: updated }) => {
        this.busy.set(false);
        this.duel.set(updated);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(error, 'Could not cancel the duel.'));
      },
    });
  }
}
