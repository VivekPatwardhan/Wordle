import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';
import { AuthApi } from '../services/auth-api';

/** 3–15 letters, numbers or spaces, with at least one letter or number (mirrors the backend). */
export const USERNAME_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]{3,15}$/;

export const USERNAME_CHECK_DEBOUNCE_MS = 1000;

/**
 * Async validator that asks the server whether a username is free, 1 second
 * after the user stops typing. Angular cancels the previous validator run on
 * every keystroke, so timer() acts as the debounce: only the last value is sent.
 * Async validators only run once the control's sync validators pass.
 *
 * `currentUsername` is for renaming: the player's own name (in any letter case)
 * is never reported as taken. Network errors return null — the server checks
 * again when the form is submitted.
 */
export function usernameAvailableValidator(
  authApi: AuthApi,
  currentUsername: () => string | null | undefined = () => null,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const username = String(control.value ?? '').trim();
    const current = currentUsername();

    if (current && username.toLowerCase() === current.toLowerCase()) {
      return of(username === current ? { sameAsCurrent: true } : null);
    }

    return timer(USERNAME_CHECK_DEBOUNCE_MS).pipe(
      switchMap(() => authApi.checkUsernameAvailability(username)),
      map(({ available }) => (available ? null : { usernameTaken: true })),
      catchError(() => of(null))
    );
  };
}
