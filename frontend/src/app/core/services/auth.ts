import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User } from '../models/user.model';

const TOKEN_STORAGE_KEY = 'clockify_dupe_token';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.sharedApiUrl}/auth`;

  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((response) => this.handleAuthResponse(response)));
  }

  fetchCurrentUser(): Observable<{ user: User }> {
    return this.http
      .get<{ user: User }>(`${this.apiUrl}/me`)
      .pipe(tap(({ user }) => this.currentUserSignal.set(user)));
  }

  updateProfile(changes: { name?: string; email?: string; password?: string }): Observable<{ user: User }> {
    return this.http
      .patch<{ user: User }>(`${this.apiUrl}/me`, changes)
      .pipe(tap(({ user }) => this.currentUserSignal.set(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private handleAuthResponse(response: AuthResponse): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    this.currentUserSignal.set(response.user);
  }
}
