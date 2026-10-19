import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { TimeEntry } from '../../core/models/time-entry.model';
import {
  buildReportCsv,
  buildXeroInvoiceCsv,
  downloadTextFile,
  invoiceableEntries,
  localDateKey,
} from './report-export';

const DEFAULT_PAYMENT_TERM_DAYS = 30;

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
  readonly contactName = signal('');
  readonly invoiceNumber = signal('');
  readonly invoiceDate = signal(localDateKey(new Date()));
  readonly dueDate = signal(this.defaultDueDate());
  readonly hourlyRate = signal<number | null>(null);
  readonly accountCode = signal('200');
  readonly taxType = signal('Tax Exempt');
  readonly errorMessage = signal<string | null>(null);

  readonly invoiceableCount = computed(() => invoiceableEntries(this.entries()).length);

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

  exportXero(): void {
    const error = this.validateXero();
    this.errorMessage.set(error);
    if (error) {
      return;
    }
    const csv = buildXeroInvoiceCsv(this.entries(), {
      contactName: this.contactName().trim(),
      invoiceNumber: this.invoiceNumber().trim(),
      invoiceDate: this.invoiceDate(),
      dueDate: this.dueDate(),
      hourlyRate: this.hourlyRate() ?? 0,
      accountCode: this.accountCode().trim(),
      taxType: this.taxType().trim(),
      reference:
        this.startDate() && this.endDate() ? `${this.startDate()} to ${this.endDate()}` : '',
    });
    downloadTextFile(`xero-invoice${this.fileSuffix()}.csv`, csv);
  }

  private validateXero(): string | null {
    if (this.invoiceableCount() === 0) {
      return 'There are no completed billable entries to invoice in this report.';
    }
    if (!this.contactName().trim() || !this.invoiceNumber().trim() || !this.accountCode().trim()) {
      return 'Contact name, invoice number and account code are required.';
    }
    if (!this.taxType().trim()) {
      return 'Tax type is required.';
    }
    if (!this.invoiceDate() || !this.dueDate() || this.dueDate() < this.invoiceDate()) {
      return 'Enter an invoice date and a due date on or after it.';
    }
    const rate = this.hourlyRate();
    if (rate === null || !Number.isFinite(rate) || rate < 0) {
      return 'Enter an hourly rate of 0 or more.';
    }
    return null;
  }

  private fileSuffix(): string {
    return this.startDate() && this.endDate() ? `_${this.startDate()}_to_${this.endDate()}` : '';
  }

  private defaultDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + DEFAULT_PAYMENT_TERM_DAYS);
    return localDateKey(due);
  }
}
