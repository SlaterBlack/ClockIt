import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TimeEntry } from './time-entry';

describe('TimeEntry', () => {
  let service: TimeEntry;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TimeEntry);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
