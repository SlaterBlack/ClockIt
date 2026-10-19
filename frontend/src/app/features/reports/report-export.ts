import type { TimeEntry } from '../../core/models/time-entry.model';

export interface XeroInvoiceOptions {
  contactName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  hourlyRate: number;
  accountCode: string;
  taxType: string;
  reference: string;
}

const CSV_BOM = '\uFEFF';
const CSV_NEWLINE = '\r\n';

export function entryDurationSeconds(entry: TimeEntry, now: number): number {
  const startMs = new Date(entry.startTime).getTime();
  if (entry.endTime) {
    return Math.max(
      0,
      entry.durationSeconds ?? Math.round((new Date(entry.endTime).getTime() - startMs) / 1000),
    );
  }
  return Math.max(0, Math.round((now - startMs) / 1000));
}

export function formatClockDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function localDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Neutralises spreadsheet formulas in user-controlled text.
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  return CSV_BOM + rows.map((row) => row.map(csvCell).join(',')).join(CSV_NEWLINE) + CSV_NEWLINE;
}

export function buildReportCsv(entries: TimeEntry[], now: number): string {
  const rows: (string | number)[][] = [
    [
      'Date',
      'Start time',
      'End time',
      'User',
      'Project number',
      'Project',
      'Task',
      'Description',
      'Billable',
      'Duration (hh:mm:ss)',
      'Duration (hours)',
    ],
  ];
  for (const entry of entries) {
    const seconds = entryDurationSeconds(entry, now);
    rows.push([
      localDateKey(new Date(entry.startTime)),
      localTime(entry.startTime),
      entry.endTime ? localTime(entry.endTime) : '',
      safeText(entry.user?.name ?? ''),
      entry.project?.projectNumber ?? '',
      safeText(entry.project?.name ?? ''),
      safeText(entry.task?.name ?? ''),
      safeText(entry.description ?? ''),
      entry.isBillable ? 'Yes' : 'No',
      formatClockDuration(seconds),
      (seconds / 3600).toFixed(2),
    ]);
  }
  return toCsv(rows);
}

// Only finished, billable entries can be invoiced.
export function invoiceableEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => entry.isBillable && entry.endTime);
}

function xeroDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function buildXeroInvoiceCsv(entries: TimeEntry[], options: XeroInvoiceOptions): string {
  const lines = new Map<string, { description: string; seconds: number }>();
  for (const entry of invoiceableEntries(entries)) {
    const key = `${entry.projectId ?? ''}|${entry.taskId ?? ''}`;
    const line = lines.get(key) ?? {
      description: [entry.project?.name, entry.task?.name].filter(Boolean).join(' - ') || 'Time',
      seconds: 0,
    };
    line.seconds += entryDurationSeconds(entry, 0);
    lines.set(key, line);
  }

  const rows: (string | number)[][] = [
    [
      '*ContactName',
      '*InvoiceNumber',
      'Reference',
      '*InvoiceDate',
      '*DueDate',
      '*Description',
      '*Quantity',
      '*UnitAmount',
      '*AccountCode',
      '*TaxType',
    ],
  ];
  for (const line of [...lines.values()].sort((a, b) =>
    a.description.localeCompare(b.description),
  )) {
    rows.push([
      safeText(options.contactName),
      safeText(options.invoiceNumber),
      safeText(options.reference),
      xeroDate(options.invoiceDate),
      xeroDate(options.dueDate),
      safeText(line.description),
      (line.seconds / 3600).toFixed(2),
      options.hourlyRate.toFixed(2),
      safeText(options.accountCode),
      safeText(options.taxType),
    ]);
  }
  return toCsv(rows);
}

export function downloadTextFile(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
