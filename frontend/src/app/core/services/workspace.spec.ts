import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Workspace } from './workspace';

describe('Workspace', () => {
  let service: Workspace;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Workspace);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
