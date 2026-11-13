import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Auth } from './auth';

const STORAGE_KEY = 'clockit_theme';
const DEFAULT_THEME = 'default';
const THEME_OPTIONS = [
  { name: 'Default', value: DEFAULT_THEME },
  { name: 'Retro', value: 'retro' },
] as const;

export type Theme = (typeof THEME_OPTIONS)[number]['value'];

function isTheme(value: unknown): value is Theme {
  return THEME_OPTIONS.some((option) => option.value === value);
}

function readTheme(): Theme {
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  if (storedTheme === null) {
    return DEFAULT_THEME;
  }
  if (isTheme(storedTheme)) {
    return storedTheme;
  }

  console.error('Stored ClockIt theme is unsupported; resetting to Default.');
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_THEME;
}

@Injectable({ providedIn: 'root' })
export class Appearance {
  private readonly auth = inject(Auth);
  private queuedTheme: Theme | null = null;
  readonly themeOptions = THEME_OPTIONS;
  readonly theme = signal<Theme>(readTheme());
  readonly isSavingTheme = signal(false);
  readonly themeSyncError = signal<string | null>(null);

  constructor() {
    const accountTheme = this.auth.accountTheme();
    if (accountTheme && isTheme(accountTheme)) {
      this.applyAccountTheme(accountTheme);
    } else {
      this.applyTheme(this.theme());
    }

    effect(() => {
      if (!this.auth.accountThemeLoaded()) return;
      const currentAccountTheme = this.auth.accountTheme();
      if (currentAccountTheme && isTheme(currentAccountTheme)) {
        this.applyAccountTheme(currentAccountTheme);
      } else if (currentAccountTheme === null) {
        untracked(() => this.persistTheme(this.theme()));
      }
    });
  }

  setTheme(value: string): void {
    if (!isTheme(value)) {
      throw new Error('Theme must be one of the available options.');
    }

    localStorage.setItem(STORAGE_KEY, value);
    this.theme.set(value);
    this.applyTheme(value);
    this.themeSyncError.set(null);
    this.persistTheme(value);
  }

  private persistTheme(theme: Theme): void {
    if (this.auth.getToken()) {
      this.queuedTheme = theme;
      if (!this.isSavingTheme()) this.saveQueuedTheme();
    }
  }

  private applyAccountTheme(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this.theme.set(theme);
    this.applyTheme(theme);
  }

  private saveQueuedTheme(): void {
    const theme = this.queuedTheme;
    if (!theme) {
      this.isSavingTheme.set(false);
      return;
    }

    this.queuedTheme = null;
    this.isSavingTheme.set(true);
    this.themeSyncError.set(null);
    this.auth.updateProfile({ theme }).subscribe({
      next: () => {
        if (this.queuedTheme) {
          this.saveQueuedTheme();
        } else {
          this.isSavingTheme.set(false);
        }
      },
      error: (error: unknown) => {
        console.error('Could not save the ClockIt theme to the account.', error);
        if (this.queuedTheme) {
          this.saveQueuedTheme();
        } else {
          this.isSavingTheme.set(false);
          this.themeSyncError.set(
            'Could not save this theme to your account. It is still applied on this device.',
          );
        }
      },
    });
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
