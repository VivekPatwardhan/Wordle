import { Component, input } from '@angular/core';

export type DotState = 'online' | 'connecting' | 'offline';

/** A small coloured dot (green / amber / grey) with an accessible label. */
@Component({
  selector: 'app-status-dot',
  template: `<span class="dot" [class]="state()" role="img" [attr.aria-label]="label()" [attr.title]="label()"></span>`,
  styles: `
    :host { display: inline-flex; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      background: #94a3b8;
      box-sizing: content-box;
    }
    .online { background: #22c55e; }
    .connecting { background: #f59e0b; }
  `,
})
export class StatusDot {
  readonly state = input.required<DotState>();
  readonly label = input.required<string>();
}
