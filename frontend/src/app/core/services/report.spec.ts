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
});
