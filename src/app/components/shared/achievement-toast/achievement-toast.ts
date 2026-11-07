import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { RealtimeService } from '../../../services/realtime-service';
import { Achievement, AchievementUnlockedEvent } from '../../../models/achievements';

const VISIBLE_MS = 5000;

/**
 * "Achievement unlocked!" — slides in on any page when a finished game or duel
 * unlocks something. Several unlocks are shown one after another.
 */
@Component({
  selector: 'app-achievement-toast',
  template: `
    @if (current(); as a) {
      <button type="button" class="toast" (click)="open()" aria-live="polite">
        <span class="icon" aria-hidden="true">{{ a.icon }}</span>
        <span class="text">
          <span class="label">Achievement unlocked!</span>
          <strong>{{ a.title }}</strong>
          <span class="desc">{{ a.description }}</span>
        </span>
      </button>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
      z-index: 960;
      display: flex;
      align-items: center;
      gap: 12px;
      width: min(360px, calc(100vw - 32px));
      padding: 12px 16px;
      border: 2px solid #fcd34d;
      border-radius: 16px;
      background: linear-gradient(135deg, #1e1b4b, #312e81);
      color: #fff;
      text-align: left;
      box-shadow: 0 0 30px rgba(252, 211, 77, 0.45), 0 12px 30px rgba(15, 23, 42, 0.4);
      animation: toast-in 0.6s cubic-bezier(0.2, 1.5, 0.4, 1) both, glow 1.6s ease-in-out 0.6s infinite alternate;
    }
    .icon { font-size: 2.3rem; animation: spin-in 0.7s ease-out 0.2s both; }
    .text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .label { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #fcd34d; }
    strong { font-size: 1rem; }
    .desc { font-size: 0.78rem; opacity: 0.8; }
    @keyframes toast-in { from { transform: translate(-50%, 140%) scale(0.8); opacity: 0; } to { transform: translate(-50%, 0); } }
    @keyframes spin-in { from { transform: rotate(-200deg) scale(0); } }
    @keyframes glow { to { box-shadow: 0 0 45px rgba(252, 211, 77, 0.75), 0 12px 30px rgba(15, 23, 42, 0.4); } }
    @media (prefers-reduced-motion: reduce) {
      .toast, .icon { animation: none; transform: translateX(-50%); }
      .icon { transform: none; }
    }
  `,
})
export class AchievementToast {
  private readonly router = inject(Router);
  private readonly queue: Achievement[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  readonly current = signal<Achievement | null>(null);

  constructor() {
    inject(RealtimeService).on<AchievementUnlockedEvent>('achievement:unlocked')
      .pipe(takeUntilDestroyed())
      .subscribe(({ achievements }) => {
        this.queue.push(...achievements);
        if (!this.current()) this.showNext();
      });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Tapping the toast opens the profile. */
  open(): void {
    this.queue.length = 0;
    clearTimeout(this.timer);
    this.current.set(null);
    this.router.navigate(['/profile']);
  }

  private showNext(): void {
    const next = this.queue.shift() ?? null;
    this.current.set(next);
    if (!next) return;
    this.timer = setTimeout(() => this.showNext(), VISIBLE_MS);
  }
}
