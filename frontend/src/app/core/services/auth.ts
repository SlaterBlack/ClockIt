import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User, UserTheme } from '../models/user.model';

const TOKEN_STORAGE_KEY = 'clockify_dupe_token';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.sharedApiUrl}/auth`;

  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  private readonly accountThemeSignal = signal<UserTheme | null>(null);
  readonly accountTheme = this.accountThemeSignal.asReadonly();
  private readonly accountThemeLoadedSignal = signal(false);
  readonly accountThemeLoaded = this.accountThemeLoadedSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  fetchCurrentUser(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/me`).pipe(
      tap(({ user }) => {
        this.currentUserSignal.set(user);
        this.accountThemeSignal.set(user.theme ?? null);
        this.accountThemeLoadedSignal.set(true);
      }),
    );
  }

  updateProfile(changes: {
    name?: string;
    email?: string;
    password?: string;
    theme?: UserTheme;
  }): Observable<{ user: User }> {
    return this.http
      .patch<{ user: User }>(`${this.apiUrl}/me`, changes)
      .pipe(tap(({ user }) => this.currentUserSignal.set(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this.currentUserSignal.set(null);
    this.accountThemeSignal.set(null);
    this.accountThemeLoadedSignal.set(false);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private handleAuthResponse(response: AuthResponse): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    this.currentUserSignal.set(response.user);
    this.accountThemeSignal.set(response.user.theme ?? null);
    this.accountThemeLoadedSignal.set(true);
  }
}
