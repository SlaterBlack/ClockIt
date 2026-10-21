import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { adminGuard } from './admin-guard';
import { Auth } from '../services/auth';

describe('adminGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => adminGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('redirects to login when there is no token', () => {
    const auth = TestBed.inject(Auth);
    vi.spyOn(auth, 'getToken').mockReturnValue(null);

    const result = executeGuard({} as never, {} as never);
    expect(result).not.toBe(true);
  });

  it('allows navigation when the loaded current user is an admin', () => {
    const auth = TestBed.inject(Auth);
    vi.spyOn(auth, 'getToken').mockReturnValue('token');
    vi.spyOn(auth, 'currentUser').mockReturnValue({
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'admin',
    });

    const result = executeGuard({} as never, {} as never);
    expect(result).toBe(true);
  });

  it('redirects non-admins to the dashboard', () => {
    const auth = TestBed.inject(Auth);
    vi.spyOn(auth, 'getToken').mockReturnValue('token');
    vi.spyOn(auth, 'currentUser').mockReturnValue({
      id: 'u2',
      name: 'Uma',
      email: 'uma@example.com',
      role: 'user',
    });

    const result = executeGuard({} as never, {} as never);
    expect(result).not.toBe(true);
  });
});
