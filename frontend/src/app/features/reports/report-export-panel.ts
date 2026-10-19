import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PayType } from '../../core/models/pay-type.model';
import { PAY_TYPES } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
import {
  buildReportCsv,
  buildXeroTimesheetCsv,
  completedEntries,
  downloadTextFile,
} from './report-export';

@Component({
  selector: 'app-report-export-panel',
  imports: [FormsModule],
  templateUrl: './report-export-panel.html',
  styleUrl: './report-export-panel.scss',
})
export class ReportExportPanel {
  readonly entries = input.required<TimeEntry[]>();
  readonly startDate = input('');
  readonly endDate = input('');

  readonly isXeroOpen = signal(false);
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
