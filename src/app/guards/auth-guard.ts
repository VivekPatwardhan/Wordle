import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SessionCheck } from '../services/auth-service';
import { rememberReturnUrl } from '../services/return-url';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated in memory (internal navigation), allow immediately
  if (authService.isLoggedIn) {
    return true;
  }

  // On initial app load or page refresh, verify with the server once
  return authService.checkSession().pipe(
    map((result: SessionCheck) => {
      if (result === 'signed-in') {
        return true;
      }
      // Come back here after signing in (e.g. a shared lobby link).
      rememberReturnUrl(state.url);
      // Unreachable is not the same as signed out: tell the player why.
      return result === 'unreachable'
        ? router.createUrlTree([''], { queryParams: { offline: 1 } })
        : router.createUrlTree(['']);
    })
  );
};
