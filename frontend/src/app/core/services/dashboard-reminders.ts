import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ActiveDashboardReminder,
  DashboardReminderInput,
  DashboardReminderRule,
} from '../models/dashboard-reminder.model';

@Injectable({
  providedIn: 'root',
})
export class DashboardReminders {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reminders`;

  list(): Observable<{ reminders: DashboardReminderRule[] }> {
    return this.http.get<{ reminders: DashboardReminderRule[] }>(this.apiUrl);
  }

  listActive(): Observable<{ reminders: ActiveDashboardReminder[] }> {
    return this.http.get<{ reminders: ActiveDashboardReminder[] }>(`${this.apiUrl}/active`);
  }

  create(input: DashboardReminderInput): Observable<{ reminder: DashboardReminderRule }> {
    return this.http.post<{ reminder: DashboardReminderRule }>(this.apiUrl, input);
  }

  update(
    id: string,
    input: DashboardReminderInput,
  ): Observable<{ reminder: DashboardReminderRule }> {
    return this.http.patch<{ reminder: DashboardReminderRule }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      input,
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
}
