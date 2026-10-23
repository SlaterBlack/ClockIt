import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
  let httpMock: HttpTestingController;
  let downloads: Download[];

  const setEntries = (entries: TimeEntry[]) => {
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('startDate', '2026-10-19');
    fixture.componentRef.setInput('endDate', '2026-10-25');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportExportPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ReportExportPanel);
    httpMock = TestBed.inject(HttpTestingController);
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

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('downloads the filtered entries as CSV named after the date range', async () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);

    findButton('Export CSV').click();

    expect(downloads[0].filename).toBe('time-report_2026-10-19_to_2026-10-25.csv');
    expect(await downloads[0].blob.text()).toContain('Website');
  });

  it('disables CSV export when the report has no entries', () => {
    setEntries([]);

    expect(findButton('Export CSV').disabled).toBe(true);
  });

  it('requires an earnings rate for every pay type used before downloading', () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);
    fixture.componentInstance.toggleXero();
    fixture.componentInstance.setEarningsRate('hourly', '  ');
    fixture.detectChanges();

    fixture.componentInstance.exportXero();
    fixture.detectChanges();

    expect(downloads).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('required');
  });

  it('ignores blank earnings rates for pay types that are not in the report', async () => {
    setEntries([makeEntry('e1', true, new Date(2026, 9, 19, 10).toISOString())]);
    fixture.componentInstance.setEarningsRate('sick-leave', '');

    fixture.componentInstance.exportXero();

    expect(fixture.componentInstance.errorMessage()).toBeNull();
    expect(downloads).toHaveLength(1);
  });

  it('refuses a Xero export when no entry is complete', () => {
    setEntries([makeEntry('e1', true, null)]);

    fixture.componentInstance.exportXero();

    expect(downloads).toHaveLength(0);
    expect(fixture.componentInstance.errorMessage()).toContain('no completed entries');
  });

  it('downloads a Xero payroll timesheet CSV using the mapped earnings rate per pay type', async () => {
    const leave = makeEntry('e1', false, new Date(2026, 9, 19, 10).toISOString());
    leave.task = { id: 't2', name: 'Leave', payType: 'annual-leave' };
    setEntries([leave]);
    const panel = fixture.componentInstance;
    panel.setEarningsRate('annual-leave', 'Annual Leave (AL)');

    panel.exportXero();

    expect(panel.errorMessage()).toBeNull();
    expect(downloads[0].filename).toBe('xero-timesheets_2026-10-19_to_2026-10-25.csv');
    expect(await downloads[0].blob.text()).toContain('Alex Doe,19/10/2026,Annual Leave (AL),1.00');
  });

  it('previews a selected report CSV and imports the entries after confirmation', async () => {
    const csv = [
      'Date,Start time,End time,Start timestamp (ISO),End timestamp (ISO),Project,Task,Description,Billable',
      '2026-10-19,09:00,10:00,2026-10-19T09:00:00.000Z,2026-10-19T10:00:00.000Z,Website,Design,Wireframes,Yes',
    ].join('\r\n');
    const file = new File([csv], 'backup.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(csv),
    });
    const input = { files: [file], value: 'backup.csv' } as unknown as HTMLInputElement;

    await fixture.componentInstance.onCsvSelected({ target: input } as unknown as Event);

    expect(fixture.componentInstance.pendingImport()).toHaveLength(1);
    expect(fixture.componentInstance.importFileName()).toBe('backup.csv');
    expect(fixture.componentInstance.importErrorMessage()).toBeNull();

    fixture.componentInstance.importCsv();

    const request = httpMock.expectOne((req) => req.url.endsWith('/time-entries/import'));
    expect(request.request.body.entries).toHaveLength(1);
    request.flush({
      importedCount: 1,
      skippedCount: 0,
      createdProjectCount: 1,
      createdTaskCount: 1,
    });
    expect(fixture.componentInstance.importSuccessMessage()).toContain('Imported 1 entry');
    expect(fixture.componentInstance.importSuccessMessage()).toContain('created 1 project');
    expect(fixture.componentInstance.importSuccessMessage()).toContain('created 1 task');
  });

  function findButton(label: string): HTMLButtonElement {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
    if (!button) {
      throw new Error(`Could not find button "${label}".`);
    }
    return button;
  }
});
