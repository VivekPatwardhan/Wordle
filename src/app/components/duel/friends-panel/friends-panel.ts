import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FriendsApi } from '../../../services/friends-api';
import { FriendsService } from '../../../services/friends-service';
import { apiErrorMessage } from '../../../services/api-error';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';
import { PlayerCardService } from '../../../services/player-card-service';

/**
 * Friends card on the PvP page: add by exact username, answer requests, and
 * challenge or remove friends (each with an online dot).
 */
@Component({
  selector: 'app-friends-panel',
  imports: [PresenceDot],
  templateUrl: './friends-panel.html',
  styleUrls: ['../duel-page.css'],
  styles: `
    .add-form { display: flex; gap: 8px; margin-top: 10px; }
    .add-form input {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid var(--border-light, #e2e8f0);
      border-radius: 8px;
      font: inherit;
    }
    .status { margin: 8px 0 0; font-size: 0.82rem; }
    .status.ok { color: #059669; font-weight: 600; }
    .sub { margin: 14px 0 0; font-size: 0.78rem; font-weight: 800; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.06em; }
    .link { border: none; background: none; padding: 4px; color: var(--text-muted, #64748b); font-size: 0.78rem; text-decoration: underline; }
    .link.danger { color: #dc2626; }
  `,
})
export class FriendsPanel implements OnInit {
  private readonly api = inject(FriendsApi);
  readonly friends = inject(FriendsService);

  /** Mode and rounds chosen on the PvP page, used for Challenge. */
  readonly rounds = input.required<number>();
  readonly mode = input<'duel' | 'race'>('duel');
  readonly challenge = output<number>();
  readonly playerCard = inject(PlayerCardService);

  readonly username = signal('');
  readonly message = signal<{ text: string; ok: boolean } | null>(null);
  readonly busy = signal(false);
  readonly confirmRemove = signal<number | null>(null);

  ngOnInit(): void {
    this.friends.load();
  }

  addByUsername(): void {
    const username = this.username().trim();
    if (!username) return;
    this.run(this.api.sendRequest({ username }), ({ status, friend }) => {
      this.username.set('');
      this.message.set({
        ok: true,
        text: status === 'accepted'
          ? `You and ${friend.username} are now friends!`
          : `Friend request sent to ${friend.username}.`,
      });
    });
  }

  accept(requestId: number): void {
    this.run(this.api.acceptRequest(requestId), () => this.message.set(null));
  }

  removeRequest(requestId: number): void {
    this.run(this.api.removeRequest(requestId), () => this.message.set(null));
  }

  /** Two taps: the first asks for confirmation. */
  remove(userId: number): void {
    if (this.confirmRemove() !== userId) {
      this.confirmRemove.set(userId);
      return;
    }
    this.confirmRemove.set(null);
    this.run(this.api.removeFriend(userId), () => this.message.set(null));
  }

  /** Every change reloads the shared list (the server also pushes friends:updated). */
  private run<T>(request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        onSuccess(result);
        this.friends.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set({ ok: false, text: apiErrorMessage(error, 'Something went wrong. Please try again.') });
      },
    });
  }
}
