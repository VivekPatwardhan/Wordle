import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FriendsOverview } from '../models/friends';
import { PlayerRef } from '../models/duel';

@Injectable({
  providedIn: 'root',
})
export class FriendsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/friends`;
  private readonly defaultOptions = { withCredentials: true };

  getFriends(): Observable<FriendsOverview> {
    return this.http.get<FriendsOverview>(this.baseUrl, this.defaultOptions);
  }

  /** By exact username, or by id (e.g. a previous opponent). */
  sendRequest(target: { username: string } | { userId: number }): Observable<{ status: 'pending' | 'accepted'; friend: PlayerRef }> {
    return this.http.post<{ status: 'pending' | 'accepted'; friend: PlayerRef }>(
      `${this.baseUrl}/requests`, target, this.defaultOptions
    );
  }

  acceptRequest(requestId: number): Observable<{ accepted: boolean }> {
    return this.http.post<{ accepted: boolean }>(`${this.baseUrl}/requests/${requestId}/accept`, {}, this.defaultOptions);
  }

  /** Decline a request you received, or cancel one you sent. */
  removeRequest(requestId: number): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(`${this.baseUrl}/requests/${requestId}`, this.defaultOptions);
  }

  removeFriend(userId: number): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(`${this.baseUrl}/${userId}`, this.defaultOptions);
  }
}
