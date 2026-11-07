import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DuelArena } from './duel-arena';
import { DuelApi } from '../../../services/duel-api';
import { RealtimeService } from '../../../services/realtime-service';
import { FakeRealtime } from '../../../testing/fake-realtime';
import { CurrentRound, Duel, DuelGame, DuelRound } from '../../../models/duel';

const ME = 1;
const BOB = 2;

function makeRound(overrides: Partial<CurrentRound> = {}): CurrentRound {
  return {
    number: 1, setterId: ME, guesserId: BOB, status: 'setting', winnerId: null,
    secretWord: null, guesses: [], msLeft: 60_000, phaseMs: 60_000, ...overrides,
  };
}

function makeDuel(game: Partial<DuelGame> = {}, overrides: Partial<Duel> = {}): Duel {
  return {
    id: 10, source: 'invite', mode: 'duel', status: 'setting', lobbyState: 'in_play', totalRounds: 2, currentRound: 1,
    createdAt: '', startedAt: '', isCreator: true, invite: null,
    players: [{ userId: ME, username: 'Me', seat: 1 }, { userId: BOB, username: 'Bob', seat: 2 }],
    game: {
      version: 1,
      current: makeRound(),
      rounds: [],
      score: [{ userId: ME, roundWins: 0, guessesUsed: 0 }, { userId: BOB, roundWins: 0, guessesUsed: 0 }],
      result: null,
      ...game,
    },
    ...overrides,
  };
}

describe('DuelArena', () => {
  let fixture: ComponentFixture<DuelArena>;
  let component: DuelArena;
  let duelApi: jasmine.SpyObj<DuelApi>;
  let realtime: FakeRealtime;
  let emitted: Duel[];

  function render(duel: Duel): void {
    fixture.componentRef.setInput('duel', duel);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    duelApi = jasmine.createSpyObj<DuelApi>('DuelApi', [
      'setWord', 'submitGuess', 'forfeit', 'getRoundDefinition', 'reportWord', 'blockOpponent', 'createDuel',
    ]);
    duelApi.getRoundDefinition.and.returnValue(throwError(() => new Error('offline')));
    realtime = new FakeRealtime();

    await TestBed.configureTestingModule({
      imports: [DuelArena],
      providers: [
        provideRouter([]),
        { provide: DuelApi, useValue: duelApi },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(DuelArena);
    component = fixture.componentInstance;
    emitted = [];
    component.duelChange.subscribe((duel) => emitted.push(duel));
    fixture.componentRef.setInput('myId', ME);
  });

  afterEach(() => fixture.destroy());

  it('asks the setter for a word and shows the clock', () => {
    render(makeDuel());

    expect(text()).toContain('Set a secret word');
    expect(text()).toContain('1:00');
    expect(text()).toContain('Round 1 / 2');
  });

  it('tells the guesser to wait while the word is chosen', () => {
    render(makeDuel({ current: makeRound({ setterId: BOB, guesserId: ME }) }));

    expect(text()).toContain('Bob is choosing a word');
  });

  it('submits the secret word and passes the new state up', () => {
    const next = makeDuel({ version: 2, current: makeRound({ status: 'guessing', secretWord: 'crane' }) });
    duelApi.setWord.and.returnValue(of({ duel: next }));
    render(makeDuel());

    component.onWordInput('Cr4ne!');
    expect(component.wordInput()).toBe('crne');
    component.onWordInput('crane');
    component.submitWord();

    expect(duelApi.setWord).toHaveBeenCalledWith(10, 'crane');
    expect(emitted).toEqual([next]);
  });

  it('shows why a secret word was refused', () => {
    duelApi.setWord.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { error: { code: 'WORD_NOT_ALLOWED', message: 'Please choose a different word.' } },
    })));
    render(makeDuel());

    component.onWordInput('screw');
    component.submitWord();
    fixture.detectChanges();

    expect(text()).toContain('Please choose a different word.');
  });

  describe('as the guesser', () => {
    const guessing = () => makeDuel({
      current: makeRound({ setterId: BOB, guesserId: ME, status: 'guessing', msLeft: 180_000 }),
    });

    it('sends every key tap live to the watching setter', () => {
      render(guessing());

      component.press('C');
      component.press('R');
      component.press('BACKSPACE');

      expect(realtime.send.calls.allArgs()).toEqual([
        ['duel:draft', { duelId: 10, letters: 'c' }],
        ['duel:draft', { duelId: 10, letters: 'cr' }],
        ['duel:draft', { duelId: 10, letters: 'c' }],
      ]);
      expect(text()).toContain('Bob is watching you type');
    });

    it('submits a five-letter guess on Enter and keeps the draft when refused', () => {
      duelApi.submitGuess.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 400, error: { error: { code: 'NOT_A_WORD', message: 'Not in word list' } },
      })));
      render(guessing());

      'qwer'.split('').forEach((k) => component.press(k.toUpperCase()));
      component.press('ENTER');
      expect(component.message()).toBe('Not enough letters');
      expect(duelApi.submitGuess).not.toHaveBeenCalled();

      component.press('T');
      component.press('ENTER');
      expect(duelApi.submitGuess).toHaveBeenCalledWith(10, 'qwert');
      expect(component.message()).toBe('Not in word list');
      expect(component.draft()).toBe('qwert');
    });
  });

  describe('as the watching setter', () => {
    it('shows the secret word and the guesser\'s live typing', () => {
      render(makeDuel({ current: makeRound({ status: 'guessing', secretWord: 'crane', msLeft: 180_000 }) }));

      realtime.push('duel:draft', { duelId: 10, roundNumber: 1, letters: 'sla' });
      fixture.detectChanges();

      expect(text()).toContain('CRANE');
      expect(component.watchedDraft()).toBe('sla');
      // Typing is the guesser's job.
      component.press('A');
      expect(realtime.send).not.toHaveBeenCalled();
    });

    it('ignores live typing from another round or duel', () => {
      render(makeDuel({ current: makeRound({ status: 'guessing', secretWord: 'crane' }) }));

      realtime.push('duel:draft', { duelId: 99, roundNumber: 1, letters: 'zzz' });
      realtime.push('duel:draft', { duelId: 10, roundNumber: 2, letters: 'yyy' });

      expect(component.watchedDraft()).toBe('');
    });
  });

  it('floats sent and received reactions up the side lane', () => {
    render(makeDuel());

    component.react('🔥');
    realtime.push('duel:reaction', { duelId: 10, fromUserId: BOB, emoji: '😮' });
    fixture.detectChanges();

    expect(realtime.send).toHaveBeenCalledWith('duel:reaction', { duelId: 10, emoji: '🔥' });
    const floaters = [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-reaction-lane .floater')];
    expect(floaters.map((f) => f.textContent?.trim())).toEqual(['🔥', '😮']);
    expect(floaters[0].classList).toContain('mine');      // mine: smaller
    expect(floaters[1].classList).not.toContain('mine');  // theirs: bigger, pops in
    expect(component.reactionAnnouncement()).toBe('Bob reacted 😮');
  });

  it('limits reactions to the same rate the server allows', () => {
    render(makeDuel());

    for (let i = 0; i < 5; i += 1) component.react('👏');

    expect(realtime.send).toHaveBeenCalledTimes(3);
    expect(component.floaters().length).toBe(3);
  });

  it('colours the time ring by how much of the phase is left', () => {
    const at = (msLeft: number) => {
      render(makeDuel({ version: msLeft, current: makeRound({ msLeft, phaseMs: 60_000 }) }));
      return { fraction: component.timeFraction(), level: component.timeLevel() };
    };

    expect(at(60_000)).toEqual({ fraction: 1, level: 'safe' });
    expect(at(24_000).level).toBe('caution');
    expect(at(12_000).level).toBe('warning');
    expect(at(3_000).level).toBe('danger');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-time-ring')).not.toBeNull();
  });

  it('asks for confirmation before forfeiting', () => {
    duelApi.forfeit.and.returnValue(of({ duel: makeDuel({ version: 3 }) }));
    render(makeDuel());

    component.forfeit('duel');
    expect(duelApi.forfeit).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(text()).toContain('Tap again to forfeit the whole duel');

    component.forfeit('duel');
    expect(duelApi.forfeit).toHaveBeenCalledWith(10, 'duel');
  });

  it('pops up the result of a round that just ended, with its definition', () => {
    render(makeDuel());
    const finished: DuelRound = {
      number: 1, setterId: ME, guesserId: BOB, status: 'solved', winnerId: BOB,
      secretWord: 'crane', guesses: [{ word: 'crane', feedback: ['correct', 'correct', 'correct', 'correct', 'correct'] }],
    };

    render(makeDuel({
      version: 4,
      rounds: [finished],
      current: makeRound({ number: 2, setterId: BOB, guesserId: ME, msLeft: 70_000 }),
    }));

    expect(component.shownResult()?.number).toBe(1);
    expect(duelApi.getRoundDefinition).toHaveBeenCalledWith(10, 1);
    expect(text()).toContain('Bob solved it in 1.');
    expect(text()).toContain('CRANE');
  });

  it("explains a round where the setter didn't set a word", () => {
    render(makeDuel());
    render(makeDuel({
      version: 3,
      rounds: [{ number: 1, setterId: BOB, guesserId: ME, status: 'timed_out', winnerId: ME, secretWord: null, guesses: [] }],
      current: makeRound({ number: 2, msLeft: 70_000 }),
    }));

    expect(text()).toContain("Bob didn't set a word in time — round to you.");
    expect(text()).toContain('No word was set this round.');
    expect(text()).not.toContain('The word was');
    expect(duelApi.getRoundDefinition).not.toHaveBeenCalled();
  });

  it('shows the final result and offers a rematch', () => {
    duelApi.createDuel.and.returnValue(of({ duel: makeDuel({}, { id: 11 }) }));
    render(makeDuel({
      current: null,
      result: { winnerId: ME, reason: 'tiebreak' },
      score: [{ userId: ME, roundWins: 1, guessesUsed: 3 }, { userId: BOB, roundWins: 1, guessesUsed: 7 }],
    }, { status: 'finished', lobbyState: 'finished' }));

    expect(text()).toContain('You won the duel!');
    expect(text()).toContain('decided by fewer guesses used');

    component.rematch();
    expect(duelApi.createDuel).toHaveBeenCalledWith({ totalRounds: 2, opponentId: BOB });
  });
});
