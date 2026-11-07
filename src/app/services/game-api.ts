import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateGameRequest,
  CreateGameResponse,
  GameResponse,
  SubmitGuessRequest,
  SubmitGuessResponse,
  WordDefinitionResponse,
} from '../models/game';

@Injectable({
  providedIn: 'root',
})
export class GameApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly defaultOptions = { withCredentials: true };

  createGame(payload: CreateGameRequest): Observable<CreateGameResponse> {
    return this.http.post<CreateGameResponse>(
      `${this.baseUrl}/api/games`,
      payload,
      this.defaultOptions
    );
  }

  getGame(gameId: string | number): Observable<GameResponse> {
    return this.http.get<GameResponse>(
      `${this.baseUrl}/api/games/${gameId}`,
      this.defaultOptions
    );
  }

  submitGuess(
    gameId: string | number,
    payload: SubmitGuessRequest
  ): Observable<SubmitGuessResponse> {
    return this.http.post<SubmitGuessResponse>(
      `${this.baseUrl}/api/games/${gameId}/guesses`,
      payload,
      this.defaultOptions
    );
  }

  /** Part of speech and definitions of the answer — only for finished games. */
  getDefinition(gameId: string | number): Observable<WordDefinitionResponse> {
    return this.http.get<WordDefinitionResponse>(
      `${this.baseUrl}/api/games/${gameId}/definition`,
      this.defaultOptions
    );
  }
}
