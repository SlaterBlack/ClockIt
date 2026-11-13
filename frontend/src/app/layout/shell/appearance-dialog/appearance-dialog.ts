import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { Appearance } from '../../../core/services/appearance';

@Component({
  selector: 'app-appearance-dialog',
  templateUrl: './appearance-dialog.html',
  styleUrl: './appearance-dialog.scss',
})
export class AppearanceDialog {
  @Output() readonly close = new EventEmitter<void>();

  readonly appearance = inject(Appearance);
  readonly isThemeMenuOpen = signal(false);

  get selectedThemeName(): string {
    return (
      this.appearance.themeOptions.find((option) => option.value === this.appearance.theme())?.name ??
      'Default'
    );
  }

  toggleThemeMenu(): void {
    this.isThemeMenuOpen.update((open) => !open);
  }

  selectTheme(value: string): void {
    this.appearance.setTheme(value);
    this.isThemeMenuOpen.set(false);
  }
}
