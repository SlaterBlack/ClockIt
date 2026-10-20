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

  listByWorkspace(
    workspaceId: string,
    includeTasks = false,
    includeArchived = false,
  ): Observable<{ projects: ProjectDto[] }> {
    return this.http.get<{ projects: ProjectDto[] }>(this.apiUrl, {
      params: {
        workspaceId,
        ...(includeTasks ? { includeTasks: 'true' } : {}),
        ...(includeArchived ? { includeArchived: 'true' } : {}),
      },
    });
  }

  create(payload: {
    name: string;
    projectNumber: string;
    workspaceId: string;
    color?: string;
    isBillable?: boolean;
  }): Observable<{ project: ProjectDto }> {
    return this.http.post<{ project: ProjectDto }>(this.apiUrl, payload);
  }

  update(
    id: string,
    changes: Partial<Pick<ProjectDto, 'color' | 'name' | 'projectNumber' | 'archived'>>,
  ): Observable<{ project: ProjectDto }> {
    return this.http.patch<{ project: ProjectDto }>(`${this.apiUrl}/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
