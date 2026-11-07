import { computed, inject, Injectable, signal } from '@angular/core';
import { FriendsApi } from './friends-api';
import { RealtimeService } from './realtime-service';
import { FriendsOverview } from '../models/friends';

/** How the signed-in player relates to another player. */
export type Relationship = 'friend' | 'request-sent' | 'request-received' | 'none';

/**
 * The signed-in player's friends and requests, shared by every page that shows
 * them. Refreshes itself when the server says the list changed.
 */
@Injectable({
  providedIn: 'root',
})
export class FriendsService {
  private readonly api = inject(FriendsApi);

  readonly overview = signal<FriendsOverview | null>(null);
  readonly incomingCount = computed(() => this.overview()?.incoming.length ?? 0);

  constructor() {
    inject(RealtimeService).on('friends:updated').subscribe(() => this.load());
  }

  load(): void {
    this.api.getFriends().subscribe({
      next: (overview) => this.overview.set(overview),
      error: () => {
        // Keep showing the last known list; the next update retries.
      },
    });
  }

  relationshipWith(userId: number): Relationship {
    const overview = this.overview();
    if (!overview) return 'none';
    if (overview.friends.some((f) => f.userId === userId)) return 'friend';
    if (overview.outgoing.some((r) => r.to.userId === userId)) return 'request-sent';
    if (overview.incoming.some((r) => r.from.userId === userId)) return 'request-received';
    return 'none';
  }
}
