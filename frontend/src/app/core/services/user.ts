import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User as UserDto, UserRole } from '../models/user.model';

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

@Injectable({
  providedIn: 'root',
})
export class User {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  list(): Observable<{ users: UserDto[] }> {
    return this.http.get<{ users: UserDto[] }>(this.apiUrl);
  }

  create(payload: CreateUserPayload): Observable<{ user: UserDto }> {
    return this.http.post<{ user: UserDto }>(this.apiUrl, payload);
  }

  update(id: string, changes: UpdateUserPayload): Observable<{ user: UserDto }> {
    return this.http.patch<{ user: UserDto }>(`${this.apiUrl}/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
