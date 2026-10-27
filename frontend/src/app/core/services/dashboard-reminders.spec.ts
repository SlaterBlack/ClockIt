import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { DashboardReminderInput } from '../models/dashboard-reminder.model';
import { DashboardReminders } from './dashboard-reminders';

describe('DashboardReminders', () => {
  let service: DashboardReminders;
  let httpMock: HttpTestingController;
  const reminder: DashboardReminderInput = {
    text: 'Please finalise your timesheet.',
    startDate: '2026-10-26',
    frequencyUnit: 'weeks',
    frequencyInterval: 2,
    weekdays: [1, 3, 5],
    startTime: '15:00',
    endTime: '17:00',
    timezone: 'Australia/Brisbane',
    enabled: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardReminders);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads active reminders for the tracker', () => {
    const response = { reminders: [{ id: 'r1', text: reminder.text }] };
    service.listActive().subscribe((result) => expect(result).toEqual(response));

    const request = httpMock.expectOne((req) => req.url.endsWith('/reminders/active'));
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('creates, updates, and deletes reminder rules', () => {
    service.create(reminder).subscribe(({ reminder: created }) => {
      expect(created.text).toBe(reminder.text);
    });
    const createRequest = httpMock.expectOne((req) => req.url.endsWith('/reminders'));
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(reminder);
    createRequest.flush({ reminder: { id: 'r1', ...reminder } });

    service.update('r1', { ...reminder, enabled: false }).subscribe(({ reminder: updated }) => {
      expect(updated.enabled).toBe(false);
    });
    const updateRequest = httpMock.expectOne((req) => req.url.endsWith('/reminders/r1'));
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush({ reminder: { id: 'r1', ...reminder, enabled: false } });

    service.delete('r1').subscribe();
    const deleteRequest = httpMock.expectOne((req) => req.url.endsWith('/reminders/r1'));
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
  });
});
