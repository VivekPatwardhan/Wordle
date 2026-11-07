import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, retry, throwError, timer } from 'rxjs';
import { AuthApi } from './auth-api';
import { User } from '../models/auth';

/**
 * Result of asking the server who is signed in.
 * - `signed-in`: the session is valid.
 * - `signed-out`: the server answered 401; there is no session.
 * - `unreachable`: no answer (offline, server down, 5xx). Nothing is known
 *   about the session, so the current user is left as it was.
 */
export type SessionCheck = 'signed-in' | 'signed-out' | 'unreachable';

/** Retries for a failed check before reporting `unreachable` (not for 401s). */
const SESSION_CHECK_RETRY_DELAYS_MS = [1000, 2000];

const isUnauthorized = (error: unknown) =>
  error instanceof HttpErrorResponse && error.status === 401;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authApi = inject(AuthApi);
  private router = inject(Router);

  readonly currentUser = signal<User | null>(null);

  get isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  set isLoggedIn(value: boolean) {
    if (!value) {
      this.currentUser.set(null);
    }
  }

  constructor() {
    this.setupResumeListener();
  }

  setSession(user: User): void {
    this.currentUser.set(user);
  }

  clearSession(): void {
    this.currentUser.set(null);
  }

  /**
   * Re-verifies current session from /api/auth/me.
   * Only a 401 signs the user out; a network or server failure is retried,
   * then reported as `unreachable` without touching currentUser.
   */
  checkSession(): Observable<SessionCheck> {
    return this.authApi.me().pipe(
      retry({
        count: SESSION_CHECK_RETRY_DELAYS_MS.length,
        delay: (error, attempt) =>
          isUnauthorized(error)
            ? throwError(() => error)
            : timer(SESSION_CHECK_RETRY_DELAYS_MS[attempt - 1]),
      }),
      map((res): SessionCheck => {
        this.currentUser.set(res.user);
        return 'signed-in';
      }),
      catchError((error): Observable<SessionCheck> => {
        if (isUnauthorized(error)) {
          this.currentUser.set(null);
          return of('signed-out');
        }
        console.error('Session verification failed: server unreachable.', error);
        return of('unreachable');
      })
    );
  }

  /**
   * Refreshes user profile on demand.
   */
  refreshProfile(): Observable<User | null> {
    return this.authApi.me().pipe(
      map((res) => {
        this.currentUser.set(res.user);
        return res.user;
      }),
      catchError((error) => {
        console.error('Failed to refresh user profile.', error);
        return of(null);
      })
    );
  }

  /**
   * Listen for app resume (e.g. mobile app foreground or browser tab focus).
   * Re-verifies session only if user is already considered logged in.
   */
  private setupResumeListener(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isLoggedIn) {
        // A blip while the tab was hidden keeps the player signed in;
        // the next check (or request) will find out more.
        this.checkSession().subscribe((result) => {
          if (result === 'signed-out') {
            this.router.navigate(['']);
          }
        });
      }
    });
  }
}

