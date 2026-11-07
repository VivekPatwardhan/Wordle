import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PlayerCardService } from '../../../services/player-card-service';
import { PlayersApi } from '../../../services/players-api';
import { DuelApi } from '../../../services/duel-api';
import { FriendsApi } from '../../../services/friends-api';
import { FriendsService } from '../../../services/friends-service';
import { AuthService } from '../../../services/auth-service';
import { apiErrorMessage } from '../../../services/api-error';
import { PlayerCard as PlayerCardData } from '../../../models/player-card';
import { PresenceDot } from '../presence-dot/presence-dot';

/**
 * Another player's card: records (solo / duel / race), your head-to-head,
 * their achievements, and quick Challenge / + Friend actions. Opened from any
 * player name via PlayerCardService; only friends and opponents can see it.
 */
@Component({
  selector: 'app-player-card',
  imports: [DatePipe, PresenceDot],
  templateUrl: './player-card.html',
  styleUrl: './player-card.css',
})
export class PlayerCard {
  readonly service = inject(PlayerCardService);
  private readonly playersApi = inject(PlayersApi);
  private readonly duelApi = inject(DuelApi);
  private readonly friendsApi = inject(FriendsApi);
  private readonly friends = inject(FriendsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly card = signal<PlayerCardData | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);

  readonly isSelf = computed(() => this.card()?.userId === this.authService.currentUser()?.id);
  readonly relationship = computed(() => {
    const card = this.card();
    return card ? this.friends.relationshipWith(card.userId) : 'none';
  });

  constructor() {
    effect(() => {
      const userId = this.service.openUserId();
      untracked(() => {
        this.card.set(null);
        this.error.set('');
        this.message.set('');
        if (userId === null) return;
        this.friends.load();
        this.playersApi.getCard(userId).subscribe({
          next: ({ card }) => {
            if (this.service.openUserId() === userId) this.card.set(card);
          },
          error: (error: unknown) => this.error.set(apiErrorMessage(error, 'Could not load this player.')),
        });
      });
    });
  }

  close(): void {
    this.service.close();
  }

  challenge(mode: 'duel' | 'race'): void {
    const card = this.card();
    if (!card || this.busy()) return;
    this.busy.set(true);
    this.duelApi.createDuel({ mode, totalRounds: mode === 'race' ? 3 : 4, opponentId: card.userId }).subscribe({
      next: ({ duel }) => {
        this.busy.set(false);
        this.close();
        this.router.navigate(['/duel', duel.id]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(apiErrorMessage(error, 'Could not send the challenge.'));
      },
    });
  }

  addFriend(): void {
    const card = this.card();
    if (!card || this.busy()) return;
    this.busy.set(true);
    this.friendsApi.sendRequest({ userId: card.userId }).subscribe({
      next: ({ status }) => {
        this.busy.set(false);
        this.message.set(status === 'accepted' ? 'You are now friends!' : 'Friend request sent.');
        this.friends.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(apiErrorMessage(error, 'Could not send the request.'));
      },
    });
  }
}
