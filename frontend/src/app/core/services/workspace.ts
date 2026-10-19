import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Workspace as WorkspaceDto } from '../models/workspace.model';

@Injectable({
  providedIn: 'root',
})
export class Workspace {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/workspaces`;

  list(): Observable<{ workspaces: WorkspaceDto[] }> {
    return this.http.get<{ workspaces: WorkspaceDto[] }>(this.apiUrl);
  }

  create(name: string): Observable<{ workspace: WorkspaceDto }> {
    return this.http.post<{ workspace: WorkspaceDto }>(this.apiUrl, { name });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
