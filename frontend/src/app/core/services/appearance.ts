import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'clockit_theme';
const DEFAULT_THEME = 'default';
const THEME_OPTIONS = [{ name: 'Default', value: DEFAULT_THEME }] as const;

export type Theme = (typeof THEME_OPTIONS)[number]['value'];

function isTheme(value: string): value is Theme {
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
  readonly themeOptions = THEME_OPTIONS;
  readonly theme = signal<Theme>(readTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(value: string): void {
    if (!isTheme(value)) {
      throw new Error('Theme must be one of the available options.');
    }

    localStorage.setItem(STORAGE_KEY, value);
    this.theme.set(value);
    this.applyTheme(value);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
