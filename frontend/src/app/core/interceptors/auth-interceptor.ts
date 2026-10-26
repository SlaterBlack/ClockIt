import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.getToken();

  const request = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      const isLoginRequest = req.url.endsWith('/auth/login');
      const isSessionCheck = req.method === 'GET' && req.url.endsWith('/auth/me');
      if (
        token &&
        !isLoginRequest &&
        !isSessionCheck &&
        error instanceof HttpErrorResponse &&
        error.status === 401
      ) {
        const returnUrl = router.url.startsWith('/login') ? null : router.url;
        auth.logout();
        void router.navigate(['/login'], {
          queryParams: {
            sessionExpired: 'true',
            ...(returnUrl ? { returnUrl } : {}),
          },
        });
      }
      return throwError(() => error);
    }),
  );
};
