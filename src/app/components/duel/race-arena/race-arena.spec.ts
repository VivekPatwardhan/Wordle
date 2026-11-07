import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RaceArena } from './race-arena';
import { ColorGrid } from '../color-grid/color-grid';
import { DuelApi } from '../../../services/duel-api';
import { RealtimeService } from '../../../services/realtime-service';
import { FakeRealtime } from '../../../testing/fake-realtime';
import { Duel, RaceCurrentRound, RaceGame } from '../../../models/duel';

const ME = 1;
const BOB = 2;
const allGreen = ['correct', 'correct', 'correct', 'correct', 'correct'] as const;

function round(overrides: Partial<RaceCurrentRound> = {}): RaceCurrentRound {
  return {
    number: 1, status: 'playing', msLeft: 180_000, msUntilStart: 0, phaseMs: 180_000,
    myGuesses: [], opponentRows: [], ...overrides,
  };
}

function race(game: Partial<RaceGame> = {}, overrides: Partial<Duel> = {}): Duel {
  return {
    id: 50, source: 'invite', mode: 'race', status: 'guessing', lobbyState: 'in_play', totalRounds: 3, currentRound: 1,
    createdAt: '', startedAt: '', isCreator: true, invite: null,
    players: [{ userId: ME, username: 'Me', seat: 1 }, { userId: BOB, username: 'Bob', seat: 2 }],
    game: {
      mode: 'race', version: 1, current: round(), rounds: [],
      score: [{ userId: ME, roundWins: 0, guessesUsed: 0 }, { userId: BOB, roundWins: 0, guessesUsed: 0 }],
      result: null, ...game,
    },
    ...overrides,
  };
}

describe('RaceArena', () => {
  let fixture: ComponentFixture<RaceArena>;
  let component: RaceArena;
  let duelApi: jasmine.SpyObj<DuelApi>;
  let emitted: Duel[];

  const render = (duel: Duel) => {
    fixture.componentRef.setInput('duel', duel);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    duelApi = jasmine.createSpyObj<DuelApi>('DuelApi', ['submitGuess', 'forfeit', 'getRoundDefinition', 'createDuel']);
    duelApi.getRoundDefinition.and.returnValue(throwError(() => new Error('offline')));
    await TestBed.configureTestingModule({
      imports: [RaceArena],
      providers: [
        provideRouter([]),
        { provide: DuelApi, useValue: duelApi },
        { provide: RealtimeService, useValue: new FakeRealtime() },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(RaceArena);
    component = fixture.componentInstance;
    emitted = [];
    component.duelChange.subscribe((d) => emitted.push(d));
    fixture.componentRef.setInput('myId', ME);
  });

  afterEach(() => fixture.destroy());

  it('locks the keyboard during the start countdown', () => {
    render(race({ current: round({ msUntilStart: 4000 }) }));

    expect(text()).toContain('Round 1 starts in');
    expect(component.canType()).toBeFalse();
    component.press('A');
    expect(component.draft()).toBe('');
  });

  it('lets you type and submit once the round has started', () => {
    const next = race({ version: 2, current: round({ myGuesses: [{ word: 'slate', feedback: ['absent', 'absent', 'correct', 'absent', 'correct'] }] }) });
    duelApi.submitGuess.and.returnValue(of({ guess: { attemptNumber: 1, word: 'slate', feedback: [] }, roundOver: false, duel: next }));
    render(race());

    'SLATE'.split('').forEach((k) => component.press(k));
    component.press('ENTER');

    expect(duelApi.submitGuess).toHaveBeenCalledWith(50, 'slate');
    expect(emitted).toEqual([next]);
    expect(component.draft()).toBe('');
  });

  it("shows the opponent's progress as colours only", () => {
    render(race({ current: round({ opponentRows: [{ feedback: [...allGreen] }] }) }));

    const grid = (fixture.nativeElement as HTMLElement).querySelector('app-color-grid')!;
    expect(grid.querySelectorAll('.cell.correct').length).toBe(5);
    expect(grid.textContent?.trim()).toBe(''); // no letters anywhere
  });

  it('explains refused guesses', () => {
    duelApi.submitGuess.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { error: { code: 'OUT_OF_GUESSES', message: '' } },
    })));
    render(race());
    'CRANE'.split('').forEach((k) => component.press(k));
    component.press('ENTER');

    expect(component.message()).toBe('You have used all 6 guesses');
  });

  it('pops up who solved it first, with both boards revealed', () => {
    render(race());
    render(race({
      version: 4,
      rounds: [{
        number: 1, status: 'won', winnerId: BOB, secretWord: 'crane',
        myGuesses: [{ word: 'slate', feedback: ['absent', 'absent', 'correct', 'absent', 'correct'] }],
        opponentGuesses: [{ word: 'crane', feedback: [...allGreen] }],
      }],
      current: round({ number: 2, msUntilStart: 8000 }),
    }));

    expect(text()).toContain('Bob solved it first in 1.');
    expect(text()).toContain('CRANE');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.result-boards app-duel-board').length).toBe(2);
  });

  it('calls a round nobody solved a draw', () => {
    render(race());
    render(race({
      version: 3,
      rounds: [{ number: 1, status: 'draw', winnerId: null, secretWord: 'pious', myGuesses: [], opponentGuesses: [] }],
      current: round({ number: 2 }),
    }));

    expect(text()).toContain('Nobody solved it — this round is a draw.');
  });

  it('shows the final result and offers a race rematch', () => {
    duelApi.createDuel.and.returnValue(of({ duel: race({}, { id: 51 }) }));
    render(race({ current: null, result: { winnerId: null, reason: 'draw' } }, { status: 'finished', lobbyState: 'finished' }));

    expect(text()).toContain("It's a draw!");
    component.rematch();
    expect(duelApi.createDuel).toHaveBeenCalledWith({ mode: 'race', totalRounds: 3, opponentId: BOB });
  });
});

describe('ColorGrid', () => {
  it('describes progress for screen readers without revealing letters', () => {
    const fixture = TestBed.createComponent(ColorGrid);
    fixture.componentRef.setInput('rows', [
      { feedback: ['correct', 'absent', 'present', 'absent', 'correct'] },
    ]);
    fixture.detectChanges();

    const grid = (fixture.nativeElement as HTMLElement).querySelector('.grid')!;
    expect(grid.getAttribute('aria-label')).toBe('1 of 6 guesses used, best row has 2 letters in the right place');
    expect(grid.querySelectorAll('.cell').length).toBe(30);
  });
});
