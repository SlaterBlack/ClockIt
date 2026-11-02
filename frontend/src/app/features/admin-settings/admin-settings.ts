import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ToilSettingsResponse, ToilUsage } from '../../core/models/toil.model';
import { Toil } from '../../core/services/toil';

function localDateString(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings implements OnInit {
  private readonly toilService = inject(Toil);

  readonly settings = signal<ToilSettingsResponse | null>(null);
  readonly accrualMultiplier = signal(1);
  readonly usageDraft = signal({
    userId: '',
    usageDate: localDateString(),
    hours: '',
    reason: '',
  });
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isRecording = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.toilService.getSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.accrualMultiplier.set(settings.accrualMultiplier);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.apiError(error, 'Could not load admin settings.'));
        this.isLoading.set(false);
      },
    });
  }

  setContractHours(userId: string, value: string | number): void {
    const raw = String(value).trim();
    const hours = raw === '' ? null : Number(raw);
    this.settings.update((settings) =>
      settings
        ? {
            ...settings,
            users: settings.users.map((user) =>
              user.id === userId
                ? {
                    ...user,
                    contractedHoursPerCycle:
                      hours !== null && Number.isFinite(hours) ? hours : null,
                  }
                : user,
            ),
          }
        : settings,
    );
    this.statusMessage.set(null);
  }

  saveSettings(): void {
    const settings = this.settings();
    const multiplier = this.accrualMultiplier();
    if (!settings || this.isSaving()) {
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10) {
      this.errorMessage.set('The accrual multiplier must be greater than 0 and no more than 10.');
      return;
    }
    if (
      settings.users.some(
        (user) =>
          user.contractedHoursPerCycle !== null &&
          (!Number.isFinite(user.contractedHoursPerCycle) ||
            user.contractedHoursPerCycle < 0 ||
            user.contractedHoursPerCycle > 8784),
      )
    ) {
      this.errorMessage.set('Contracted hours must be between 0 and 8784 per reporting cycle.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.toilService
      .saveSettings({
        accrualMultiplier: multiplier,
        users: settings.users.map((user) => ({
          userId: user.id,
          contractedHoursPerCycle: user.contractedHoursPerCycle,
        })),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.statusMessage.set('TOIL settings saved.');
          this.loadSettings();
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.errorMessage.set(this.apiError(error, 'Could not save TOIL settings.'));
        },
      });
  }

  updateUsageDraft(changes: Partial<ReturnType<typeof this.usageDraft>>): void {
    this.usageDraft.update((draft) => ({ ...draft, ...changes }));
    this.errorMessage.set(null);
    this.statusMessage.set(null);
  }

  recordUsage(): void {
    const draft = this.usageDraft();
    const hours = Number(draft.hours);
    if (
      !draft.userId ||
      !draft.usageDate ||
      !Number.isFinite(hours) ||
      hours <= 0 ||
      Math.round(hours * 100) !== hours * 100
    ) {
      this.errorMessage.set('Choose a user and date, then enter TOIL hours greater than zero.');
      return;
    }
    if (this.isRecording()) {
      return;
    }
    this.isRecording.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.toilService.recordUsage({ ...draft, hours }).subscribe({
      next: ({ usage }) => {
        this.isRecording.set(false);
        this.settings.update((settings) =>
          settings ? { ...settings, usages: [usage, ...settings.usages] } : settings,
        );
        this.usageDraft.update((current) => ({ ...current, hours: '', reason: '' }));
        this.statusMessage.set('TOIL usage recorded.');
      },
      error: (error: HttpErrorResponse) => {
        this.isRecording.set(false);
        this.errorMessage.set(this.apiError(error, 'Could not record TOIL usage.'));
      },
    });
  }

  deleteUsage(usage: ToilUsage): void {
    if (this.deletingId()) {
      return;
    }
    this.deletingId.set(usage.id);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.toilService.deleteUsage(usage.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.settings.update((settings) =>
          settings
            ? { ...settings, usages: settings.usages.filter((item) => item.id !== usage.id) }
            : settings,
        );
        this.statusMessage.set('TOIL usage record deleted.');
      },
      error: (error: HttpErrorResponse) => {
        this.deletingId.set(null);
        this.errorMessage.set(this.apiError(error, 'Could not delete the TOIL usage record.'));
      },
    });
  }

  private apiError(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { error?: unknown } | null)?.error;
    return typeof message === 'string' ? message : fallback;
  }
}
