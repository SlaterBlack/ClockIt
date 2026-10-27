import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ScheduledReportConfig } from '../models/scheduled-report.model';
import { ScheduledReport } from './scheduled-report';

describe('ScheduledReport', () => {
  let service: ScheduledReport;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScheduledReport);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads admin schedule and SMTP status', () => {
    const response = {
      config: {
        startDate: null,
        frequencyUnit: 'weeks',
        frequencyInterval: 2,
        reportPeriodDays: 14,
        sendWeekday: 2,
        sendTime: '13:00',
        timezone: 'Australia/Brisbane',
        includeAllUsers: true,
        includedUserIds: [],
        recipientUserIds: [],
        enabled: false,
      },
      users: [],
      smtpConfigured: false,
      latestDelivery: null,
    };
    service.getSettings().subscribe((result) => expect(result).toEqual(response));

    httpMock.expectOne((request) => request.url.endsWith('/reports/scheduled-email')).flush(response);
  });

  it('saves the admin schedule', () => {
    const config: ScheduledReportConfig = {
      startDate: '2026-10-26',
      sendWeekday: 2,
      sendTime: '13:00',
      timezone: 'Australia/Brisbane',
      includeAllUsers: true,
      includedUserIds: [],
      recipientUserIds: ['u1'],
      frequencyUnit: 'weeks',
      frequencyInterval: 2,
      reportPeriodDays: 14,
      enabled: true,
    };
    service.saveSettings(config).subscribe((response) => {
      expect(response.config).toEqual(config);
      expect(response.smtpConfigured).toBe(true);
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/reports/scheduled-email'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(config);
    request.flush({ config, smtpConfigured: true });
  });

  it('sends a test workbook email request', () => {
    service.sendTest().subscribe((response) => {
      expect(response.message).toBe('Test workbook sent to 1 recipient(s).');
    });

    const request = httpMock.expectOne((req) =>
      req.url.endsWith('/reports/scheduled-email/test'),
    );
    expect(request.request.method).toBe('POST');
    request.flush({ message: 'Test workbook sent to 1 recipient(s).' });
  });
});
