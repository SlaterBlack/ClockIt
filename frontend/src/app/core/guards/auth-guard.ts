import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.getToken()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return auth.fetchCurrentUser().pipe(
    map(() => true),
    catchError((error: unknown) => {
      const invalidSession =
        error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status);
      if (invalidSession) {
        auth.logout();
      }
      return of(
        router.createUrlTree(['/login'], {
          queryParams: {
            ...(invalidSession ? { sessionExpired: 'true' } : { sessionCheck: 'unavailable' }),
            returnUrl: state.url,
          },
        }),
      );
    }),
  );
};
