import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PayType } from '../models/pay-type.model';
import type { Task as TaskDto } from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class Task {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  listByProject(projectId: string): Observable<{ tasks: TaskDto[] }> {
    return this.http.get<{ tasks: TaskDto[] }>(`${this.apiUrl}/${projectId}/tasks`);
  }

  create(projectId: string, name: string, payType: PayType): Observable<{ task: TaskDto }> {
    return this.http.post<{ task: TaskDto }>(`${this.apiUrl}/${projectId}/tasks`, {
      name,
      payType,
    });
  }

  update(
    projectId: string,
    taskId: string,
    name: string,
    payType: PayType,
  ): Observable<{ task: TaskDto }> {
    return this.http.patch<{ task: TaskDto }>(`${this.apiUrl}/${projectId}/tasks/${taskId}`, {
      name,
      payType,
    });
  }

  remove(projectId: string, taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}/tasks/${taskId}`);
  }
}
