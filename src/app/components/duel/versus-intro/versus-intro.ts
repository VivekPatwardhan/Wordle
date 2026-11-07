import { Component, DestroyRef, inject, input, output } from '@angular/core';

const SHOW_MS = 3600;

/**
 * Arena-style announcement when a random match is found: the two name plates
 * slam in from opposite sides, "VS" crashes down with a flash, then the duel
 * details slide up. Clears itself after ~3.5 s, or on tap / Escape.
 */
@Component({
  selector: 'app-versus-intro',
  template: `
    <div class="stage" role="dialog" aria-modal="true" [attr.aria-label]="me() + ' versus ' + opponent()"
         tabindex="-1" (click)="done.emit()" (keydown.escape)="done.emit()">
      <div class="flash" aria-hidden="true"></div>
      <div class="streaks" aria-hidden="true"><span></span><span></span><span></span></div>

      <div class="plate left">
        <span class="avatar">{{ me()[0]?.toUpperCase() }}</span>
        <span class="name">{{ me() }}</span>
        <span class="tag">You</span>
      </div>

      <div class="vs" aria-hidden="true">VS</div>

      <div class="plate right">
        <span class="avatar">{{ opponent()[0]?.toUpperCase() }}</span>
        <span class="name">{{ opponent() }}</span>
        <span class="tag">Opponent</span>
      </div>

      <p class="details">
        <strong>{{ heading() }}</strong>
        <span>{{ subtitle() }}</span>
        <span class="skip">Tap to start</span>
      </p>
    </div>
  `,
  styles: `
    .stage {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      grid-template-rows: 1fr auto auto 1fr;
      align-items: center;
      gap: 12px;
      padding: 24px 12px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 45%, #312e81 0%, #0f172a 70%);
      color: #fff;
      cursor: pointer;
      outline: none;
      animation: stage-in 0.25s ease-out, stage-out 0.35s ease-in ${SHOW_MS - 350}ms forwards, shake 0.35s 0.75s;
    }
    .plate {
      grid-row: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 18px 10px;
      border-radius: 18px;
      font-weight: 800;
    }
    .plate.left {
      grid-column: 1;
      background: linear-gradient(135deg, #6366f1, #4338ca);
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.6);
      animation: slam-left 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) 0.15s both;
    }
    .plate.right {
      grid-column: 3;
      background: linear-gradient(225deg, #f97316, #dc2626);
      box-shadow: 0 0 40px rgba(249, 115, 22, 0.6);
      animation: slam-right 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) 0.15s both;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border: 3px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.35);
      font-size: 1.8rem;
    }
    .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.15rem; }
    .tag { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.8; }
    .vs {
      grid-row: 2;
      grid-column: 2;
      font-size: clamp(3rem, 14vw, 5rem);
      font-weight: 900;
      font-style: italic;
      letter-spacing: -0.04em;
      color: #fde047;
      text-shadow: 0 0 18px rgba(253, 224, 71, 0.9), 0 6px 0 #b45309;
      animation: vs-crash 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) 0.6s both, vs-glow 1.2s ease-in-out 1.2s infinite alternate;
    }
    .details {
      grid-row: 3;
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin: 8px 0 0;
      text-align: center;
      animation: rise 0.45s ease-out 1.1s both;
    }
    .details strong { font-size: 1.1rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .skip { margin-top: 10px; font-size: 0.75rem; opacity: 0.6; }
    .flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; animation: flash 0.5s ease-out 0.68s; }
    .streaks span {
      position: absolute;
      left: -40%;
      width: 60%;
      height: 3px;
      background: linear-gradient(90deg, transparent, rgba(253, 224, 71, 0.9), transparent);
      animation: streak 0.9s ease-out both;
    }
    .streaks span:nth-child(1) { top: 30%; animation-delay: 0.7s; }
    .streaks span:nth-child(2) { top: 55%; animation-delay: 0.8s; }
    .streaks span:nth-child(3) { top: 72%; animation-delay: 0.9s; }

    @keyframes stage-in { from { opacity: 0; } }
    @keyframes stage-out { to { opacity: 0; transform: scale(1.04); } }
    @keyframes slam-left { from { transform: translateX(-120vw) skewX(-12deg); } }
    @keyframes slam-right { from { transform: translateX(120vw) skewX(12deg); } }
    @keyframes vs-crash { from { transform: scale(4) rotate(-14deg); opacity: 0; } }
    @keyframes vs-glow { to { text-shadow: 0 0 34px rgba(253, 224, 71, 1), 0 6px 0 #b45309; } }
    @keyframes flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
    @keyframes shake { 25% { transform: translate(-6px, 3px); } 50% { transform: translate(5px, -4px); } 75% { transform: translate(-3px, 2px); } }
    @keyframes rise { from { transform: translateY(24px); opacity: 0; } }
    @keyframes streak { from { transform: translateX(0); opacity: 1; } to { transform: translateX(260%); opacity: 0; } }

    @media (prefers-reduced-motion: reduce) {
      .stage { animation: stage-in 0.3s ease-out, stage-out 0.3s ease-in ${SHOW_MS - 300}ms forwards; }
      .plate.left, .plate.right, .vs, .details { animation: none; }
      .flash, .streaks { display: none; }
    }
  `,
})
export class VersusIntro {
  readonly me = input.required<string>();
  readonly opponent = input.required<string>();
  /** e.g. '4-round duel' or 'Best-of-3 race'. */
  readonly heading = input.required<string>();
  /** e.g. 'Bob sets the first word' or 'First to solve wins each round'. */
  readonly subtitle = input.required<string>();
  readonly done = output<void>();

  constructor() {
    const timer = setTimeout(() => this.done.emit(), SHOW_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
