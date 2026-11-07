import { Component, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, map, merge } from 'rxjs';
import { RealtimeService } from '../../../services/realtime-service';
import { IncomingInvite } from '../../../models/duel';
import { FriendRequestEvent } from '../../../models/friends';

const VISIBLE_MS = 12_000;

/** What the notice says: who, and what they want. */
interface Notice {
  from: string;
  text: string;
}

/** Pops up on any page when another player challenges you or sends a friend request. */
@Component({
  selector: 'app-invite-notice',
  template: `
    @if (invite(); as i) {
      <aside class="notice" role="status" aria-live="polite">
        <p><strong>{{ i.from }}</strong> {{ i.text }}</p>
        <div class="buttons">
          <button type="button" class="view" (click)="view()">View</button>
          <button type="button" class="close" (click)="dismiss()" aria-label="Dismiss">✕</button>
        </div>
      </aside>
    }
  `,
  styles: `
    .notice {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 72px);
      right: 16px;
      left: 16px;
      z-index: 950;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 380px;
      margin-left: auto;
      padding: 12px 14px;
      border-radius: 12px;
      background: #0f172a;
      color: #fff;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
      font-size: 0.88rem;
    }
    p { margin: 0; flex: 1; }
    .buttons { display: flex; gap: 6px; }
    button { border: none; border-radius: 8px; font-weight: 700; }
    .view { padding: 6px 12px; background: var(--color-indigo, #6366f1); color: #fff; }
    .close { padding: 6px 8px; background: transparent; color: #94a3b8; }
  `,
})
export class InviteNotice implements OnDestroy {
  private readonly router = inject(Router);
  private hideTimer?: ReturnType<typeof setTimeout>;

  readonly invite = signal<Notice | null>(null);

  constructor() {
    const realtime = inject(RealtimeService);
    // Messages missing the fields we need are ignored, never allowed to crash the page.
    merge(
      realtime.on<{ invite?: IncomingInvite }>('duel:invited').pipe(
        filter(({ invite }) => !!invite?.inviter?.username),
        map(({ invite }): Notice => ({
          from: invite!.inviter.username,
          text: invite!.mode === 'race'
            ? `challenged you to a best-of-${invite!.totalRounds} race.`
            : `challenged you to a ${invite!.totalRounds}-round duel.`,
        })),
      ),
      realtime.on<Partial<FriendRequestEvent>>('friend:request').pipe(
        filter(({ request }) => !!request?.from?.username),
        map(({ request }): Notice => ({
          from: request!.from.username,
          text: 'sent you a friend request.',
        })),
      ),
    )
      .pipe(takeUntilDestroyed())
      .subscribe((notice) => {
        this.invite.set(notice);
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.invite.set(null), VISIBLE_MS);
      });
  }

  view(): void {
    this.dismiss();
    this.router.navigate(['/duel']);
  }

  dismiss(): void {
    clearTimeout(this.hideTimer);
    this.invite.set(null);
  }

  ngOnDestroy(): void {
    clearTimeout(this.hideTimer);
  }
}
