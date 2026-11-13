import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';
import { vi } from 'vitest';

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

  it('shows Install app in the account menu', () => {
    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.fetchCurrentUser().subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/me')).flush({
      user: {
        id: 'user-1',
        name: 'User',
        email: 'user@example.com',
        role: 'user',
      },
    });
    fixture.detectChanges();
    component.toggleAccountMenu();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.account-menu-panel [role="menuitem"]')?.textContent,
    ).toContain('Install App');
  });

  it('shows Appearance and opens the Default theme setting', () => {
    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.fetchCurrentUser().subscribe();
    http.expectOne((request) => request.url.endsWith('/auth/me')).flush({
      user: {
        id: 'user-1',
        name: 'User',
        email: 'user@example.com',
        role: 'user',
      },
    });
    fixture.detectChanges();
    component.toggleAccountMenu();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-action="appearance"]')?.click();
    fixture.detectChanges();

    const themeTrigger = fixture.nativeElement.querySelector(
      '[data-theme-trigger]',
    ) as HTMLButtonElement;
    expect(themeTrigger.textContent).toContain('Default');
    themeTrigger.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-theme-option="default"]')?.textContent,
    ).toContain('Default');
  });

  it('uses the browser install prompt when available', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await component.installApp();

    expect(prompt).toHaveBeenCalledOnce();
    expect(component.isStandalone()).toBe(true);
  });

  it('shows Apple Add to Home Screen steps when the browser has no install prompt', async () => {
    const originalUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });

    try {
      await component.installApp();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain(
        'Add to Home Screen',
      );
    } finally {
      if (originalUserAgent) {
        Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
      }
    }
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
    expect(
      fixture.nativeElement.querySelector('a[routerLink="/admin-settings"]')?.textContent,
    ).toContain('Admin Settings');
  });
});
