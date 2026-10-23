import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import type { PayType } from '../../core/models/pay-type.model';
import { PAY_TYPES } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
import { Report } from '../../core/services/report';
import {
  buildReportCsv,
  buildXeroTimesheetCsv,
  completedEntries,
  downloadTextFile,
} from './report-export';
import { MAX_IMPORT_FILE_BYTES, parseTimeEntryCsv } from './report-import';

@Component({
  selector: 'app-report-export-panel',
  imports: [FormsModule],
  templateUrl: './report-export-panel.html',
  styleUrl: './report-export-panel.scss',
})
export class ReportExportPanel {
  private readonly reportService = inject(Report);

  readonly entries = input.required<TimeEntry[]>();
  readonly startDate = input('');
  readonly endDate = input('');

  readonly importCompleted = output<void>();
  readonly isXeroOpen = signal(false);
  readonly isImporting = signal(false);
  readonly pendingImport = signal<ReturnType<typeof parseTimeEntryCsv>>([]);
  readonly importFileName = signal('');
  readonly importErrorMessage = signal<string | null>(null);
  readonly importSuccessMessage = signal<string | null>(null);
  readonly payTypes = PAY_TYPES;
  readonly earningsRates = signal<Record<PayType, string>>(
    Object.fromEntries(PAY_TYPES.map((type) => [type.value, type.defaultEarningsRate])) as Record<
      PayType,
      string
    >,
  );
  readonly errorMessage = signal<string | null>(null);

  readonly completedCount = computed(() => completedEntries(this.entries()).length);
  readonly employeeCount = computed(
    () => new Set(completedEntries(this.entries()).map((entry) => entry.userId)).size,
  );

  exportCsv(): void {
    this.errorMessage.set(null);
    downloadTextFile(
      `time-report${this.fileSuffix()}.csv`,
      buildReportCsv(this.entries(), Date.now()),
    );
  }

  async onCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.pendingImport.set([]);
    this.importFileName.set('');
    this.importErrorMessage.set(null);
    this.importSuccessMessage.set(null);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      this.importErrorMessage.set('CSV files must be 5 MB or smaller.');
      return;
    }

    try {
      const entries = parseTimeEntryCsv(await file.text());
      this.pendingImport.set(entries);
      this.importFileName.set(file.name);
    } catch (error) {
      this.importErrorMessage.set(
        error instanceof Error ? error.message : 'Could not read the selected CSV file.',
      );
    }
  }

  cancelImport(): void {
    this.pendingImport.set([]);
    this.importFileName.set('');
    this.importErrorMessage.set(null);
    this.importSuccessMessage.set(null);
  }

  importCsv(): void {
    const entries = this.pendingImport();
    if (!entries.length || this.isImporting()) {
      return;
    }
    this.isImporting.set(true);
    this.importErrorMessage.set(null);
    this.importSuccessMessage.set(null);

    this.reportService.importTimeEntries(entries).subscribe({
      next: ({
        importedCount,
        skippedCount,
        createdProjectCount = 0,
        createdTaskCount = 0,
      }) => {
        this.isImporting.set(false);
        this.pendingImport.set([]);
        this.importFileName.set('');
        const messages = [
          importedCount
            ? `Imported ${importedCount} ${importedCount === 1 ? 'entry' : 'entries'}`
            : skippedCount
              ? 'No new entries imported'
              : '',
          skippedCount
            ? `skipped ${skippedCount} already-imported ${skippedCount === 1 ? 'entry' : 'entries'}`
            : '',
          createdProjectCount
            ? `created ${createdProjectCount} ${createdProjectCount === 1 ? 'project' : 'projects'}`
            : '',
          createdTaskCount
            ? `created ${createdTaskCount} ${createdTaskCount === 1 ? 'task' : 'tasks'}`
            : '',
        ].filter(Boolean);
        this.importSuccessMessage.set(`${messages.join('; ') || 'No new entries imported'}.`);
        if (importedCount) {
          this.importCompleted.emit();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isImporting.set(false);
        const apiMessage = (error.error as { error?: unknown } | null)?.error;
        this.importErrorMessage.set(
          typeof apiMessage === 'string'
            ? apiMessage
            : 'Could not import this CSV. Check the file and try again.',
        );
      },
    });
  }

  toggleXero(): void {
    this.isXeroOpen.update((isOpen) => !isOpen);
    this.errorMessage.set(null);
  }

  setEarningsRate(payType: PayType, name: string): void {
    this.earningsRates.update((rates) => ({ ...rates, [payType]: name }));
  }

  exportXero(): void {
    if (this.completedCount() === 0) {
      this.errorMessage.set('There are no completed entries to export in this report.');
      return;
    }
    const earningsRates = this.trimmedEarningsRates();
    const usedPayTypes = new Set(
      completedEntries(this.entries()).map((entry) => entry.task?.payType ?? 'hourly'),
    );
    if (this.payTypes.some((type) => usedPayTypes.has(type.value) && !earningsRates[type.value])) {
      this.errorMessage.set('An earnings rate is required for each pay type used in this report.');
      return;
    }
    this.errorMessage.set(null);
    downloadTextFile(
      `xero-timesheets${this.fileSuffix()}.csv`,
      buildXeroTimesheetCsv(this.entries(), { earningsRates }),
    );
  }

  private trimmedEarningsRates(): Record<PayType, string> {
    const rates = { ...this.earningsRates() };
    for (const type of this.payTypes) {
      rates[type.value] = rates[type.value].trim();
    }
    return rates;
  }

  private fileSuffix(): string {
    return this.startDate() && this.endDate() ? `_${this.startDate()}_to_${this.endDate()}` : '';
  }
}
