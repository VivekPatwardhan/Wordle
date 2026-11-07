import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RealtimeService } from '../../../services/realtime-service';
import { StatusDot } from '../status-dot/status-dot';

/** "5 min ago"-style text for a past moment. */
export function formatLastSeen(lastSeenAt: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(lastSeenAt).getTime()) / 60_000);
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Online dot for another player, e.g. next to an opponent's name. Shows nothing
 * when the server doesn't let us see that player's status.
 */
@Component({
  selector: 'app-presence-dot',
  imports: [StatusDot],
  template: `
    @if (status(); as s) {
      <app-status-dot [state]="s.online ? 'online' : 'offline'" [label]="label()" />
    }
  `,
})
export class PresenceDot {
  private readonly realtime = inject(RealtimeService);

  readonly userId = input.required<number>();

  readonly status = computed(() => this.realtime.presence().get(this.userId()));

  readonly label = computed(() => {
    const status = this.status();
    if (!status) return '';
    if (status.online) return 'Online';
    return status.lastSeenAt ? formatLastSeen(status.lastSeenAt) : 'Offline';
  });

  constructor() {
    // Watch the player while this dot is on screen (and follow userId changes).
    effect((onCleanup) => {
      const id = this.userId();
      untracked(() => this.realtime.watch([id]));
      onCleanup(() => this.realtime.unwatch([id]));
    });
  }
}
