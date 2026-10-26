import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';

import { Auth } from '../services/auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('clockify_dupe_token');
  });

  it('redirects to login when there is no saved token', () => {
    const result = executeGuard({} as never, { url: '/reports' } as never) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toContain('/login');
    expect(httpMock.match(() => true)).toHaveLength(0);
  });

  it('allows access only after the API confirms the saved session', async () => {
    localStorage.setItem('clockify_dupe_token', 'valid-token');
    const result = executeGuard({} as never, { url: '/reports' } as never) as Observable<
      boolean | UrlTree
    >;
    const navigation = firstValueFrom(result);
    httpMock.expectOne((request) => request.url.endsWith('/auth/me')).flush({
      user: { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'user' },
    });

    await expect(navigation).resolves.toBe(true);
    expect(TestBed.inject(Auth).currentUser()?.name).toBe('Ada');
  });

  it('clears an expired session and redirects to login', async () => {
    localStorage.setItem('clockify_dupe_token', 'expired-token');
    const result = executeGuard({} as never, { url: '/reports' } as never) as Observable<
      boolean | UrlTree
    >;
    const navigation = firstValueFrom(result);
    httpMock
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({ error: 'Invalid or expired token' }, { status: 401, statusText: 'Unauthorized' });

    const redirect = await navigation;
    expect(redirect instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toContain(
      'sessionExpired=true',
    );
    expect(TestBed.inject(Auth).getToken()).toBeNull();
  });

  it('shows login with a session-check message when the API cannot be reached', async () => {
    localStorage.setItem('clockify_dupe_token', 'saved-token');
    const result = executeGuard({} as never, { url: '/reports' } as never) as Observable<
      boolean | UrlTree
    >;
    const navigation = firstValueFrom(result);
    httpMock
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    const redirect = await navigation;
    expect(TestBed.inject(Router).serializeUrl(redirect as UrlTree)).toContain(
      'sessionCheck=unavailable',
    );
    expect(TestBed.inject(Auth).getToken()).toBe('saved-token');
  });
});
