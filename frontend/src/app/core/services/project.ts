import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Project as ProjectDto } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class Project {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  listByWorkspace(workspaceId: string): Observable<{ projects: ProjectDto[] }> {
    return this.http.get<{ projects: ProjectDto[] }>(this.apiUrl, {
      params: { workspaceId },
    });
  }

  create(payload: {
    name: string;
    workspaceId: string;
    color?: string;
    isBillable?: boolean;
  }): Observable<{ project: ProjectDto }> {
    return this.http.post<{ project: ProjectDto }>(this.apiUrl, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
