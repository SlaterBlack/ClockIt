import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { Appearance } from '../../core/services/appearance';
import { Auth } from '../../core/services/auth';
import { vi } from 'vitest';

import { Shell } from './shell';

describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    localStorage.removeItem('clockit_theme');
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

  it('shows links to other running services from StoreIt', () => {
    const http = TestBed.inject(HttpTestingController);
    component.toggleServiceMenu();
    fixture.detectChanges();

    http.expectOne('/api/services').flush({
      services: [
        {
          id: 'clockit',
          name: 'ClockIt',
          url: 'https://clockit.ai3d.com.au:2400/',
          logoUrl: 'https://clockit.ai3d.com.au:2400/ClockItLogo_32x32.png',
        },
        {
          id: 'manageit',
          name: 'ManageIt',
          url: 'https://manageit.ai3d.com.au/',
          logoUrl: 'https://manageit.ai3d.com.au/ManageItLogo_32x32.png',
        },
      ],
    });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.service-menu-item') as HTMLAnchorElement;
    expect(fixture.nativeElement.querySelectorAll('.service-menu-item')).toHaveLength(1);
    expect(link.href).toBe('https://manageit.ai3d.com.au/');
    expect(link.textContent).toContain('ManageIt');
    expect(link.querySelector('img')?.src).toBe(
      'https://manageit.ai3d.com.au/ManageItLogo_32x32.png',
    );
  });

  it('shows Install app in the account menu', () => {
    const auth = TestBed.inject(Auth);
    const http = TestBed.inject(HttpTestingController);
    auth.fetchCurrentUser().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({
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
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({
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
    expect(
      fixture.nativeElement.querySelector('[data-theme-option="retro"]')?.textContent,
    ).toContain('Retro');
    fixture.nativeElement.querySelector('[data-theme-option="retro"]')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(Appearance).theme()).toBe('retro');
    expect(localStorage.getItem('clockit_theme')).toBe('retro');
    expect(document.documentElement.dataset['theme']).toBe('retro');
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
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({
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
