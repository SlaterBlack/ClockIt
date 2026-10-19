import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ReportUser } from '../models/report.model';
import type { TimeEntry } from '../models/time-entry.model';

@Injectable({
  providedIn: 'root',
})
export class Report {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  listUsers(): Observable<{ users: ReportUser[]; currentUserId: string }> {
    return this.http.get<{ users: ReportUser[]; currentUserId: string }>(`${this.apiUrl}/users`);
  }

  listTimeEntries(userId: string): Observable<{ timeEntries: TimeEntry[] }> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<{ timeEntries: TimeEntry[] }>(`${this.apiUrl}/time-entries`, { params });
  }
}
