import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows validation messages instead of silently ignoring an invalid submit', async () => {
    component.form.setValue({ name: 'Sam', email: 'sam@example.com', password: 'short' });
    component.submit();
    fixture.detectChanges();

    http.expectNone(() => true);
    expect(fixture.nativeElement.textContent).toContain('at least 8 characters');
  });

  it('shows the server message when registration fails', () => {
    component.form.setValue({ name: 'Sam', email: 'sam@example.com', password: 'longenough' });
    component.submit();

    http
      .expectOne((req) => req.url.endsWith('/auth/register'))
      .flush(
        { error: 'A user with that email already exists' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('A user with that email already exists');
    expect(component.isSubmitting()).toBe(false);
  });

  it('explains when the server is unreachable', () => {
    component.form.setValue({ name: 'Sam', email: 'sam@example.com', password: 'longenough' });
    component.submit();

    http
      .expectOne((req) => req.url.endsWith('/auth/register'))
      .error(new ProgressEvent('error'), { status: 0 } as Partial<HttpErrorResponse>);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cannot reach the server');
  });
});
