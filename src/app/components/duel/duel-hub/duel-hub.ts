import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { MatchmakingService } from '../../../services/matchmaking-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { merge, Observable } from 'rxjs';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';
import { DuelApi } from '../../../services/duel-api';
import { RealtimeService } from '../../../services/realtime-service';
import { apiErrorMessage } from '../../../services/api-error';
import { DuelHub as DuelHubData, IncomingInvite, PreviousOpponent, PvpMode, ROUND_OPTIONS_BY_MODE, RoundCount } from '../../../models/duel';
import { formatExpiresIn } from '../duel-format';
import { FriendsPanel } from '../friends-panel/friends-panel';
import { FriendsService } from '../../../services/friends-service';
import { FriendsApi } from '../../../services/friends-api';
import { PlayerCardService } from '../../../services/player-card-service';

/** The PvP page: start a duel, answer invites, re-challenge previous opponents. */
@Component({
  selector: 'app-duel-hub',
  imports: [Header, Footer, RouterLink, PresenceDot, FriendsPanel],
  templateUrl: './duel-hub.html',
  styleUrl: '../duel-page.css',
})
export class DuelHub implements OnInit {
  private readonly duelApi = inject(DuelApi);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);

  readonly mode = signal<PvpMode>('duel');
  readonly roundOptions = computed(() => ROUND_OPTIONS_BY_MODE[this.mode()]);
  readonly rounds = signal<RoundCount>(4);
  /** Short label for a game, e.g. '4-round duel' or 'Best-of-3 race'. */
  readonly modeLabel = (mode: PvpMode, rounds: number) =>
    mode === 'race' ? `Best-of-${rounds} race` : `${rounds}-round duel`;

  /** Switching mode picks a sensible default round count for it. */
  selectMode(mode: PvpMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    this.rounds.set(mode === 'race' ? 3 : 4);
  }
  readonly hub = signal<DuelHubData | null>(null);
  readonly isLoading = signal(true);
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly formatExpiresIn = formatExpiresIn;
  readonly matchmaking = inject(MatchmakingService);
  readonly friends = inject(FriendsService);
  readonly playerCard = inject(PlayerCardService);
  private readonly friendsApi = inject(FriendsApi);

  private readonly now = signal(Date.now());
  /** "0:12" since the random search started. */
  readonly elapsedLabel = computed(() => {
    const state = this.matchmaking.state();
    if (state.status !== 'searching') return '';
    const seconds = Math.max(0, Math.floor((this.now() - state.startedAt) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  constructor() {
    // Tick the "searching for 0:12" label only while a search is running.
    effect((onCleanup) => {
      if (this.matchmaking.state().status !== 'searching') return;
      this.now.set(Date.now());
      const ticker = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(ticker));
    });

    // Invites arriving or being answered elsewhere refresh the lists.
    merge(this.realtime.on('duel:invited'), this.realtime.on('duel:updated'))
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.duelApi.getHub().subscribe({
      next: (hub) => {
        this.hub.set(hub);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(apiErrorMessage(error, 'Could not load your duels. Please try again.'));
        this.isLoading.set(false);
      },
    });
  }

  /** Creates a shareable invite link and opens its lobby. */
  createInviteLink(): void {
    this.startDuel({ mode: this.mode(), totalRounds: this.rounds() });
  }

  /** Joins the random queue for the chosen number of rounds. */
  findRandomOpponent(): void {
    this.errorMessage.set('');
    this.matchmaking.search(this.rounds(), this.mode());
  }

  /** Sends a direct invite to someone you have played before. */
  challenge(opponent: PreviousOpponent): void {
    this.challengeUser(opponent.userId);
  }

  /** Direct invite to a friend or previous opponent. */
  challengeUser(userId: number): void {
    this.startDuel({ mode: this.mode(), totalRounds: this.rounds(), opponentId: userId });
  }

  /** "+ Friend" on a previous opponent. */
  addFriend(userId: number): void {
    this.run(this.friendsApi.sendRequest({ userId }), () => this.friends.load());
  }

  accept(invite: IncomingInvite): void {
    this.run(this.duelApi.acceptInvite(invite.token), ({ duel }) => {
      this.router.navigate(['/duel', duel.id]);
    });
  }

  decline(invite: IncomingInvite): void {
    this.run(this.duelApi.declineInvite(invite.token), () => this.load());
  }

  cancel(duelId: number): void {
    this.run(this.duelApi.cancelDuel(duelId), () => this.load());
  }

  private startDuel(request: { mode: PvpMode; totalRounds: RoundCount; opponentId?: number }): void {
    this.run(this.duelApi.createDuel(request), ({ duel }) => {
      this.router.navigate(['/duel', duel.id]);
    });
  }

  /** One action at a time; errors from the API are shown above the lists. */
  private run<T>(request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        onSuccess(result);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(apiErrorMessage(error, 'Something went wrong. Please try again.'));
      },
    });
  }
}
