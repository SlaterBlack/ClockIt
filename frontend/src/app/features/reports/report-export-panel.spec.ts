import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { TimeEntry } from '../../core/models/time-entry.model';
import { ReportExportPanel } from './report-export-panel';

interface Download {
  filename: string;
  blob: Blob;
}

function makeEntry(id: string, isBillable: boolean, endTime: string | null): TimeEntry {
  return {
    id,
    description: '',
    startTime: new Date(2026, 9, 19, 9).toISOString(),
    endTime,
    durationSeconds: endTime ? 3600 : null,
    isBillable,
    userId: 'u1',
    projectId: 'p1',
    taskId: 't1',
    project: { id: 'p1', name: 'Website', projectNumber: '101' },
    task: { id: 't1', name: 'Design' },
    user: { id: 'u1', name: 'Alex Doe' },
    createdAt: '',
    updatedAt: '',
  };
}

describe('ReportExportPanel', () => {
  let fixture: ComponentFixture<ReportExportPanel>;
  let downloads: Download[];

  const setEntries = (entries: TimeEntry[]) => {
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('startDate', '2026-10-19');
    fixture.componentRef.setInput('endDate', '2026-10-25');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportExportPanel] }).compileComponents();
    fixture = TestBed.createComponent(ReportExportPanel);
    downloads = [];
    let lastBlob: Blob;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      lastBlob = blob;
      return 'blob:report';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ filename: this.download, blob: lastBlob });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('downloads the filtered entries as CSV named after the date range', async () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);

    fixture.nativeElement.querySelector('.export-actions button').click();

    expect(downloads[0].filename).toBe('time-report_2026-10-19_to_2026-10-25.csv');
    expect(await downloads[0].blob.text()).toContain('Website');
  });

  it('disables CSV export when the report has no entries', () => {
    setEntries([]);

    expect(fixture.nativeElement.querySelector('.export-actions button').disabled).toBe(true);
  });

  it('validates the Xero form before downloading', () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);
    fixture.componentInstance.toggleXero();
    fixture.detectChanges();

    fixture.componentInstance.exportXero();
    fixture.detectChanges();

    expect(downloads).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('required');
  });

  it('refuses a Xero export when nothing is billable and complete', () => {
    setEntries([makeEntry('e1', false, new Date(2026, 9, 19, 10).toISOString())]);

    fixture.componentInstance.exportXero();

    expect(downloads).toHaveLength(0);
    expect(fixture.componentInstance.errorMessage()).toContain('no completed billable');
  });

  it('downloads a Xero invoice CSV once the form is valid', async () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);
    const panel = fixture.componentInstance;
    panel.contactName.set('Acme Ltd');
    panel.invoiceNumber.set('INV-001');
    panel.hourlyRate.set(90);

    panel.exportXero();

    expect(panel.errorMessage()).toBeNull();
    expect(downloads[0].filename).toBe('xero-invoice_2026-10-19_to_2026-10-25.csv');
    expect(await downloads[0].blob.text()).toContain('Acme Ltd,INV-001');
  });
});
