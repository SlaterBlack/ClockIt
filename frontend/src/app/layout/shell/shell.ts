import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/services/auth';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  readonly isAccountMenuOpen = signal(false);
  readonly isInstallHelpOpen = signal(false);
  readonly installError = signal<string | null>(null);
  readonly isStandalone = signal(this.detectStandalone());

  private installPrompt: InstallPromptEvent | null = null;

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
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((open) => !open);
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
      this.installError.set('The install prompt could not be opened. Use the browser menu instructions below.');
      this.isInstallHelpOpen.set(true);
    }
  }

  closeInstallHelp(): void {
    this.isInstallHelpOpen.set(false);
    this.installError.set(null);
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
    if (event.target instanceof Node && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
    this.closeInstallHelp();
  }

  private detectStandalone(): boolean {
    const isDisplayModeStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return isDisplayModeStandalone || isIosStandalone === true;
  }
}
