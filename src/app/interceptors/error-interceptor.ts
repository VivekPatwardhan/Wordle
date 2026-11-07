import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const apiMessage = error.error?.error?.message;
      const errorMessage = typeof apiMessage === 'string'
        ? apiMessage
        : error.message;
      console.error(errorMessage);
      return throwError(() => error);
    })
  );
};
