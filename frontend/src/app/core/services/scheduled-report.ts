import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ScheduledReportConfig,
  ScheduledReportSettingsResponse,
} from '../models/scheduled-report.model';

@Injectable({
  providedIn: 'root',
})
export class ScheduledReport {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports/scheduled-email`;

  getSettings(): Observable<ScheduledReportSettingsResponse> {
    return this.http.get<ScheduledReportSettingsResponse>(this.apiUrl);
  }

  saveSettings(config: ScheduledReportConfig): Observable<{
    config: ScheduledReportConfig;
    smtpConfigured: boolean;
  }> {
    return this.http.put<{ config: ScheduledReportConfig; smtpConfigured: boolean }>(
      this.apiUrl,
      config,
    );
  }

  sendTest(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/test`, {});
  }
}
