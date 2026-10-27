import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  ReportFrequencyUnit,
  ScheduledReportConfig,
  ScheduledReportUser,
} from '../../core/models/scheduled-report.model';
import type {
  DashboardReminderFrequencyUnit,
  DashboardReminderInput,
  DashboardReminderRule,
} from '../../core/models/dashboard-reminder.model';
import { ScheduledReport } from '../../core/services/scheduled-report';
import { DashboardReminders } from '../../core/services/dashboard-reminders';

function localDateString(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  selector: 'app-notifications',
  imports: [FormsModule, DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit {
  private readonly reportService = inject(ScheduledReport);
  private readonly reminderService = inject(DashboardReminders);

  readonly config = signal<ScheduledReportConfig>({
    startDate: null,
    frequencyUnit: 'weeks',
    frequencyInterval: 2,
    reportPeriodDays: 14,
    sendWeekday: 2,
    sendTime: '13:00',
    timezone: 'Australia/Brisbane',
    includeAllUsers: true,
    includedUserIds: [],
    recipientUserIds: [],
    enabled: false,
  });
  readonly users = signal<ScheduledReportUser[]>([]);
  readonly smtpConfigured = signal(false);
  readonly latestDelivery = signal<{
    status: 'pending' | 'sent' | 'failed';
    periodStart: string;
    sentAt: string | null;
    errorMessage: string | null;
  } | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isSendingTest = signal(false);
  readonly reminders = signal<DashboardReminderRule[]>([]);
  readonly reminderCompatibilityWarning = signal<string | null>(null);
  readonly reminderDraft = signal<DashboardReminderInput>({
    text: '',
    startDate: localDateString(),
    frequencyUnit: 'weeks',
    frequencyInterval: 2,
    weekdays: [],
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'Australia/Brisbane',
    enabled: true,
  });
  readonly editingReminderId = signal<string | null>(null);
  readonly remindersLoading = signal(true);
  readonly isSavingReminder = signal(false);
  readonly deletingReminderId = signal<string | null>(null);
  readonly reminderErrorMessage = signal<string | null>(null);
  readonly reminderStatusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly weekdays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
  readonly frequencyUnits: { value: ReportFrequencyUnit; label: string }[] = [
    { value: 'days', label: 'days' },
    { value: 'weeks', label: 'weeks' },
  ];
  readonly reminderFrequencyUnits: {
    value: DashboardReminderFrequencyUnit;
    label: string;
  }[] = [
    { value: 'days', label: 'days' },
    { value: 'weeks', label: 'weeks' },
  ];

  ngOnInit(): void {
    this.loadSettings();
    this.loadReminders();
  }

  updateFrequencyInterval(value: string | number): void {
    const interval = Number(value);
    this.updateConfig({
      frequencyInterval: Number.isInteger(interval) ? interval : 1,
    });
  }

  updateReportPeriodDays(value: string | number): void {
    const days = Number(value);
    this.updateConfig({ reportPeriodDays: Number.isInteger(days) ? days : 1 });
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.reportService.getSettings().subscribe({
      next: (response) => {
        this.config.set(response.config);
        this.users.set(response.users);
        this.smtpConfigured.set(response.smtpConfigured);
        this.latestDelivery.set(response.latestDelivery);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.apiError(error, 'Could not load notification settings.'));
        this.isLoading.set(false);
      },
    });
  }

  updateConfig(changes: Partial<ScheduledReportConfig>): void {
    this.config.update((config) => ({ ...config, ...changes }));
    this.statusMessage.set(null);
  }

  toggleRecipient(userId: string, checked: boolean): void {
    this.config.update((config) => ({
      ...config,
      recipientUserIds: checked
        ? [...new Set([...config.recipientUserIds, userId])]
        : config.recipientUserIds.filter((id) => id !== userId),
    }));
    this.statusMessage.set(null);
  }

  onRecipientChange(userId: string, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.toggleRecipient(userId, event.target.checked);
    }
  }

  onIncludedUserChange(userId: string, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const includedUserIds = event.target.checked
      ? [...new Set([...this.config().includedUserIds, userId])]
      : this.config().includedUserIds.filter((id) => id !== userId);
    this.updateConfig({ includedUserIds });
  }

  onIncludeAllUsersChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateConfig({
        includeAllUsers: event.target.checked,
        ...(event.target.checked ? { includedUserIds: [] } : {}),
      });
    }
  }

  onEnabledChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateConfig({ enabled: event.target.checked });
    }
  }

  saveSettings(): void {
    if (this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.reportService.saveSettings(this.config()).subscribe({
      next: ({ config, smtpConfigured }) => {
        this.config.set(config);
        this.smtpConfigured.set(smtpConfigured);
        this.isSaving.set(false);
        this.statusMessage.set('Report notification settings saved.');
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.errorMessage.set(this.apiError(error, 'Could not save notification settings.'));
      },
    });
  }

  sendTest(): void {
    if (this.isSendingTest()) {
      return;
    }
    this.isSendingTest.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.reportService.sendTest().subscribe({
      next: ({ message }) => {
        this.isSendingTest.set(false);
        this.statusMessage.set(message);
      },
      error: (error: HttpErrorResponse) => {
        this.isSendingTest.set(false);
        this.errorMessage.set(this.apiError(error, 'Could not send the test report email.'));
      },
    });
  }

  loadReminders(): void {
    this.remindersLoading.set(true);
    this.reminderErrorMessage.set(null);
    this.reminderService.list().subscribe({
      next: ({ reminders }) => {
        const recurrenceAvailable = reminders.every((reminder) =>
          this.hasRecurrenceSettings(reminder),
        );
        this.reminders.set(reminders.map((reminder) => this.normalizeReminder(reminder)));
        this.reminderCompatibilityWarning.set(
          recurrenceAvailable || reminders.length === 0
            ? null
            : 'StoreIt is still serving an older reminder API. Existing weekly reminders are shown, but restart StoreIt before saving custom repeat intervals.',
        );
        this.remindersLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.reminderErrorMessage.set(this.apiError(error, 'Could not load dashboard reminders.'));
        this.remindersLoading.set(false);
      },
    });
  }

  updateReminderDraft(changes: Partial<DashboardReminderInput>): void {
    this.reminderDraft.update((draft) => ({ ...draft, ...changes }));
    this.reminderStatusMessage.set(null);
  }

  onReminderWeekdayChange(day: number, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const weekdays = event.target.checked
      ? [...new Set([...this.reminderDraft().weekdays, day])]
      : this.reminderDraft().weekdays.filter((selectedDay) => selectedDay !== day);
    this.updateReminderDraft({ weekdays: weekdays.sort((a, b) => a - b) });
  }

  updateReminderFrequencyInterval(value: string | number): void {
    const interval = Number(value);
    this.updateReminderDraft({
      frequencyInterval: Number.isInteger(interval) ? interval : 1,
    });
  }

  updateReminderFrequencyUnit(value: DashboardReminderFrequencyUnit): void {
    this.updateReminderDraft({
      frequencyUnit: value,
      ...(value === 'days' ? { weekdays: [] } : {}),
    });
  }

  onReminderEnabledChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateReminderDraft({ enabled: event.target.checked });
    }
  }

  editReminder(reminder: DashboardReminderRule): void {
    const { id, ...draft } = reminder;
    this.editingReminderId.set(id);
    this.reminderDraft.set({ ...draft, weekdays: [...draft.weekdays] });
    this.reminderErrorMessage.set(null);
    this.reminderStatusMessage.set(null);
  }

  cancelReminderEdit(): void {
    this.editingReminderId.set(null);
    this.reminderDraft.set(this.emptyReminderDraft());
    this.reminderErrorMessage.set(null);
    this.reminderStatusMessage.set(null);
  }

  saveReminder(): void {
    if (this.isSavingReminder()) {
      return;
    }
    const draft = this.reminderDraft();
    if (
      !draft.text.trim() ||
      !draft.startDate ||
      (draft.frequencyUnit === 'weeks' && draft.weekdays.length === 0) ||
      draft.startTime === draft.endTime
    ) {
      this.reminderErrorMessage.set(
        'Enter reminder text, a start date, valid repeat days, and different start and end times.',
      );
      return;
    }

    this.isSavingReminder.set(true);
    this.reminderErrorMessage.set(null);
    this.reminderStatusMessage.set(null);
    const reminderId = this.editingReminderId();
    const saveRequest = reminderId
      ? this.reminderService.update(reminderId, draft)
      : this.reminderService.create(draft);
    saveRequest.subscribe({
      next: ({ reminder }) => {
        const recurrenceAvailable = this.hasRecurrenceSettings(reminder);
        const savedReminder = this.normalizeReminder(reminder);
        this.reminders.update((reminders) =>
          reminderId
            ? reminders.map((current) =>
                current.id === savedReminder.id ? savedReminder : current,
              )
            : [...reminders, savedReminder],
        );
        this.isSavingReminder.set(false);
        this.cancelReminderEdit();
        if (recurrenceAvailable) {
          this.reminderCompatibilityWarning.set(null);
          this.reminderStatusMessage.set(
            reminderId ? 'Dashboard reminder updated.' : 'Dashboard reminder created.',
          );
        } else {
          const message =
            'StoreIt did not confirm the repeat interval. The reminder text and times may have saved, but restart StoreIt and review this reminder before relying on its schedule.';
          this.reminderCompatibilityWarning.set(message);
          this.reminderErrorMessage.set(message);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingReminder.set(false);
        this.reminderErrorMessage.set(
          this.apiError(error, 'Could not save the dashboard reminder.'),
        );
      },
    });
  }

  deleteReminder(reminder: DashboardReminderRule): void {
    if (
      this.deletingReminderId() ||
      !confirm(`Delete this reminder? This cannot be undone.\n\n${reminder.text}`)
    ) {
      return;
    }
    this.deletingReminderId.set(reminder.id);
    this.reminderErrorMessage.set(null);
    this.reminderStatusMessage.set(null);
    this.reminderService.delete(reminder.id).subscribe({
      next: () => {
        this.reminders.update((reminders) =>
          reminders.filter((current) => current.id !== reminder.id),
        );
        if (this.editingReminderId() === reminder.id) {
          this.cancelReminderEdit();
        }
        this.deletingReminderId.set(null);
        this.reminderStatusMessage.set('Dashboard reminder deleted.');
      },
      error: (error: HttpErrorResponse) => {
        this.deletingReminderId.set(null);
        this.reminderErrorMessage.set(
          this.apiError(error, 'Could not delete the dashboard reminder.'),
        );
      },
    });
  }

  formatReminderSchedule(reminder: DashboardReminderRule): string {
    const selectedDays = this.weekdays
      .filter((day) => reminder.weekdays.includes(day.value))
      .map((day) => day.label);
    const intervalUnit =
      reminder.frequencyInterval === 1
        ? reminder.frequencyUnit.slice(0, -1)
        : reminder.frequencyUnit;
    const days = reminder.frequencyUnit === 'weeks' ? ` on ${selectedDays.join(', ')}` : '';
    return `Every ${reminder.frequencyInterval} ${intervalUnit} from ${reminder.startDate}${days} · ${reminder.startTime}–${reminder.endTime} (${reminder.timezone})`;
  }

  private emptyReminderDraft(): DashboardReminderInput {
    return {
      text: '',
      startDate: localDateString(),
      frequencyUnit: 'weeks',
      frequencyInterval: 2,
      weekdays: [],
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'Australia/Brisbane',
      enabled: true,
    };
  }

  private hasRecurrenceSettings(reminder: DashboardReminderRule): boolean {
    return (
      typeof reminder.startDate === 'string' &&
      (reminder.frequencyUnit === 'days' || reminder.frequencyUnit === 'weeks') &&
      Number.isInteger(reminder.frequencyInterval) &&
      reminder.frequencyInterval > 0
    );
  }

  private normalizeReminder(reminder: DashboardReminderRule): DashboardReminderRule {
    const legacyWeeklyAnchor =
      reminder.startDate === '1970-01-05' &&
      reminder.frequencyUnit === 'weeks' &&
      reminder.frequencyInterval === 1;
    return {
      ...reminder,
      startDate:
        typeof reminder.startDate === 'string' && !legacyWeeklyAnchor
          ? reminder.startDate
          : localDateString(),
      frequencyUnit: reminder.frequencyUnit === 'days' ? 'days' : 'weeks',
      frequencyInterval:
        Number.isInteger(reminder.frequencyInterval) && reminder.frequencyInterval > 0
          ? reminder.frequencyInterval
          : 1,
      weekdays: Array.isArray(reminder.weekdays) ? reminder.weekdays : [],
    };
  }

  private apiError(error: HttpErrorResponse, fallback: string): string {
    return typeof error.error?.error === 'string' ? error.error.error : fallback;
  }
}
