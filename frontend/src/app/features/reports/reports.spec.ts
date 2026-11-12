import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Auth } from '../../core/services/auth';
import { localDateKey } from './report-export';
import { Reports } from './reports';

describe('Reports', () => {
  let component: Reports;
  let fixture: ComponentFixture<Reports>;
  let httpMock: HttpTestingController;
  let adminStatus: WritableSignal<boolean>;

  beforeEach(async () => {
    adminStatus = signal(false);
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { isAdmin: adminStatus } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Reports);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the current user report data and calculates summary totals', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [
          { id: 'u1', name: 'Current User' },
          { id: 'u2', name: 'Other User' },
        ],
        currentUserId: 'u1',
      });
    const currentUserRequest = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'u1',
    );
    currentUserRequest.flush({
      timeEntries: [
        makeEntry('e1', new Date(2026, 9, 19, 9), 3600, true, 'p1', 't1', 'Design'),
        makeEntry('e2', new Date(2026, 9, 19, 11), 7200, false, 'p1', 't2', 'Review'),
        makeEntry('e3', new Date(2026, 9, 20, 13), 3600, true, 'p2', 't3', 'Build'),
      ],
    });
    component.startDate.set('2026-10-19');
    component.endDate.set('2026-10-20');
    fixture.detectChanges();

    expect(component.totalDurationSeconds()).toBe(14_400);
    expect(component.billableDurationSeconds()).toBe(7_200);
    expect(component.nonBillableDurationSeconds()).toBe(7_200);
    expect(component.projectSummaries().map((project) => project.id)).toEqual(['p1', 'p2']);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
    expect(component.selectedUserIds()).toEqual(['u1']);
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Current User');
    expect(fixture.nativeElement.querySelector('.report-entry-actions-trigger')).toBeNull();
  });

  it('lets admins edit another user’s entry from the detailed report', () => {
    adminStatus.set(true);
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [
          { id: 'u1', name: 'Current User' },
          { id: 'u2', name: 'Other User' },
        ],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne(
        (request) =>
          request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'u1',
      )
      .flush({ timeEntries: [] });

    const entry = {
      ...makeEntry('e2', new Date(2026, 9, 19, 11), 3600, true, 'p1', 't1', 'Design'),
      userId: 'u2',
      user: { id: 'u2', name: 'Other User' },
    };
    component.startDate.set('');
    component.endDate.set('');
    component.selectedUserIds.set(['u1', 'u2']);
    component.timeEntries.set([entry]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.report-entry-actions-trigger') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Edit entry for Other User"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    httpMock
      .expectOne((request) => request.url.endsWith('/workspaces'))
      .flush({ workspaces: [{ id: 'w1', name: 'Shared workspace' }] });
    httpMock
      .expectOne(
        (request) =>
          request.url.endsWith('/projects') &&
          request.params.get('workspaceId') === 'w1' &&
          request.params.get('includeTasks') === 'true' &&
          request.params.get('includeArchived') === 'true',
      )
      .flush({
        projects: [
          {
            id: 'p1',
            name: 'Project one',
            workspaceId: 'w1',
            tasks: [{ id: 't1', name: 'Design', projectId: 'p1' }],
          },
        ],
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Editing entry for Other User');
    component.updateEntryEditDraft({ description: 'Updated by admin' });
    component.saveEntryEdit();

    const updateRequest = httpMock.expectOne(
      (request) => request.url.endsWith('/time-entries/admin/e2') && request.method === 'PATCH',
    );
    expect(updateRequest.request.body).toEqual(
      expect.objectContaining({
        taskId: 't1',
        description: 'Updated by admin',
        isBillable: true,
        endTime: expect.any(String),
      }),
    );
    expect(updateRequest.request.body.userId).toBeUndefined();
    const updatedEntry = { ...entry, description: 'Updated by admin' };
    updateRequest.flush({ timeEntry: updatedEntry });
    const refreshedReport = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'all',
    );
    refreshedReport.flush({ timeEntries: [updatedEntry] });
    fixture.detectChanges();

    expect(component.editingEntry()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Updated by admin');
  });

  it('lets admins delete report entries after confirming in a popup', () => {
    adminStatus.set(true);
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [
          { id: 'u1', name: 'Current User' },
          { id: 'u2', name: 'Other User' },
        ],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne(
        (request) =>
          request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'u1',
      )
      .flush({ timeEntries: [] });

    const entry = {
      ...makeEntry('e2', new Date(2026, 9, 19, 11), 3600, true, 'p1', 't1', 'Design'),
      userId: 'u2',
      user: { id: 'u2', name: 'Other User' },
    };
    component.startDate.set('');
    component.endDate.set('');
    component.selectedUserIds.set(['u1', 'u2']);
    component.timeEntries.set([entry]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.report-entry-actions-trigger') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Delete entry for Other User"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Delete the entry for Other User?');
    (
      fixture.nativeElement.querySelector(
        '.entry-delete-dialog .btn-secondary',
      ) as HTMLButtonElement
    ).click();
    expect(component.pendingRemovalEntry()).toBeNull();
    httpMock.expectNone((request) => request.method === 'DELETE');

    (
      fixture.nativeElement.querySelector('.report-entry-actions-trigger') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Delete entry for Other User"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.entry-delete-dialog .btn-danger') as HTMLButtonElement
    ).click();

    httpMock
      .expectOne(
        (request) => request.method === 'DELETE' && request.url.endsWith('/time-entries/admin/e2'),
      )
      .flush(null);
    httpMock
      .expectOne(
        (request) =>
          request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'all',
      )
      .flush({ timeEntries: [] });
    fixture.detectChanges();

    expect(component.pendingRemovalEntry()).toBeNull();
    expect(component.timeEntries()).toEqual([]);
  });

  it('paginates detailed report entries and supports the configured page sizes', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({ users: [{ id: 'u1', name: 'Current User' }], currentUserId: 'u1' });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({
        timeEntries: Array.from({ length: 31 }, (_, index) =>
          makeEntry(
            `e${index + 1}`,
            new Date(2026, 9, 19, 9, index),
            3600,
            true,
            'p1',
            't1',
            'Design',
          ),
        ),
      });
    component.startDate.set('');
    component.endDate.set('');
    fixture.detectChanges();

    const pageSizeSelect = fixture.nativeElement.querySelector(
      '[aria-label="Entries per page"]',
    ) as HTMLSelectElement;
    expect(component.pageSize()).toBe(25);
    expect([...pageSizeSelect.options].map((option) => option.textContent.trim())).toEqual([
      '25',
      '50',
      '100',
      '150',
    ]);
    expect(component.totalPages()).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(25);

    component.showNextPage();
    fixture.detectChanges();
    expect(component.currentPageNumber()).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(6);

    pageSizeSelect.options[1].selected = true;
    pageSizeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.currentPageNumber()).toBe(1);
    expect(component.totalPages()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(31);
    expect(component.pageSize()).toBe(50);
  });

  it('shows last week next to this week and selects the previous Monday-to-Sunday range', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({ users: [{ id: 'u1', name: 'Current User' }], currentUserId: 'u1' });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({ timeEntries: [] });

    const buttons = [
      ...fixture.nativeElement.querySelectorAll('.date-presets button'),
    ] as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent.trim())).toEqual([
      'Today',
      'This week',
      'Last week',
      'Last month',
      'Year to date',
    ]);

    const today = new Date();
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const expectedStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expectedStart.setDate(expectedStart.getDate() - daysSinceMonday - 7);
    const expectedEnd = new Date(expectedStart);
    expectedEnd.setDate(expectedEnd.getDate() + 6);

    buttons[2].click();
    fixture.detectChanges();

    expect(component.datePreset()).toBe('last-week');
    expect(component.startDate()).toBe(localDateKey(expectedStart));
    expect(component.endDate()).toBe(localDateKey(expectedEnd));
  });

  it('filters detailed entries by date, project, task, and billable status', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [{ id: 'u1', name: 'Current User' }],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({
        timeEntries: [
          makeEntry('e1', new Date(2026, 9, 19, 9), 3600, true, 'p1', 't1', 'Design'),
          makeEntry('e2', new Date(2026, 9, 19, 11), 7200, false, 'p1', 't2', 'Review'),
          makeEntry('e3', new Date(2026, 9, 20, 13), 3600, true, 'p2', 't3', 'Build'),
        ],
      });
    component.startDate.set('2026-10-19');
    component.endDate.set('2026-10-20');
    component.onProjectFilterChange('p1');
    component.taskFilter.set('t2');
    component.billableFilter.set('non-billable');
    fixture.detectChanges();

    expect(component.filteredEntries().map((entry) => entry.id)).toEqual(['e2']);
    expect(component.totalDurationSeconds()).toBe(7200);
    expect(component.projectOptions().map((project) => project.id)).toEqual(['p2', 'p1']);
    expect(component.taskOptions().map((task) => task.id)).toEqual(['t1', 't2']);

    component.onProjectFilterChange('p2');
    component.billableFilter.set('all');
    expect(component.taskFilter()).toBe('');
    expect(component.filteredEntries().map((entry) => entry.id)).toEqual(['e3']);
  });

  it('loads multiple selected users and filters entries when one member is deselected', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [
          { id: 'u1', name: 'Current User' },
          { id: 'u2', name: 'Other User' },
        ],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({ timeEntries: [] });
    fixture.detectChanges();

    component.startDate.set('2026-10-19');
    component.endDate.set('2026-10-20');
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Filter by team member"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const otherUserCheckbox = fixture.nativeElement.querySelector(
      '[aria-label="Include Other User"]',
    ) as HTMLInputElement;
    expect(
      otherUserCheckbox.closest('.report-user-option')?.classList.contains('is-selected'),
    ).toBe(false);
    otherUserCheckbox.checked = true;
    otherUserCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    const allUsersRequest = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'all',
    );
    allUsersRequest.flush({
      timeEntries: [
        {
          ...makeEntry('e1', new Date(2026, 9, 19, 9), 3600, true, 'p1', 't1', 'Design'),
          userId: 'u1',
          user: { id: 'u1', name: 'Current User' },
        },
        {
          ...makeEntry('e2', new Date(2026, 9, 19, 11), 3600, true, 'p2', 't2', 'Build'),
          userId: 'u2',
          user: { id: 'u2', name: 'Other User' },
        },
      ],
    });
    fixture.detectChanges();

    expect(component.filteredEntries().map((entry) => entry.user?.name)).toEqual([
      'Other User',
      'Current User',
    ]);
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Other User');

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Select only Other User"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const selectedUserRequest = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'u2',
    );
    selectedUserRequest.flush({
      timeEntries: [
        {
          ...makeEntry('e2', new Date(2026, 9, 19, 11), 3600, true, 'p2', 't2', 'Build'),
          userId: 'u2',
          user: { id: 'u2', name: 'Other User' },
        },
      ],
    });
    fixture.detectChanges();
    expect(component.selectedUserIds()).toEqual(['u2']);
    expect(component.filteredEntries().map((entry) => entry.user?.name)).toEqual(['Other User']);

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Filter by team member"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    [...fixture.nativeElement.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'All users')
      ?.click();
    fixture.detectChanges();
    const allUsersSelectionRequest = httpMock.expectOne(
      (request) =>
        request.url.endsWith('/reports/time-entries') && request.params.get('userId') === 'all',
    );
    allUsersSelectionRequest.flush({ timeEntries: [] });
    expect(component.selectedUserIds()).toEqual(['u1', 'u2']);
  });

  it('clears entries when no team members are selected', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [{ id: 'u1', name: 'Current User' }],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({
        timeEntries: [makeEntry('e1', new Date(2026, 9, 19, 9), 3600, true, 'p1', 't1', 'Design')],
      });
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Filter by team member"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const currentUserCheckbox = fixture.nativeElement.querySelector(
      '[aria-label="Include Current User"]',
    ) as HTMLInputElement;
    currentUserCheckbox.checked = false;
    currentUserCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedUserIds()).toEqual([]);
    expect(component.filteredEntries()).toEqual([]);
    expect(component.isLoading()).toBe(false);
    httpMock.expectNone((request) => request.url.endsWith('/reports/time-entries'));
  });

  it('reports errors when the time-entry request fails', () => {
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/users'))
      .flush({
        users: [{ id: 'u1', name: 'Current User' }],
        currentUserId: 'u1',
      });
    httpMock
      .expectOne((request) => request.url.endsWith('/reports/time-entries'))
      .flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toContain('Could not load report data');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  function makeEntry(
    id: string,
    start: Date,
    durationSeconds: number,
    isBillable: boolean,
    projectId: string,
    taskId: string,
    taskName: string,
  ) {
    const projectName = projectId === 'p1' ? 'Sydney Opera House' : 'George Street';
    return {
      id,
      description: taskName,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + durationSeconds * 1000).toISOString(),
      durationSeconds,
      isBillable,
      userId: 'u1',
      projectId,
      taskId,
      project: { id: projectId, name: projectName, projectNumber: null },
      task: { id: taskId, name: taskName },
      user: { id: 'u1', name: 'Current User' },
      createdAt: '',
      updatedAt: '',
    };
  }
});
