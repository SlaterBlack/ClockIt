import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    httpMock
      .expectOne((request) => request.url.endsWith('/time-entries'))
      .flush({ timeEntries: [] });
    httpMock.expectOne((request) => request.url.endsWith('/workspaces')).flush({ workspaces: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('paginates time entries by week and prevents navigating into future weeks', () => {
    const currentWeekStart = new Date(component.weekStart());
    const currentEntryStart = new Date(currentWeekStart);
    currentEntryStart.setHours(9, 0, 0, 0);
    const previousEntryStart = new Date(currentEntryStart);
    previousEntryStart.setDate(previousEntryStart.getDate() - 7);
    const makeEntry = (id: string, description: string, startTime: Date) => ({
      id,
      description,
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + 3600_000).toISOString(),
      durationSeconds: 3600,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      project: {
        id: 'p1',
        name: description,
        projectNumber: null,
        color: '#2D6A4F',
        isBillable: true,
        workspaceId: 'w1',
        archived: false,
        createdAt: '',
        updatedAt: '',
      },
      task: { id: 't1', name: 'Design', projectId: 'p1', createdAt: '', updatedAt: '' },
      createdAt: '',
      updatedAt: '',
    });
    component.timeEntries.set([
      makeEntry('e1', 'Current week', currentEntryStart),
      makeEntry('e2', 'Previous week', previousEntryStart),
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-day')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.entry-project-task').textContent).toContain(
      'Current week',
    );
    expect(
      (fixture.nativeElement.querySelector('[aria-label="Next week"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    (fixture.nativeElement.querySelector('[aria-label="Previous week"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-day')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.entry-project-task').textContent).toContain(
      'Previous week',
    );
    expect(
      (fixture.nativeElement.querySelector('[aria-label="Next week"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('does not start a timer without a task', () => {
    component.startTimer();

    expect(component.errorMessage()).toContain('Select a project and task');
    httpMock.expectNone((request) => request.url.endsWith('/time-entries/start'));
  });

  it('saves the running timer before starting a timer from a prior entry', () => {
    const entry = {
      id: 'e2',
      description: 'Prepare annual leave',
      startTime: '2026-10-19T09:00:00.000Z',
      endTime: '2026-10-19T10:00:00.000Z',
      durationSeconds: 3600,
      isBillable: false,
      userId: 'u1',
      projectId: 'p2',
      taskId: 't2',
      createdAt: '',
      updatedAt: '',
    };
    component.runningEntry.set({
      ...entry,
      id: 'e1',
      description: 'Current work',
      endTime: null,
      durationSeconds: null,
      projectId: 'p1',
      taskId: 't1',
    });
    component.runningTimerEdit.set({
      projectId: 'p1',
      taskId: 't1',
      startTime: '2026-10-20T09:00',
    });

    component.startTimerFromEntry(entry);

    const stop = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/time-entries/e1/stop'),
    );
    expect(stop.request.body).toEqual({
      taskId: 't1',
      startTime: new Date('2026-10-20T09:00').toISOString(),
    });
    httpMock.expectNone((req) => req.url.endsWith('/time-entries/start'));

    stop.flush({ timeEntry: { ...entry, id: 'e1' } });
    const start = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/time-entries/start'),
    );
    expect(start.request.body).toEqual({ taskId: 't2', description: 'Prepare annual leave' });
    start.flush({ timeEntry: { ...entry, endTime: null } });
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/time-entries'))
      .flush({
        timeEntries: [],
      });

    expect(component.isSubmitting()).toBe(false);
  });

  it('creates a completed manual entry and refreshes the tracker', () => {
    component.openManualEntry();
    component.updateManualEntry({
      projectId: 'p1',
      taskId: 't1',
      description: 'Annual leave',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '17:00',
      isBillable: false,
    });
    component.saveManualEntry();

    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/time-entries'),
    );
    expect(request.request.body).toEqual({
      taskId: 't1',
      description: 'Annual leave',
      isBillable: false,
      startTime: new Date('2026-10-19T09:00').toISOString(),
      endTime: new Date('2026-10-19T17:00').toISOString(),
    });
    request.flush({ timeEntry: { id: 'e2' } });
    httpMock.expectOne((req) => req.url.endsWith('/time-entries')).flush({ timeEntries: [] });

    expect(component.isManualEntryOpen()).toBe(false);
    expect(component.isSavingManualEntry()).toBe(false);
  });

  it('uses the edit form date and typed-time controls for manual entries', () => {
    component.openManualEntry();
    component.updateManualEntry({
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '10:00',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.manual-entry-description')).not.toBeNull();
    const dateTimeFields = fixture.nativeElement.querySelector(
      '.manual-entry-form .entry-date-time-fields',
    );
    expect(dateTimeFields.querySelectorAll('app-date-time-picker')).toHaveLength(3);
    expect(dateTimeFields.querySelectorAll('.date-only-picker')).toHaveLength(1);
    expect(dateTimeFields.querySelectorAll('.time-only-picker')).toHaveLength(2);
    expect(dateTimeFields.querySelectorAll('.stacked-label-picker')).toHaveLength(3);
    expect(dateTimeFields.querySelectorAll('.manual-time-input[type="text"]')).toHaveLength(2);
    expect(dateTimeFields.querySelector('.clear-manual-time')).not.toBeNull();
    expect(dateTimeFields.querySelector('.entry-duration-preview strong').textContent).toBe('1h 0m');

    const endTimeInput = dateTimeFields
      .querySelectorAll('app-date-time-picker')[2]
      .querySelector('.manual-time-input') as HTMLInputElement;
    endTimeInput.value = '10:30';
    endTimeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.manualEntryDuration()).toBe('1h 30m');
    httpMock.expectNone((request) => request.method === 'POST');
  });

  it('requires confirmation before removing a time entry and refreshes the tracker', () => {
    const entry = {
      id: 'e1',
      description: 'Planning',
      startTime: '2026-10-19T09:00:00.000Z',
      endTime: '2026-10-19T10:00:00.000Z',
      durationSeconds: 3600,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      createdAt: '',
      updatedAt: '',
    };

    component.requestEntryRemoval(entry);

    expect(component.entryPendingRemovalId()).toBe('e1');
    httpMock.expectNone((request) => request.method === 'DELETE');

    component.removeEntry(entry);

    const request = httpMock.expectOne(
      (req) => req.method === 'DELETE' && req.url.endsWith('/time-entries/e1'),
    );
    request.flush(null);
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/time-entries'))
      .flush({ timeEntries: [] });

    expect(component.entryPendingRemovalId()).toBeNull();
    expect(component.isRemovingEntry()).toBe(false);
  });

  it('requires the manual entry to end after it starts', () => {
    component.openManualEntry();
    component.updateManualEntry({
      projectId: 'p1',
      taskId: 't1',
      date: '2026-10-19',
      startTime: '10:00',
      endTime: '09:00',
    });

    component.saveManualEntry();

    expect(component.manualEntryError()).toContain(
      'End time must be after start time on the same date',
    );
    httpMock.expectNone(
      (request) => request.method === 'POST' && request.url.endsWith('/time-entries'),
    );
  });

  it('saves running timer project, task, and start time when ending it', () => {
    const project = {
      id: 'p1',
      name: 'George Street',
      projectNumber: '742',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const task = { id: 't2', name: 'Documentation', projectId: 'p1', createdAt: '', updatedAt: '' };
    const running = {
      id: 'e1',
      description: 'Planning',
      startTime: '2026-10-19T00:00:00.000Z',
      endTime: null,
      durationSeconds: null,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      project,
      task: { id: 't1', name: 'Design' },
      createdAt: '',
      updatedAt: '',
    };
    component.projects.set([project]);
    component.runningEntry.set(running);
    component.runningTimerEdit.set({
      projectId: 'p1',
      taskId: 't1',
      startTime: '2026-10-19T00:00',
    });
    component.clockNow.set(new Date('2020-01-01T10:00').getTime());

    component.onRunningProjectChange('p1');
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p1/tasks'))
      .flush({ tasks: [task] });
    component.updateRunningTimerDraft({ taskId: task.id, startTime: '2020-01-01T09:30' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timer-start-time .date-trigger')).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '.running-timer-left select[aria-label="Project for running timer"]',
      ),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '.running-timer-left select[aria-label="Task for running timer"]',
      ),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.running-time-value').textContent.trim()).toBe(
      '00:30:00',
    );
    expect(
      fixture.nativeElement.querySelector('.running-timer-right .btn-danger').textContent.trim(),
    ).toBe('End');
    const startTime = fixture.nativeElement.querySelector(
      '.timer-start-time .manual-time-input',
    ) as HTMLInputElement;
    expect(startTime.value).toBe(
      new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
        new Date('2020-01-01T09:30'),
      ),
    );
    expect(fixture.nativeElement.querySelector('.timer-start-time .time-popover')).toBeNull();
    startTime.focus();
    fixture.detectChanges();
    expect(startTime.value).toBe('0930');
    startTime.value = '0940';
    startTime.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    startTime.blur();
    fixture.detectChanges();
    expect(component.runningTimerEdit()?.startTime).toBe('2020-01-01T09:40');
    component.updateRunningTimerDraft({ startTime: '2020-01-01T09:30' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.timer-card .btn-danger') as HTMLButtonElement).click();

    const stopRequest = httpMock.expectOne(
      (request) => request.method === 'POST' && request.url.endsWith('/time-entries/e1/stop'),
    );
    expect(stopRequest.request.body).toEqual({
      taskId: 't2',
      startTime: new Date('2020-01-01T09:30').toISOString(),
    });
    stopRequest.flush({
      timeEntry: {
        ...running,
        projectId: 'p1',
        taskId: 't2',
        startTime: new Date('2020-01-01T09:30').toISOString(),
        endTime: '2020-01-01T10:00:00.000Z',
      },
    });
    httpMock
      .expectOne((request) => request.url.endsWith('/time-entries'))
      .flush({ timeEntries: [] });

    expect(component.runningEntry()).toBeNull();
  });

  it('keeps the server start seconds and milliseconds when displaying and stopping a timer', () => {
    const exactStart = new Date(2026, 9, 20, 9, 0, 42, 321);
    const running = {
      id: 'e1',
      description: 'Current work',
      startTime: exactStart.toISOString(),
      endTime: null,
      durationSeconds: null,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      createdAt: '',
      updatedAt: '',
    };
    component.runningEntry.set(running);
    component.runningTimerEdit.set({
      projectId: 'p1',
      taskId: 't1',
      startTime: '2026-10-20T09:00',
      originalStartTime: exactStart.toISOString(),
    });
    component.clockNow.set(exactStart.getTime() + 5_321);

    expect(component.runningDuration()).toBe('00:00:05');

    component.endAndSaveRunningTimer();
    const stop = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/time-entries/e1/stop'),
    );
    expect(stop.request.body.startTime).toBe(exactStart.toISOString());
    stop.flush({
      timeEntry: {
        ...running,
        endTime: new Date(exactStart.getTime() + 5_321).toISOString(),
        durationSeconds: 5,
      },
    });
    httpMock
      .expectOne((req) => req.method === 'GET' && req.url.endsWith('/time-entries'))
      .flush({
        timeEntries: [],
      });
  });

  it('omits empty descriptions and keeps the custom date and typed-time controls', () => {
    const project = {
      id: 'p1',
      name: 'Sydney Opera House',
      projectNumber: '364',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const task = { id: 't1', name: 'Design', projectId: 'p1', createdAt: '', updatedAt: '' };
    component.weekStart.set(new Date(2026, 9, 12));
    component.timeEntries.set([
      {
        id: 'e1',
        description: '',
        startTime: '2026-10-18T09:00:00.000Z',
        endTime: '2026-10-18T10:00:00.000Z',
        durationSeconds: 3600,
        isBillable: true,
        userId: 'u1',
        projectId: 'p1',
        taskId: 't1',
        project,
        task,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.time-entry') as HTMLElement).click();
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p1/tasks'))
      .flush({ tasks: [task] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.entry-description')).toBeNull();
    const dateTimeFields = fixture.nativeElement.querySelector('.entry-date-time-fields');
    expect(dateTimeFields.querySelectorAll('app-date-time-picker')).toHaveLength(3);
    expect(dateTimeFields.querySelectorAll('.date-only-picker')).toHaveLength(1);
    expect(dateTimeFields.querySelectorAll('.time-only-picker')).toHaveLength(2);
    expect(dateTimeFields.querySelectorAll('.stacked-label-picker')).toHaveLength(3);
    expect(dateTimeFields.querySelectorAll('input[type="date"], input[type="time"]')).toHaveLength(
      0,
    );
    expect(dateTimeFields.querySelectorAll('.manual-time-input[type="text"]')).toHaveLength(2);
    expect(dateTimeFields.querySelector('.clear-manual-time')).not.toBeNull();
    expect(dateTimeFields.querySelector('.entry-duration-preview strong').textContent).toBe(
      '1h 0m',
    );

    const endTimeInput = dateTimeFields
      .querySelectorAll('app-date-time-picker')[2]
      .querySelector('.manual-time-input') as HTMLInputElement;
    endTimeInput.value = '10:30';
    endTimeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.editingDuration()).toBe('1h 30m');
    httpMock.expectNone((request) => request.method === 'PATCH');
  });

  it('opens only the time entry the user clicks', () => {
    const project = {
      id: 'p1',
      name: 'Sydney Opera House',
      projectNumber: '364',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const task = { id: 't1', name: 'Design', projectId: 'p1', createdAt: '', updatedAt: '' };
    const entries = ['e1', 'e2'].map((id) => ({
      id,
      description: '',
      startTime: '2026-10-18T09:00:00.000Z',
      endTime: '2026-10-18T10:00:00.000Z',
      durationSeconds: 3600,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      project,
      task,
      createdAt: '',
      updatedAt: '',
    }));
    component.weekStart.set(new Date(2026, 9, 12));
    component.timeEntries.set(entries);
    fixture.detectChanges();

    (fixture.nativeElement.querySelectorAll('.time-entry')[0] as HTMLElement).click();
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p1/tasks'))
      .flush({ tasks: [task] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.entry-edit-form').length).toBe(1);

    (fixture.nativeElement.querySelectorAll('.time-entry')[1] as HTMLElement).click();
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p1/tasks'))
      .flush({ tasks: [task] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-edit-form').length).toBe(1);
    expect(component.editingEntry()?.id).toBe('e2');
  });

  it('rejects an edited entry whose end precedes its start', () => {
    component.editingEntry.set({
      id: 'e1',
      projectId: 'p1',
      taskId: 't1',
      description: '',
      date: '2026-10-18',
      startTime: '10:00',
      endTime: '09:00',
      isBillable: true,
    });

    component.saveEntryEdit();

    expect(component.editingError()).toBe('End time must be after start time on the same date.');
    httpMock.expectNone((request) => request.method === 'PATCH');
  });

  it('groups entries by start date and moves an edited entry to its new day', () => {
    const project = {
      id: 'p1',
      name: 'Sydney Opera House',
      projectNumber: '364',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const task = { id: 't1', name: 'Design', projectId: 'p1', createdAt: '', updatedAt: '' };
    const replacementProject = {
      ...project,
      id: 'p2',
      name: 'George Street',
      projectNumber: '742',
    };
    const replacementTask = {
      id: 't2',
      name: 'Documentation',
      projectId: 'p2',
      createdAt: '',
      updatedAt: '',
    };
    const entry = {
      id: 'e1',
      description: 'Drafting',
      startTime: '2026-10-18T09:00:00.000Z',
      endTime: '2026-10-18T10:30:00.000Z',
      durationSeconds: 5400,
      isBillable: true,
      userId: 'u1',
      projectId: 'p1',
      taskId: 't1',
      project,
      task,
      createdAt: '',
      updatedAt: '',
    };
    component.projects.set([project, replacementProject]);
    component.weekStart.set(new Date(2026, 9, 12));
    component.timeEntries.set([
      entry,
      { ...entry, id: 'e2', startTime: '2026-10-17T11:00:00.000Z' },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-day').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.entry-project-task').textContent).toContain(
      '364 Sydney Opera House - Design',
    );
    expect(component.formatDuration(entry)).toBe('1h 30m');
    expect(fixture.nativeElement.querySelector('.entry-day-total').textContent.trim()).toBe(
      '1h 30m',
    );

    (fixture.nativeElement.querySelector('.time-entry') as HTMLElement).click();
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p1/tasks'))
      .flush({ tasks: [task] });
    component.onEditProjectChange('p2');
    httpMock
      .expectOne((request) => request.url.endsWith('/projects/p2/tasks'))
      .flush({ tasks: [replacementTask] });

    component.updateEntryDraft({
      taskId: 't2',
      date: '2026-10-16',
      startTime: '09:00',
      endTime: '11:00',
      description: 'Updated drafting',
      isBillable: false,
    });
    component.saveEntryEdit();

    const updateRequest = httpMock.expectOne(
      (request) => request.method === 'PATCH' && request.url.endsWith('/time-entries/e1'),
    );
    expect(updateRequest.request.body).toEqual({
      taskId: 't2',
      description: 'Updated drafting',
      isBillable: false,
      startTime: new Date('2026-10-16T09:00').toISOString(),
      endTime: new Date('2026-10-16T11:00').toISOString(),
    });
    const updatedStart = new Date('2026-10-16T09:00').toISOString();
    const updatedEnd = new Date('2026-10-16T11:00').toISOString();
    updateRequest.flush({ timeEntry: { ...entry, startTime: updatedStart } });

    httpMock
      .expectOne((request) => request.url.endsWith('/time-entries'))
      .flush({
        timeEntries: [
          {
            ...entry,
            projectId: 'p2',
            taskId: 't2',
            project: replacementProject,
            task: replacementTask,
            description: 'Updated drafting',
            startTime: updatedStart,
            endTime: updatedEnd,
            durationSeconds: 7200,
          },
          { ...entry, id: 'e2', startTime: '2026-10-17T11:00:00.000Z' },
        ],
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-day').length).toBe(2);
    const movedTo = new Date(updatedStart);
    const movedDayKey = `${movedTo.getFullYear()}-${String(movedTo.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(movedTo.getDate()).padStart(2, '0')}`;
    expect(component.entryDays().map((day) => day.key)).toContain(movedDayKey);
  });
});
