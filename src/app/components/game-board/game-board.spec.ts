import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { GameBoard } from './game-board';
import { GameApi } from '../../services/game-api';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { ModalService } from '../../services/modal-service';
import { Game, SubmitGuessResponse, WordDefinition } from '../../models/game';

function makeGame(overrides: Partial<Game> = {}): Game {
  return { id: 1, mode: 'practice', status: 'in_progress', guesses: [], ...overrides };
}

const craneDefinition: WordDefinition = {
  word: 'crane',
  found: true,
  meanings: [{ partOfSpeech: 'noun', definitions: ['A large, long-necked bird.'] }],
  source: {
    name: 'Wiktionary',
    url: 'https://en.wiktionary.org/wiki/crane',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
};

function apiError(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { error: { code, message: code } } });
}

describe('GameBoard', () => {
  let component: GameBoard;
  let fixture: ComponentFixture<GameBoard>;
  let gameApi: jasmine.SpyObj<GameApi>;
  let modalService: ModalService;

  function openGame(id: string, game: Game): void {
    gameApi.getGame.and.returnValue(of({ game }));
    fixture.componentRef.setInput('gameId', id);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function typeWord(word: string): void {
    for (const letter of word.toUpperCase()) component.btnClicked(letter);
  }

  beforeEach(async () => {
    gameApi = jasmine.createSpyObj<GameApi>('GameApi', ['getGame', 'submitGuess', 'createGame', 'getDefinition']);
    gameApi.getDefinition.and.returnValue(of({ definition: craneDefinition }));

    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [
        provideRouter([]),
        { provide: GameApi, useValue: gameApi },
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 1, email: 'player@example.com', username: 'Player' }),
            isLoggedIn: true,
            clearSession: jasmine.createSpy('clearSession'),
          },
        },
      ],
    })
    .compileComponents();

    modalService = TestBed.inject(ModalService);
    fixture = TestBed.createComponent(GameBoard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads the game named in the URL', () => {
    openGame('1', makeGame());

    expect(gameApi.getGame).toHaveBeenCalledWith('1');
    expect(component.game()?.id).toBe(1);
    expect(component.isLoading()).toBeFalse();
  });

  it('reloads the board when the URL switches to another game (back/forward navigation)', () => {
    openGame('2', makeGame({ id: 2 }));
    typeWord('cra');

    openGame('1', makeGame({
      id: 1,
      status: 'won',
      guesses: [{ attemptNumber: 1, guessWord: 'crane', feedback: ['correct', 'correct', 'correct', 'correct', 'correct'] }],
    }));

    expect(gameApi.getGame).toHaveBeenCalledWith('1');
    expect(component.game()?.id).toBe(1);
    expect(component.game()?.guesses.length).toBe(1);
    expect(component.currentDraft()).toEqual([]);
  });

  it('ignores typing once the game is finished', () => {
    openGame('1', makeGame({ status: 'won' }));

    component.handlePhysicalKeyboard(new KeyboardEvent('keydown', { key: 'a' }));
    component.btnClicked('B');

    expect(component.currentDraft()).toEqual([]);
  });

  it('submits a guess only once even if Enter is pressed twice', () => {
    openGame('1', makeGame());
    const pending = new Subject<SubmitGuessResponse>();
    gameApi.submitGuess.and.returnValue(pending);
    typeWord('slate');

    component.btnClicked('Enter');
    component.btnClicked('Enter');

    expect(gameApi.submitGuess).toHaveBeenCalledTimes(1);
    expect(component.isWordReady()).toBeFalse();
  });

  it('keeps the draft and says "Not in word list" for unknown words', () => {
    openGame('1', makeGame());
    gameApi.submitGuess.and.returnValue(throwError(() => apiError(400, 'INVALID_GUESS_WORD')));
    typeWord('qwert');

    component.btnClicked('Enter');

    expect(component.toastMessage()).toBe('Not in word list');
    expect(component.currentDraft().join('')).toBe('QWERT');
  });

  it('reloads the real game state when the server says the game is already finished', () => {
    openGame('1', makeGame());
    gameApi.submitGuess.and.returnValue(throwError(() => apiError(410, 'GAME_ALREADY_FINISHED')));
    gameApi.getGame.and.returnValue(of({ game: makeGame({ status: 'won' }) }));
    typeWord('crane');

    component.btnClicked('Enter');

    expect(component.toastMessage()).toBe('This game is already finished');
    expect(component.game()?.status).toBe('won');
  });

  it('shows a message instead of a playable board when the game cannot be loaded', () => {
    gameApi.getGame.and.returnValue(throwError(() => apiError(404, 'GAME_NOT_FOUND')));
    fixture.componentRef.setInput('gameId', '999');
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.loadError()).toBe('This game could not be found.');
    expect(component.isWordReady()).toBeFalse();
  });

  it('reveals the answer in the result dialog of a lost game', fakeAsync(() => {
    openGame('1', makeGame({ status: 'lost', answer: 'crane' }));

    tick(component.RESULT_MODAL_DELAY_MS);

    expect(modalService.currentModal()?.message).toContain('The word was CRANE.');
    fixture.destroy();
  }));

  it('shows the answer\'s definition in the result dialog', fakeAsync(() => {
    openGame('1', makeGame({ status: 'won' }));

    tick(component.RESULT_MODAL_DELAY_MS);

    expect(gameApi.getDefinition).toHaveBeenCalledWith('1');
    expect(modalService.currentModal()?.definition?.()).toEqual({
      status: 'ready',
      definition: craneDefinition,
    });
    fixture.destroy();
  }));

  it('still shows the result when the dictionary is unavailable', fakeAsync(() => {
    gameApi.getDefinition.and.returnValue(throwError(() => apiError(503, 'DICTIONARY_UNAVAILABLE')));
    openGame('1', makeGame({ status: 'lost', answer: 'crane' }));

    tick(component.RESULT_MODAL_DELAY_MS);

    expect(modalService.currentModal()?.message).toContain('Game Over!');
    expect(modalService.currentModal()?.definition?.()).toEqual({ status: 'unavailable' });
    fixture.destroy();
  }));

  it('does not request a definition while the game is still being played', () => {
    openGame('1', makeGame());

    expect(gameApi.getDefinition).not.toHaveBeenCalled();
  });
});
