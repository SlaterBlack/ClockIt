import { parseTimeEntryCsv } from './report-import';
import type { TimeEntry } from '../../core/models/time-entry.model';
import { buildReportCsv } from './report-export';

describe('parseTimeEntryCsv', () => {
  it('round-trips the app report export format', () => {
    const entry: TimeEntry = {
      id: 'e1',
      description: 'Wireframes',
      startTime: '2026-10-19T22:00:00.000Z',
      endTime: '2026-10-19T23:30:00.000Z',
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
    };

    expect(parseTimeEntryCsv(buildReportCsv([entry], 0))).toEqual([
      {
        startTime: entry.startTime,
        endTime: entry.endTime,
        projectNumber: '101',
        projectName: 'Website',
        taskName: 'Design',
        description: 'Wireframes',
        isBillable: true,
      },
    ]);
  });

  it('parses a ClockIt report export and preserves ISO timestamps', () => {
    const startTime = '2026-10-19T22:00:00.000Z';
    const endTime = '2026-10-19T23:30:00.000Z';
    const csv = [
      '\uFEFFDate,Start time,End time,Start timestamp (ISO),End timestamp (ISO),User,Project number,Project,Task,Description,Billable',
      `2026-10-20,09:00,10:30,${startTime},${endTime},Alex Doe,101,Website,Design,Wireframes,Yes`,
    ].join('\r\n');

    expect(parseTimeEntryCsv(csv)).toEqual([
      {
        startTime,
        endTime,
        projectNumber: '101',
        projectName: 'Website',
        taskName: 'Design',
        description: 'Wireframes',
        isBillable: true,
      },
    ]);
  });

  it('reads older ClockIt CSVs and handles quoted commas, quotes, and newlines', () => {
    const csv = [
      'Date,Start time,End time,Project,Task,Description,Billable',
      '2026-10-19,09:00,10:30,Website,Design,"Review ""A"", then',
      'continue",No',
    ].join('\r\n');
    const expectedStart = new Date(2026, 9, 19, 9).toISOString();
    const expectedEnd = new Date(2026, 9, 19, 10, 30).toISOString();

    expect(parseTimeEntryCsv(csv)).toEqual([
      {
        startTime: expectedStart,
        endTime: expectedEnd,
        projectNumber: null,
        projectName: 'Website',
        taskName: 'Design',
        description: 'Review "A", then\r\ncontinue',
        isBillable: false,
      },
    ]);
  });

  it('rejects incomplete or unsupported CSV files', () => {
    expect(() => parseTimeEntryCsv('')).toThrow('header row');
    expect(() => parseTimeEntryCsv('Date,Start time,End time\n2026-10-19,09:00,10:00')).toThrow(
      'Project and Task',
    );
  });

  it('rejects running rows and invalid timestamps instead of silently dropping them', () => {
    const runningCsv = [
      'Date,Start time,End time,Project,Task,Billable',
      '2026-10-19,09:00,,Website,Design,Yes',
    ].join('\n');
    const invalidDateCsv = [
      'Date,Start time,End time,Project,Task,Billable',
      '2026-02-30,09:00,10:00,Website,Design,Yes',
    ].join('\n');

    expect(() => parseTimeEntryCsv(runningCsv)).toThrow('invalid local end date or time');
    expect(() => parseTimeEntryCsv(invalidDateCsv)).toThrow('invalid local start date or time');
  });

  it('rejects normalized impossible ISO dates', () => {
    const csv = [
      'Start timestamp (ISO),End timestamp (ISO),Project,Task',
      '2026-02-30T09:00:00.000Z,2026-02-30T10:00:00.000Z,Website,Design',
    ].join('\n');

    expect(() => parseTimeEntryCsv(csv)).toThrow('invalid ISO start timestamp');
  });

  it('rejects rows with end times before their start times', () => {
    const csv = [
      'Date,Start time,End time,Project,Task,Billable',
      '2026-10-19,10:00,09:00,Website,Design,Yes',
    ].join('\n');

    expect(() => parseTimeEntryCsv(csv)).toThrow('end time after its start time');
  });
});
