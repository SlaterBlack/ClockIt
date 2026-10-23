import type { PayType } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
import {
  buildReportCsv,
  buildXeroTimesheetCsv,
  completedEntries,
  entryDurationSeconds,
} from './report-export';

const RATES: Record<PayType, string> = {
  hourly: 'Ordinary Hours',
  'public-holiday': 'Public Holiday',
  'sick-leave': 'Personal Leave',
  'annual-leave': 'Annual Leave',
  unpaid: 'Unpaid',
};

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    description: 'Wireframes',
    startTime: new Date(2026, 9, 19, 9, 0).toISOString(),
    endTime: new Date(2026, 9, 19, 10, 30).toISOString(),
    durationSeconds: 5400,
    isBillable: true,
    userId: 'u1',
    projectId: 'p1',
    taskId: 't1',
    project: { id: 'p1', name: 'Website', projectNumber: '101' },
    task: { id: 't1', name: 'Design' },
    user: { id: 'u1', name: 'Alex Doe' },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('report export helpers', () => {
  it('calculates running entry durations from the supplied clock', () => {
    const start = new Date(2026, 9, 19, 9).getTime();
    const entry = makeEntry({ startTime: new Date(start).toISOString(), endTime: null });

    expect(entryDurationSeconds(entry, start + 90_000)).toBe(90);
  });

  it('builds a CSV with a BOM, user, project, task and durations', () => {
    const csv = buildReportCsv([makeEntry()], 0);
    const [header, row] = csv.replace('\uFEFF', '').trim().split('\r\n');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(header).toContain('User');
    expect(header).toContain('Start timestamp (ISO)');
    expect(header).toContain('End timestamp (ISO)');
    expect(row.split(',')).toEqual([
      '2026-10-19',
      '09:00',
      '10:30',
      makeEntry().startTime,
      makeEntry().endTime!,
      'Alex Doe',
      '101',
      'Website',
      'Design',
      'Wireframes',
      'Yes',
      '01:30:00',
      '1.50',
    ]);
  });

  it('escapes quotes, commas and newlines and neutralises formulas', () => {
    const csv = buildReportCsv(
      [
        makeEntry({ description: 'Say "hi", then\nleave' }),
        makeEntry({ description: '=HYPERLINK("http://evil")' }),
      ],
      0,
    );

    expect(csv).toContain('"Say ""hi"", then\nleave"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('only exports completed entries to payroll', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b', endTime: null })];

    expect(completedEntries(entries).map((entry) => entry.id)).toEqual(['a']);
  });

  it('totals completed hours per employee, day and pay type for Xero payroll timesheets', () => {
    const nextDay = (hour: number) => new Date(2026, 9, 20, hour).toISOString();
    const sickTask = { id: 't2', name: 'Out sick', payType: 'sick-leave' as const };
    const unpaidTask = { id: 't3', name: 'Unpaid leave', payType: 'unpaid' as const };
    const csv = buildXeroTimesheetCsv(
      [
        makeEntry({ id: 'a' }),
        makeEntry({ id: 'b', durationSeconds: 1800 }),
        makeEntry({ id: 'c', isBillable: false, durationSeconds: 3600, task: sickTask }),
        makeEntry({ id: 'g', durationSeconds: 1800, task: unpaidTask }),
        makeEntry({ id: 'd', startTime: nextDay(9), endTime: nextDay(12), durationSeconds: 10800 }),
        makeEntry({
          id: 'e',
          userId: 'u2',
          user: { id: 'u2', name: 'Blake Roe' },
          durationSeconds: 7200,
          task: null,
        }),
        makeEntry({ id: 'f', endTime: null }),
      ],
      { earningsRates: RATES },
    );
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');

    expect(lines).toEqual([
      'Employee,Date,Earnings Rate,Hours',
      'Alex Doe,19/10/2026,Ordinary Hours,2.00',
      'Alex Doe,19/10/2026,Personal Leave,1.00',
      'Alex Doe,19/10/2026,Unpaid,0.50',
      'Alex Doe,20/10/2026,Ordinary Hours,3.00',
      'Blake Roe,19/10/2026,Ordinary Hours,2.00',
    ]);
  });

  it('merges pay types that map to the same earnings rate name', () => {
    const csv = buildXeroTimesheetCsv(
      [
        makeEntry({ id: 'a' }),
        makeEntry({
          id: 'b',
          task: { id: 't2', name: 'Holiday', payType: 'public-holiday' },
        }),
      ],
      { earningsRates: { ...RATES, 'public-holiday': 'Ordinary Hours' } },
    );

    expect(csv.replace('\uFEFF', '').trim().split('\r\n')).toEqual([
      'Employee,Date,Earnings Rate,Hours',
      'Alex Doe,19/10/2026,Ordinary Hours,3.00',
    ]);
  });
});
