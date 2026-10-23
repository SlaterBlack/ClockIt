import type { PayType } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';

export interface XeroTimesheetOptions {
  earningsRates: Record<PayType, string>;
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
      'Start timestamp (ISO)',
      'End timestamp (ISO)',
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
      entry.startTime,
      entry.endTime ?? '',
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

// Payroll only counts finished entries; a running timer has no final hours yet.
export function completedEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((entry) => entry.endTime);
}

function xeroDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

// One row per employee, day and earnings rate, with all completed entries summed.
export function buildXeroTimesheetCsv(entries: TimeEntry[], options: XeroTimesheetOptions): string {
  const days = new Map<
    string,
    { employee: string; date: string; earningsRate: string; seconds: number }
  >();
  for (const entry of completedEntries(entries)) {
    const employee = entry.user?.name ?? '';
    const date = localDateKey(new Date(entry.startTime));
    const earningsRate = options.earningsRates[entry.task?.payType ?? 'hourly'];
    const key = `${entry.userId}|${date}|${earningsRate}`;
    const day = days.get(key) ?? { employee, date, earningsRate, seconds: 0 };
    day.seconds += entryDurationSeconds(entry, 0);
    days.set(key, day);
  }

  const rows: (string | number)[][] = [['Employee', 'Date', 'Earnings Rate', 'Hours']];
  const sortedDays = [...days.values()].sort(
    (a, b) =>
      a.employee.localeCompare(b.employee) ||
      a.date.localeCompare(b.date) ||
      a.earningsRate.localeCompare(b.earningsRate),
  );
  for (const day of sortedDays) {
    rows.push([
      safeText(day.employee),
      xeroDate(day.date),
      safeText(day.earningsRate),
      (day.seconds / 3600).toFixed(2),
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
