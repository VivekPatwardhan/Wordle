import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuelBoard } from './duel-board';
import { DuelGuess } from '../../../models/duel';

const guess = (word: string): DuelGuess => ({ word, feedback: ['absent', 'absent', 'correct', 'absent', 'correct'] });

describe('DuelBoard', () => {
  let fixture: ComponentFixture<DuelBoard>;

  function render(inputs: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  const flippingRows = () => {
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row')];
    return rows.map((row, i) => (row.querySelector('.flip') ? i : -1)).filter((i) => i >= 0);
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(DuelBoard);
  });

  it("flips a newly submitted row on the guesser's board", () => {
    render({ animateNewRows: true, guesses: [guess('slate')] });
    expect(flippingRows()).toEqual([]); // already there when the board appeared

    render({ guesses: [guess('slate'), guess('crane')] });
    expect(flippingRows()).toEqual([1]);
  });

  it("never flips on the setter's board", () => {
    render({ animateNewRows: false, guesses: [] });
    render({ guesses: [guess('slate')] });

    expect(flippingRows()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.tile.correct')).not.toBeNull();
  });

  it('reveals the last row once when asked (round result)', () => {
    render({ revealLastRow: true, guesses: [guess('slate'), guess('crane')] });

    expect(flippingRows()).toEqual([1]);
  });
});
