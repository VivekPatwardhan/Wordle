import { HttpErrorResponse } from '@angular/common/http';

/** The API's `{ error: { code } }` code, if the error came from our backend. */
export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof HttpErrorResponse ? error.error?.error?.code : undefined;
}

/** The API's human-readable message, or `fallback` for network/unknown errors. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof HttpErrorResponse ? error.error?.error?.message : undefined;
  return typeof message === 'string' ? message : fallback;
}
