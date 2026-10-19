import type { TimeEntry } from '../../core/models/time-entry.model';
import {
  buildReportCsv,
  buildXeroInvoiceCsv,
  entryDurationSeconds,
  invoiceableEntries,
} from './report-export';

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
    expect(row).toBe(
      '2026-10-19,09:00,10:30,Alex Doe,101,Website,Design,Wireframes,Yes,01:30:00,1.50',
    );
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

  it('only invoices completed billable entries', () => {
    const entries = [
      makeEntry({ id: 'a' }),
      makeEntry({ id: 'b', isBillable: false }),
      makeEntry({ id: 'c', endTime: null }),
    ];

    expect(invoiceableEntries(entries).map((entry) => entry.id)).toEqual(['a']);
  });

  it('groups invoiceable time by project and task into Xero invoice lines', () => {
    const csv = buildXeroInvoiceCsv(
      [
        makeEntry({ id: 'a' }),
        makeEntry({ id: 'b', durationSeconds: 1800 }),
        makeEntry({
          id: 'c',
          taskId: 't2',
          task: { id: 't2', name: 'Build' },
          durationSeconds: 3600,
        }),
        makeEntry({ id: 'd', isBillable: false }),
      ],
      {
        contactName: 'Acme Ltd',
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-10-31',
        dueDate: '2026-11-30',
        hourlyRate: 85,
        accountCode: '200',
        taxType: 'Tax Exempt',
        reference: '2026-10-19 to 2026-10-25',
      },
    );
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');

    expect(lines[0]).toBe(
      '*ContactName,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,*Description,*Quantity,*UnitAmount,*AccountCode,*TaxType',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      'Acme Ltd,INV-001,2026-10-19 to 2026-10-25,31/10/2026,30/11/2026,Website - Build,1.00,85.00,200,Tax Exempt',
    );
    expect(lines[2]).toContain('Website - Design,2.00,85.00');
  });
});
