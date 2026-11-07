import { Component, computed, input, output } from '@angular/core';
import { DuelGuess } from '../../../models/duel';

const KEY_ROWS = [
  [...'QWERTYUIOP'],
  [...'ASDFGHJKL'],
  ['ENTER', ...'ZXCVBNM', '⌫'],
];

/** On-screen keyboard, coloured by what the guesses so far revealed. */
@Component({
  selector: 'app-duel-keyboard',
  template: `
    <div class="keyboard" role="group" aria-label="On-screen keyboard">
      @for (row of keyRows; track $index) {
        <div class="key-row">
          @for (key of row; track key) {
            <button
              type="button"
              class="key"
              [class.wide]="key.length > 1"
              [class]="status()[key] ?? ''"
              [disabled]="disabled()"
              [attr.aria-label]="key === '⌫' ? 'Backspace' : key"
              (click)="pressed.emit(key === '⌫' ? 'BACKSPACE' : key)"
            >{{ key }}</button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .keyboard { display: grid; gap: 6px; }
    .key-row { display: flex; justify-content: center; gap: 5px; }
    .key {
      flex: 1;
      max-width: 42px;
      min-height: 50px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: var(--color-key-bg, #e2e8f0);
      color: var(--text-main, #0f172a);
      font-weight: 800;
      font-size: 0.85rem;
    }
    .key.wide { max-width: 64px; flex: 1.5; font-size: 0.7rem; }
    .key:disabled { opacity: 0.5; }
    .correct { background: var(--color-correct, #10b981); color: #fff; }
    .present { background: var(--color-present, #f59e0b); color: #fff; }
    .absent { background: var(--color-absent, #64748b); color: #fff; }
  `,
})
export class DuelKeyboard {
  readonly guesses = input<DuelGuess[]>([]);
  readonly disabled = input(false);
  /** 'A'–'Z', 'ENTER' or 'BACKSPACE'. */
  readonly pressed = output<string>();

  readonly keyRows = KEY_ROWS;

  /** Best colour seen per letter: correct beats present beats absent. */
  readonly status = computed(() => {
    const rank = { absent: 1, present: 2, correct: 3 } as const;
    const best: Partial<Record<string, keyof typeof rank>> = {};
    for (const guess of this.guesses()) {
      [...guess.word.toUpperCase()].forEach((letter, i) => {
        const state = guess.feedback[i];
        const previous = best[letter];
        if (state && (!previous || rank[state] > rank[previous])) best[letter] = state;
      });
    }
    return best;
  });
}
