import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';

export type TimeLevel = 'safe' | 'caution' | 'warning' | 'danger';

const STROKE = 4;
const RADIUS = 16;

/**
 * Time left, drawn as a rounded border around its parent (which must be
 * position: relative). The border starts at top centre and shrinks
 * anti-clockwise back towards it: green → yellow → orange → red.
 *
 * A <rect> outline always starts at its top-left corner, so this draws its
 * own path from top centre, sized to the element with a ResizeObserver.
 */
@Component({
  selector: 'app-time-ring',
  template: `
    @if (path(); as d) {
      <svg [attr.width]="size().width" [attr.height]="size().height">
        <path [attr.d]="d" pathLength="100" [attr.stroke-dasharray]="(fraction() * 100) + ' 100'" />
      </svg>
    }
  `,
  host: { 'aria-hidden': 'true', '[class]': 'level()' },
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; --ring: #22c55e; }
    :host(.caution) { --ring: #eab308; }
    :host(.warning) { --ring: #f97316; }
    :host(.danger) { --ring: #ef4444; animation: urgent 1s ease-in-out infinite; }
    svg { position: absolute; inset: 0; overflow: visible; }
    path {
      fill: none;
      stroke: var(--ring);
      stroke-width: ${STROKE};
      stroke-linecap: round;
      transition: stroke-dasharray 0.25s linear, stroke 0.6s ease;
    }
    @keyframes urgent { 50% { opacity: 0.45; } }
    @media (prefers-reduced-motion: reduce) { :host(.danger) { animation: none; } }
  `,
})
export class TimeRing {
  /** Share of the phase left, 1 → 0. */
  readonly fraction = input.required<number>();
  readonly level = input.required<TimeLevel>();

  readonly size = signal({ width: 0, height: 0 });

  /** Rounded rectangle, clockwise from top centre, inset by half the stroke. */
  readonly path = computed(() => {
    const { width, height } = this.size();
    if (width === 0 || height === 0) return null;
    const i = STROKE / 2;
    const r = Math.min(RADIUS, (width - STROKE) / 2, (height - STROKE) / 2);
    const [left, top, right, bottom] = [i, i, width - i, height - i];
    return [
      `M ${width / 2} ${top}`,
      `H ${right - r}`, `A ${r} ${r} 0 0 1 ${right} ${top + r}`,
      `V ${bottom - r}`, `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
      `H ${left + r}`, `A ${r} ${r} 0 0 1 ${left} ${bottom - r}`,
      `V ${top + r}`, `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
      'Z',
    ].join(' ');
  });

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => this.size.set({ width: host.clientWidth, height: host.clientHeight });
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
