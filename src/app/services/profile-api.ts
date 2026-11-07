import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlayerStatsResponse, PvpStatsResponse, StatsMode } from '../models/profile';
import { AuthResponse } from '../models/auth';
import { AchievementsOverview } from '../models/achievements';

@Injectable({
  providedIn: 'root',
})
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly defaultOptions = { withCredentials: true };

  getMyStats(mode: StatsMode): Observable<PlayerStatsResponse> {
    return this.http.get<PlayerStatsResponse>(
      `${this.baseUrl}/api/profile/stats`,
      { ...this.defaultOptions, params: { mode } }
    );
  }

  /** Duel record, role stats, head-to-heads and recent duels. */
  getMyPvpStats(mode: 'duel' | 'race' = 'duel'): Observable<PvpStatsResponse> {
    return this.http.get<PvpStatsResponse>(
      `${this.baseUrl}/api/profile/pvp`,
      { ...this.defaultOptions, params: { mode } }
    );
  }

  /** Every achievement with progress and unlock dates. */
  getMyAchievements(): Observable<{ achievements: AchievementsOverview }> {
    return this.http.get<{ achievements: AchievementsOverview }>(`${this.baseUrl}/api/profile/achievements`, this.defaultOptions);
  }

  /** Renames the signed-in player (allowed once every 7 days). Returns the updated user. */
  changeUsername(username: string): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(
      `${this.baseUrl}/api/profile/username`,
      { username },
      this.defaultOptions
    );
  }
}
