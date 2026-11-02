import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ToilSettingsResponse, ToilUsage } from '../models/toil.model';

@Injectable({ providedIn: 'root' })
export class Toil {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports/toil`;

  getSettings(startDate?: string, endDate?: string): Observable<ToilSettingsResponse> {
    let params = new HttpParams();
    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    }
    return this.http.get<ToilSettingsResponse>(this.apiUrl, { params });
  }

  saveSettings(settings: {
    accrualMultiplier: number;
    users: { userId: string; contractedHoursPerCycle: number | null }[];
  }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/settings`, settings);
  }

  recordUsage(usage: {
    userId: string;
    usageDate: string;
    hours: number;
    reason: string;
  }): Observable<{ usage: ToilUsage }> {
    return this.http.post<{ usage: ToilUsage }>(`${this.apiUrl}/used`, usage);
  }

  deleteUsage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/used/${encodeURIComponent(id)}`);
  }
}
