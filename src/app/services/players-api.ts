import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlayerCard } from '../models/player-card';

@Injectable({
  providedIn: 'root',
})
export class PlayersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/players`;

  getCard(userId: number): Observable<{ card: PlayerCard }> {
    return this.http.get<{ card: PlayerCard }>(`${this.baseUrl}/${userId}`, { withCredentials: true });
  }
}
