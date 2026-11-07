import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameApi } from './game-api';
import { environment } from '../../environments/environment';
import {
  CreateGameRequest,
  CreateGameResponse,
  GameResponse,
  SubmitGuessRequest,
  SubmitGuessResponse,
} from '../models/game';

describe('GameApi', () => {
  let service: GameApi;
  let httpTesting: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GameApi,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GameApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should post createGame request with credentials', () => {
    const payload: CreateGameRequest = { mode: 'daily' };
    const mockResponse: CreateGameResponse = {
      game: {
        id: '123',
        mode: 'daily',
        status: 'in_progress',
        puzzleDate: '2026-10-23',
        guesses: [],
      },
    };

    service.createGame(payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/games`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should get game by ID with credentials', () => {
    const gameId = '123';
    const mockResponse: GameResponse = {
      game: {
        id: gameId,
        mode: 'daily',
        status: 'in_progress',
        guesses: [],
      },
    };

    service.getGame(gameId).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/games/${gameId}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should post submitGuess request with credentials', () => {
    const gameId = '123';
    const payload: SubmitGuessRequest = { guessWord: 'crane' };
    const mockResponse: SubmitGuessResponse = {
      game: {
        id: gameId,
        status: 'in_progress',
      },
      guess: {
        attemptNumber: 1,
        guessWord: 'crane',
        feedback: ['correct', 'absent', 'present', 'absent', 'absent'],
      },
    };

    service.submitGuess(gameId, payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/games/${gameId}/guesses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });
});
