import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Dashboard } from './dashboard';
import { DateTimePicker } from './date-time-picker';

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
    httpMock.expectOne((request) => request.url.endsWith('/time-entries')).flush({ timeEntries: [] });
    httpMock.expectOne((request) => request.url.endsWith('/workspaces')).flush({ workspaces: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not start a timer without a task', () => {
    component.startTimer();

    expect(component.errorMessage()).toContain('Select a project and task');
    httpMock.expectNone((request) => request.url.endsWith('/time-entries/start'));
  });

  it('saves running timer project, task, and start time when ending it', () => {
    const project = {
      id: 'p1',
      name: 'George Street',
      projectNumber: '742',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
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
    httpMock.expectOne((request) => request.url.endsWith('/projects/p1/tasks')).flush({ tasks: [task] });
    component.updateRunningTimerDraft({ taskId: task.id, startTime: '2020-01-01T09:30' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timer-start-time .date-trigger')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.running-timer-left select[aria-label="Project for running timer"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.running-timer-left select[aria-label="Task for running timer"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.running-time-value').textContent.trim()).toBe('00:30:00');
    expect(fixture.nativeElement.querySelector('.running-timer-right .btn-danger').textContent.trim()).toBe('End');
    (fixture.nativeElement.querySelector('.timer-start-time .time-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const startPicker = fixture.debugElement.query(By.directive(DateTimePicker)).componentInstance as DateTimePicker;
    expect(startPicker.selectedHour()).toBe('09');
    expect(startPicker.selectedMinute()).toBe('30');
    (fixture.nativeElement.querySelector('.timer-start-time .time-trigger') as HTMLButtonElement).click();
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
    httpMock.expectOne((request) => request.url.endsWith('/time-entries')).flush({ timeEntries: [] });

    expect(component.runningEntry()).toBeNull();
  });

  it('omits empty descriptions and uses non-typable date-time pickers', () => {
    const project = {
      id: 'p1',
      name: 'Sydney Opera House',
      projectNumber: '364',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      createdAt: '',
      updatedAt: '',
    };
    const task = { id: 't1', name: 'Design', projectId: 'p1', createdAt: '', updatedAt: '' };
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
    httpMock.expectOne((request) => request.url.endsWith('/projects/p1/tasks')).flush({ tasks: [task] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.entry-description')).toBeNull();
    const dateTimeFields = fixture.nativeElement.querySelector('.entry-date-time-fields');
    expect(dateTimeFields.children.length).toBe(2);
    expect(dateTimeFields.querySelectorAll('app-date-time-picker').length).toBe(2);
    expect(dateTimeFields.querySelectorAll('input[type="datetime-local"]').length).toBe(0);
  });

  it('opens only the time entry the user clicks', () => {
    const project = {
      id: 'p1',
      name: 'Sydney Opera House',
      projectNumber: '364',
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
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
    component.timeEntries.set(entries);
    fixture.detectChanges();

    (fixture.nativeElement.querySelectorAll('.time-entry')[0] as HTMLElement).click();
    httpMock.expectOne((request) => request.url.endsWith('/projects/p1/tasks')).flush({ tasks: [task] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.entry-edit-form').length).toBe(1);

    (fixture.nativeElement.querySelectorAll('.time-entry')[1] as HTMLElement).click();
    httpMock.expectOne((request) => request.url.endsWith('/projects/p1/tasks')).flush({ tasks: [task] });
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
      startTime: '2026-10-18T10:00',
      endTime: '2026-10-18T09:00',
      isBillable: true,
    });

    component.saveEntryEdit();

    expect(component.editingError()).toBe('End time must be after start time.');
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
    component.timeEntries.set([entry, { ...entry, id: 'e2', startTime: '2026-10-17T11:00:00.000Z' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry-day').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.entry-project-task').textContent).toContain(
      '364 Sydney Opera House - Design',
    );
    expect(component.formatDuration(entry)).toBe('1h 30m');
    expect(fixture.nativeElement.querySelector('.entry-day-total').textContent.trim()).toBe('1h 30m');

    (fixture.nativeElement.querySelector('.time-entry') as HTMLElement).click();
    httpMock.expectOne((request) => request.url.endsWith('/projects/p1/tasks')).flush({ tasks: [task] });
    component.onEditProjectChange('p2');
    httpMock.expectOne((request) => request.url.endsWith('/projects/p2/tasks')).flush({ tasks: [replacementTask] });

    component.updateEntryDraft({
      taskId: 't2',
      startTime: '2026-10-16T09:00',
      endTime: '2026-10-16T11:00',
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
