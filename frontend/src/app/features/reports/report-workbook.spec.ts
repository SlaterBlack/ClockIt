import { strFromU8, unzipSync } from 'fflate';
import type { PayType } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
import { buildTimeReportWorkbook } from './report-workbook';
import type { ToilSettingsResponse } from '../../core/models/toil.model';

function makeEntry(
  id: string,
  userId: string,
  userName: string,
  startTime: Date,
  durationSeconds: number,
  endTime: string | null = new Date(startTime.getTime() + durationSeconds * 1000).toISOString(),
  description = '',
  payType: PayType = 'hourly',
): TimeEntry {
  return {
    id,
    description,
    startTime: startTime.toISOString(),
    endTime,
    durationSeconds: endTime ? durationSeconds : null,
    isBillable: true,
    userId,
    projectId: 'p1',
    taskId: 't1',
    project: { id: 'p1', name: 'Website', projectNumber: null },
    task: { id: 't1', name: 'Design', payType },
    user: { id: userId, name: userName },
    createdAt: '',
    updatedAt: '',
  };
}

describe('time report workbook', () => {
  it('shows per-user pay-type totals and per-entry details for all users', async () => {
    const now = new Date(2026, 9, 19, 12).getTime();
    const entries = [
      makeEntry('e1', 'u1', 'Alex Doe', new Date(2026, 9, 19, 9), 5400),
      makeEntry(
        'e2',
        'u2',
        'Blake Roe',
        new Date(2026, 9, 20, 9),
        9000,
        undefined,
        '',
        'annual-leave',
      ),
      makeEntry('e5', 'u2', 'Blake Roe', new Date(2026, 9, 20, 10), 3600, undefined, '', 'unpaid'),
      makeEntry('e3', 'u2', 'Blake Roe', new Date(2026, 9, 26, 9), 3600, undefined, 'out of range'),
      makeEntry('e4', 'u1', 'Alex Doe', new Date(2026, 9, 19, 11), 0, null, 'running'),
    ];
    const workbook = buildTimeReportWorkbook(entries, now, '2026-10-19', '2026-10-25');
    const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()));
    const workbookXml = strFromU8(files['xl/workbook.xml']);
    const summaryXml = strFromU8(files['xl/worksheets/sheet1.xml']);
    const detailsXml = strFromU8(files['xl/worksheets/sheet2.xml']);

    expect(workbookXml).toContain('name="Page 1 - User Summary"');
    expect(workbookXml).toContain('name="Page 2 - Entry Details"');
    expect(summaryXml).toContain('Name');
    expect(summaryXml).toContain('Total Paid Hours');
    expect(summaryXml).toContain('Hourly Wage');
    expect(summaryXml).toContain('Annual Leave');
    expect(summaryXml).toContain('Unpaid');
    expect(summaryXml).toContain('Public Holiday');
    expect(summaryXml).toContain('Sick Leave');
    expect(summaryXml).toContain('TOIL Accrued');
    expect(summaryXml).toContain('TOIL Used');
    expect(summaryXml).toContain('Alex Doe');
    expect(summaryXml).toContain('Blake Roe');
    expect(summaryXml).toContain('Report total');
    expect(summaryXml).toContain('<v>2.5</v>');
    expect(summaryXml).toContain('<v>5</v>');
    expect(summaryXml.match(/<v>1<\/v>/g)).toHaveLength(2);
    expect(summaryXml.match(/<row /g)).toHaveLength(6);
    expect(detailsXml).toContain('running');
    expect(detailsXml).not.toContain('out of range');
    expect(detailsXml.match(/<row /g)).toHaveLength(5);
  });

  it('calculates prorated TOIL, records usage, and bolds the paid-hours column', async () => {
    const now = new Date(2026, 9, 19, 12).getTime();
    const settings: ToilSettingsResponse = {
      accrualMultiplier: 1.5,
      payCycle: { startDate: '2026-10-13', periodDays: 14 },
      users: [
        {
          id: 'u1',
          name: 'Alex Doe',
          email: 'alex@example.com',
          role: 'user',
          contractedHoursPerCycle: 2,
        },
        {
          id: 'u2',
          name: 'Blake Roe',
          email: 'blake@example.com',
          role: 'user',
          contractedHoursPerCycle: null,
        },
      ],
      usages: [
        {
          id: 'usage-1',
          userId: 'u1',
          userName: 'Alex Doe',
          usageDate: '2026-10-20',
          hours: 0.25,
          reason: null,
          recordedBy: 'admin',
          createdAt: '',
        },
      ],
    };
    const workbook = buildTimeReportWorkbook(
      [makeEntry('e1', 'u1', 'Alex Doe', new Date(2026, 9, 19, 9), 5400)],
      now,
      '2026-10-19',
      '2026-10-25',
      settings,
    );
    const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()));
    const summaryXml = strFromU8(files['xl/worksheets/sheet1.xml']);
    const stylesXml = strFromU8(files['xl/styles.xml']);

    expect(summaryXml).toContain('s="3"><v>1.5</v>');
    expect(summaryXml).toContain('s="1"><v>0.75</v>');
    expect(summaryXml).toContain('s="1"><v>0.25</v>');
    expect(summaryXml).toContain('s="3"><v>0.75</v>');
    expect(stylesXml).toContain('<b/>');
  });

  it('requires a contract before calculating hourly TOIL accrual', () => {
    const settings: ToilSettingsResponse = {
      accrualMultiplier: 1,
      payCycle: { startDate: '2026-10-13', periodDays: 14 },
      users: [
        {
          id: 'u1',
          name: 'Alex Doe',
          email: 'alex@example.com',
          role: 'user',
          contractedHoursPerCycle: null,
        },
      ],
      usages: [],
    };

    expect(() =>
      buildTimeReportWorkbook(
        [makeEntry('e1', 'u1', 'Alex Doe', new Date(2026, 9, 19, 9), 3600)],
        0,
        '2026-10-19',
        '2026-10-25',
        settings,
      ),
    ).toThrow('Set contracted hours for Alex Doe');
  });
});
