import { Component, computed, input } from '@angular/core';
import { LetterFeedback } from '../../../models/game';

/**
 * The opponent's progress in a race: a small 6×5 grid of colours only — never
 * letters — so you can see how close they are without seeing their guesses.
 */
@Component({
  selector: 'app-color-grid',
  template: `
    <div class="grid" role="img" [attr.aria-label]="label()">
      @for (row of cells(); track $index) {
        @for (cell of row; track $index) {
          <span class="cell" [class]="cell"></span>
        }
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(5, 12px); gap: 3px; }
    .cell { width: 12px; height: 12px; border-radius: 3px; background: #f1f5f9; border: 1px solid #e2e8f0; box-sizing: border-box; }
    .correct { background: var(--color-correct, #10b981); border-color: transparent; }
    .present { background: var(--color-present, #f59e0b); border-color: transparent; }
    .absent { background: var(--color-absent, #64748b); border-color: transparent; }
  `,
})
export class ColorGrid {
  readonly rows = input<{ feedback: LetterFeedback[] }[]>([]);

  readonly cells = computed(() => Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => this.rows()[r]?.feedback[c] ?? 'empty')
  ));

  readonly label = computed(() => {
    const rows = this.rows();
    const best = Math.max(0, ...rows.map((row) => row.feedback.filter((f) => f === 'correct').length));
    return `${rows.length} of 6 guesses used, best row has ${best} letters in the right place`;
  });
}
