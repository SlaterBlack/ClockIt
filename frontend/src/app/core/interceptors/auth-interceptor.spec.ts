import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('clockify_dupe_token');
  });

  it('clears expired credentials and redirects to login after an API 401', () => {
    localStorage.setItem('clockify_dupe_token', 'expired-token');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.get('/api/time-entries').subscribe({ error: () => undefined });
    const request = httpMock.expectOne('/api/time-entries');
    expect(request.request.headers.get('Authorization')).toBe('Bearer expired-token');
    request.flush({ error: 'Invalid or expired token' }, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('clockify_dupe_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { sessionExpired: 'true', returnUrl: '/' },
    });
  });

  it('does not clear an existing session for a failed login attempt', () => {
    localStorage.setItem('clockify_dupe_token', 'saved-token');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/auth/login')
      .flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('clockify_dupe_token')).toBe('saved-token');
    expect(navigate).not.toHaveBeenCalled();
  });
});
