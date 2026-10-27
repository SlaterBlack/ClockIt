import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';

import { Shell } from './shell';

describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides navigation to reports', () => {
    expect(fixture.nativeElement.querySelector('a[routerLink="/reports"]')?.textContent).toContain(
      'Reports',
    );
  });

  it('shows Notifications in the account menu for admins', () => {
    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.fetchCurrentUser().subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/me')).flush({
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@example.com',
        role: 'admin',
      },
    });
    fixture.detectChanges();
    component.toggleAccountMenu();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('a[routerLink="/notifications"]')?.textContent,
    ).toContain('Notifications');
  });
});
