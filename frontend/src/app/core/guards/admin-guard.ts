import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { Auth } from '../services/auth';

// Guards admin-only routes. currentUser isn't persisted across page reloads,
// so if it hasn't been loaded yet but a token exists, fetch it before deciding.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.getToken()) {
    return router.createUrlTree(['/login']);
  }

  const currentUser = auth.currentUser();
  if (currentUser) {
    return currentUser.role === 'admin' ? true : router.createUrlTree(['/dashboard']);
  }

  return auth.fetchCurrentUser().pipe(
    map(({ user }) => (user.role === 'admin' ? true : router.createUrlTree(['/dashboard']))),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
