import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateDuelRequest,
  DuelHub,
  DuelResponse,
  InvitePreview,
  SubmitDuelGuessResponse,
} from '../models/duel';
import { WordDefinitionResponse } from '../models/game';

@Injectable({
  providedIn: 'root',
})
export class DuelApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/duels`;
  private readonly defaultOptions = { withCredentials: true };

  /** Incoming/outgoing invites, active duels and previous opponents. */
  getHub(): Observable<DuelHub> {
    return this.http.get<DuelHub>(this.baseUrl, this.defaultOptions);
  }

  createDuel(payload: CreateDuelRequest): Observable<DuelResponse> {
    return this.http.post<DuelResponse>(this.baseUrl, payload, this.defaultOptions);
  }

  getDuel(duelId: number | string): Observable<DuelResponse> {
    return this.http.get<DuelResponse>(`${this.baseUrl}/${duelId}`, this.defaultOptions);
  }

  cancelDuel(duelId: number): Observable<DuelResponse> {
    return this.http.post<DuelResponse>(`${this.baseUrl}/${duelId}/cancel`, {}, this.defaultOptions);
  }

  getInvitePreview(token: string): Observable<{ invite: InvitePreview }> {
    return this.http.get<{ invite: InvitePreview }>(
      `${this.baseUrl}/invites/${encodeURIComponent(token)}`,
      this.defaultOptions
    );
  }

  acceptInvite(token: string): Observable<DuelResponse> {
    return this.http.post<DuelResponse>(
      `${this.baseUrl}/invites/${encodeURIComponent(token)}/accept`,
      {},
      this.defaultOptions
    );
  }

  declineInvite(token: string): Observable<{ declined: boolean }> {
    return this.http.post<{ declined: boolean }>(
      `${this.baseUrl}/invites/${encodeURIComponent(token)}/decline`,
      {},
      this.defaultOptions
    );
  }

  /* ---- Round loop ---- */

  /** The setter chooses this round's secret word. */
  setWord(duelId: number, word: string): Observable<DuelResponse> {
    return this.http.post<DuelResponse>(`${this.baseUrl}/${duelId}/word`, { word }, this.defaultOptions);
  }

  submitGuess(duelId: number, guessWord: string): Observable<SubmitDuelGuessResponse> {
    return this.http.post<SubmitDuelGuessResponse>(
      `${this.baseUrl}/${duelId}/guesses`,
      { guessWord },
      this.defaultOptions
    );
  }

  forfeit(duelId: number, scope: 'round' | 'duel'): Observable<DuelResponse> {
    return this.http.post<DuelResponse>(`${this.baseUrl}/${duelId}/forfeit`, { scope }, this.defaultOptions);
  }

  /** Definition of a finished round's word. */
  getRoundDefinition(duelId: number, roundNumber: number): Observable<WordDefinitionResponse> {
    return this.http.get<WordDefinitionResponse>(
      `${this.baseUrl}/${duelId}/rounds/${roundNumber}/definition`,
      this.defaultOptions
    );
  }

  reportWord(duelId: number, roundNumber: number): Observable<{ reported: boolean; alreadyReported: boolean }> {
    return this.http.post<{ reported: boolean; alreadyReported: boolean }>(
      `${this.baseUrl}/${duelId}/rounds/${roundNumber}/report`,
      {},
      this.defaultOptions
    );
  }

  blockOpponent(duelId: number): Observable<{ blocked: boolean }> {
    return this.http.post<{ blocked: boolean }>(`${this.baseUrl}/${duelId}/block`, {}, this.defaultOptions);
  }
}
