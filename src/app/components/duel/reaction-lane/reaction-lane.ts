import { Component, input } from '@angular/core';

/** One emoji bubble floating up the side of the screen. */
export interface Floater {
  id: number;
  emoji: string;
  /** Sent by me (smaller) or received from the opponent (bigger, pops in). */
  mine: boolean;
  /** Random sideways sway (px) and tilt (deg), so a burst doesn't look mechanical. */
  drift: number;
  tilt: number;
  durationMs: number;
}

/**
 * Live-stream style reactions: emojis pop in just below the board's last row
 * and float up beside it to the top, swaying and fading — never over the
 * letters and never blocking taps. The parent must be position: relative.
 */
@Component({
  selector: 'app-reaction-lane',
  template: `
    @for (f of floaters(); track f.id) {
      <span
        class="floater"
        [class.mine]="f.mine"
        [style.--drift.px]="f.drift"
        [style.--tilt.deg]="f.tilt"
        [style.animation-duration.ms]="f.durationMs"
      >{{ f.emoji }}</span>
    }
  `,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      position: absolute;
      top: 0;
      /* Start slightly below the board's sixth row. */
      bottom: -22px;
      /* Just right of the 300 px board; on narrow screens, the stage's right edge. */
      left: min(calc(50% + 154px), calc(100% - 46px));
      z-index: 20;
      width: 46px;
      pointer-events: none;
    }
    .floater {
      position: absolute;
      bottom: 0;
      left: 4px;
      font-size: 2.4rem;
      line-height: 1;
      filter: drop-shadow(0 4px 6px rgba(15, 23, 42, 0.25));
      animation: float-up linear forwards;
    }
    .floater.mine { font-size: 1.6rem; left: 10px; opacity: 0.85; }
    /* Rises the lane's full height (bottom 0% → 100%) while swaying and tilting. */
    @keyframes float-up {
      0% { bottom: 0; transform: translateX(0) scale(0.3) rotate(0); opacity: 0; }
      12% { bottom: 6%; transform: translateX(0) scale(1.25) rotate(var(--tilt)); opacity: 1; }
      22% { bottom: 14%; transform: translateX(calc(var(--drift) * 0.3)) scale(1) rotate(var(--tilt)); }
      60% { bottom: 58%; transform: translateX(calc(var(--drift) * -0.6)) scale(1) rotate(calc(var(--tilt) * -0.5)); opacity: 1; }
      100% { bottom: 100%; transform: translateX(var(--drift)) scale(0.9) rotate(var(--tilt)); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .floater { animation-name: fade-out; }
      @keyframes fade-out { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
    }
  `,
})
export class ReactionLane {
  readonly floaters = input.required<Floater[]>();
}
