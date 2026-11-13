import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Appearance } from '../../core/services/appearance';
import { AppearanceDialog } from './appearance-dialog/appearance-dialog';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface LinkedService {
  id: string;
  name: string;
  url: string;
  logoUrl: string;
}

interface ServiceDirectoryResponse {
  services: LinkedService[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isServiceDirectoryResponse(value: unknown): value is ServiceDirectoryResponse {
  if (!isRecord(value) || !Array.isArray(value['services'])) return false;
  return value['services'].every((service: unknown) => {
    if (!isRecord(service)) return false;
    return (
      typeof service['id'] === 'string' &&
      typeof service['name'] === 'string' &&
      isHttpUrl(service['url']) &&
      isHttpUrl(service['logoUrl'])
    );
  });
}

@Component({
  selector: 'app-shell',
  imports: [AppearanceDialog, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(Auth);
  private readonly http = inject(HttpClient);
  readonly appearance = inject(Appearance);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly isAccountMenuOpen = signal(false);
  readonly isServiceMenuOpen = signal(false);
  readonly availableServices = signal<LinkedService[]>([]);
  readonly serviceMenuState = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly isInstallHelpOpen = signal(false);
  readonly isAppearanceOpen = signal(false);
  readonly installError = signal<string | null>(null);
  readonly isStandalone = signal(this.detectStandalone());

  private installPrompt: InstallPromptEvent | null = null;
  private readonly serviceId = 'clockit';

  get isAppleDevice(): boolean {
    const userAgent = window.navigator.userAgent;
    return (
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    );
  }

  get isAndroidDevice(): boolean {
    return /Android/i.test(window.navigator.userAgent);
  }

  logout(): void {
    this.closeAccountMenu();
    this.closeServiceMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleAccountMenu(): void {
    this.closeServiceMenu();
    this.isAccountMenuOpen.update((open) => !open);
  }

  toggleServiceMenu(): void {
    if (this.isServiceMenuOpen()) {
      this.closeServiceMenu();
      return;
    }

    this.closeAccountMenu();
    this.isServiceMenuOpen.set(true);
    if (this.serviceMenuState() !== 'loading') this.loadServices();
  }

  closeServiceMenu(): void {
    this.isServiceMenuOpen.set(false);
  }

  retryServiceLoad(): void {
    this.loadServices();
  }

  closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  async installApp(): Promise<void> {
    this.closeAccountMenu();
    this.installError.set(null);
    if (!this.installPrompt) {
      this.isInstallHelpOpen.set(true);
      return;
    }

    const prompt = this.installPrompt;
    this.installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.isStandalone.set(true);
      }
    } catch (error) {
      console.error('Could not open the browser install prompt.', error);
      this.installError.set(
        'The install prompt could not be opened. Use the browser menu instructions below.',
      );
      this.isInstallHelpOpen.set(true);
    }
  }

  closeInstallHelp(): void {
    this.isInstallHelpOpen.set(false);
    this.installError.set(null);
  }

  openAppearance(): void {
    this.closeAccountMenu();
    this.closeServiceMenu();
    this.isAppearanceOpen.set(true);
  }

  closeAppearance(): void {
    this.isAppearanceOpen.set(false);
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    this.installPrompt = event as InstallPromptEvent;
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.installPrompt = null;
    this.isStandalone.set(true);
    this.closeInstallHelp();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target instanceof Node)) return;
    const serviceSwitcher = this.elementRef.nativeElement.querySelector('.service-switcher');
    if (!serviceSwitcher?.contains(event.target)) this.closeServiceMenu();
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
    this.closeServiceMenu();
    this.closeInstallHelp();
    this.closeAppearance();
  }

  private detectStandalone(): boolean {
    const isDisplayModeStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return isDisplayModeStandalone || isIosStandalone === true;
  }

  private loadServices(): void {
    this.serviceMenuState.set('loading');
    this.http.get<unknown>('/api/services').subscribe({
      next: (response) => {
        if (!isServiceDirectoryResponse(response)) {
          this.handleServiceLoadError(new Error('StoreIt returned an invalid service list.'));
          return;
        }
        this.availableServices.set(
          response.services.filter((service) => service.id !== this.serviceId),
        );
        this.serviceMenuState.set('loaded');
      },
      error: (error: unknown) => this.handleServiceLoadError(error),
    });
  }

  private handleServiceLoadError(error: unknown): void {
    console.error('Could not load linked services from StoreIt.', error);
    this.serviceMenuState.set('error');
  }
}
