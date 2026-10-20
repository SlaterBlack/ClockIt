import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TimeEntry as TimeEntryDto } from '../models/time-entry.model';

@Injectable({
  providedIn: 'root',
})
export class TimeEntry {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/time-entries`;

  list(): Observable<{ timeEntries: TimeEntryDto[] }> {
    return this.http.get<{ timeEntries: TimeEntryDto[] }>(this.apiUrl);
  }

  start(payload: {
    description?: string;
    taskId: string;
    isBillable?: boolean;
  }): Observable<{ timeEntry: TimeEntryDto }> {
    return this.http.post<{ timeEntry: TimeEntryDto }>(`${this.apiUrl}/start`, payload);
  }

  create(payload: {
    description?: string;
    taskId: string;
    isBillable?: boolean;
    startTime: string;
    endTime: string;
  }): Observable<{ timeEntry: TimeEntryDto }> {
    return this.http.post<{ timeEntry: TimeEntryDto }>(this.apiUrl, payload);
  }

  stop(
    id: string,
    payload: { taskId: string; startTime: string },
  ): Observable<{ timeEntry: TimeEntryDto }> {
    return this.http.post<{ timeEntry: TimeEntryDto }>(`${this.apiUrl}/${id}/stop`, payload);
  }

  update(
    id: string,
    payload: Partial<
      Pick<TimeEntryDto, 'description' | 'taskId' | 'isBillable' | 'startTime' | 'endTime'>
    >,
  ): Observable<{ timeEntry: TimeEntryDto }> {
    return this.http.patch<{ timeEntry: TimeEntryDto }>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
