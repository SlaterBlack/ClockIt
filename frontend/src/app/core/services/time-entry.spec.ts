import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TimeEntry } from './time-entry';

describe('TimeEntry', () => {
  let service: TimeEntry;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TimeEntry);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('removes a time entry', () => {
    service.remove('e1').subscribe();

    const request = httpMock.expectOne((req) => req.method === 'DELETE');
    expect(request.request.url.endsWith('/time-entries/e1')).toBe(true);
    request.flush(null);
  });
});
