import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { DuelGuess } from '../../../models/duel';

const ROWS = 6;
const COLS = 5;

interface Tile {
  letter: string;
  state: 'correct' | 'present' | 'absent' | 'draft' | 'empty';
}

/**
 * Read-only 6×5 board: submitted guesses with their colours, then the row
 * being typed (`draft`) — the guesser's own typing, or the live view the
 * setter watches.
 *
 * Flipping tiles is the guesser's "reveal" moment, so it is opt-in:
 * - `animateNewRows`: each newly submitted row flips tile by tile (live board);
 * - `revealLastRow`: the last row flips once when the board appears (the
 *   round-result popup, where the round's final guess is revealed).
 * The setter already knows the word, so their boards just show the colours.
 */
@Component({
  selector: 'app-duel-board',
  template: `
    <div class="board" role="grid" aria-label="Guesses">
      @for (row of rows(); track $index; let r = $index) {
        <div class="row" role="row">
          @for (tile of row; track $index; let c = $index) {
            <span
              class="tile"
              [class]="tile.state"
              [class.flip]="r === flipRow()"
              [style.--i]="c"
              role="gridcell"
            >{{ tile.letter }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .board { display: grid; gap: 6px; width: min(300px, 100%); margin: 0 auto; }
    :host(.compact) .board { width: min(210px, 100%); gap: 4px; }
    :host(.compact) .row { gap: 4px; }
    :host(.compact) .tile { font-size: 1.05rem; border-width: 1.5px; border-radius: 6px; }
    .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .tile {
      --bg: #fff;
      --fg: var(--text-main, #0f172a);
      --edge: var(--border-light, #e2e8f0);
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border: 2px solid var(--edge);
      border-radius: 8px;
      background: var(--bg);
      color: var(--fg);
      font-size: 1.5rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .draft { --edge: #94a3b8; }
    .correct { --bg: var(--color-correct, #10b981); --edge: var(--color-correct, #10b981); --fg: #fff; }
    .present { --bg: var(--color-present, #f59e0b); --edge: var(--color-present, #f59e0b); --fg: #fff; }
    .absent { --bg: var(--color-absent, #64748b); --edge: var(--color-absent, #64748b); --fg: #fff; }

    /* Each tile turns over in turn; its colour shows from the halfway point. */
    .flip {
      animation: flip 0.6s ease-in-out backwards;
      animation-delay: calc(var(--i) * 260ms);
    }
    @keyframes flip {
      0%, 49% { background: #fff; color: var(--text-main, #0f172a); border-color: #94a3b8; }
      0% { transform: rotateX(0); }
      50% { transform: rotateX(90deg); }
      100% { transform: rotateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .flip { animation: none; }
    }
  `,
})
export class DuelBoard {
  readonly guesses = input<DuelGuess[]>([]);
  readonly draft = input('');
  /** Flip each row as it is submitted (the guesser's live board). */
  readonly animateNewRows = input(false);
  /** Flip the last row once, when the board first appears (round-result popup). */
  readonly revealLastRow = input(false);

  /** The row currently flipping, if any. */
  readonly flipRow = signal<number | null>(null);

  readonly rows = computed<Tile[][]>(() => {
    const rows: Tile[][] = this.guesses().slice(0, ROWS).map((guess) =>
      [...guess.word].map((letter, i) => ({ letter, state: guess.feedback[i] ?? 'absent' }))
    );
    if (rows.length < ROWS) {
      const draft = this.draft().slice(0, COLS);
      rows.push(Array.from({ length: COLS }, (_, i) => ({
        letter: draft[i] ?? '',
        state: draft[i] ? 'draft' : 'empty',
      })));
    }
    while (rows.length < ROWS) {
      rows.push(Array.from({ length: COLS }, () => ({ letter: '', state: 'empty' })));
    }
    return rows;
  });

  constructor() {
    // Rows already on the board when it first appears never flip (e.g. after a
    // refresh) — except the last one when `revealLastRow` asks for it.
    let shown = -1;
    effect(() => {
      const count = this.guesses().length;
      untracked(() => {
        if (shown === -1) {
          if (this.revealLastRow() && count > 0) this.flipRow.set(count - 1);
        } else if (count > shown && this.animateNewRows()) {
          this.flipRow.set(count - 1);
        } else if (count < shown) {
          this.flipRow.set(null); // a new round started
        }
        shown = count;
      });
    });
  }
}
