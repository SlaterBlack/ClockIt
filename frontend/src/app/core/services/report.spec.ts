import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Report } from './report';

describe('Report', () => {
  let service: Report;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Report);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads report members without exposing other user fields', () => {
    service.listUsers().subscribe((response) => {
      expect(response.currentUserId).toBe('u1');
      expect(response.users).toEqual([{ id: 'u1', name: 'Taylor User' }]);
    });

    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [{ id: 'u1', name: 'Taylor User' }],
        currentUserId: 'u1',
      });
  });

  it('requests report entries for the selected user scope', () => {
    service.listTimeEntries('all').subscribe((response) => {
      expect(response.timeEntries).toEqual([]);
    });

    const request = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'all',
    );
    request.flush({ timeEntries: [] });
  });

  it('uploads parsed time entries to the authenticated import endpoint', () => {
    const entries = [
      {
        startTime: '2026-10-19T09:00:00.000Z',
        endTime: '2026-10-19T10:00:00.000Z',
        projectNumber: '101',
        projectName: 'Website',
        taskName: 'Design',
        description: 'Wireframes',
        isBillable: true,
      },
    ];

    service.importTimeEntries(entries).subscribe((result) => {
      expect(result).toEqual({ importedCount: 1, skippedCount: 0 });
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/time-entries/import'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ entries });
    request.flush({ importedCount: 1, skippedCount: 0 });
  });
});
