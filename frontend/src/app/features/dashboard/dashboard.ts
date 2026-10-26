import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { interval } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Project as ProjectService } from '../../core/services/project';
import { Task as TaskService } from '../../core/services/task';
import { TimeEntry as TimeEntryService } from '../../core/services/time-entry';
import { Workspace as WorkspaceService } from '../../core/services/workspace';
import type { Project as ProjectDto } from '../../core/models/project.model';
import type { Task as TaskDto } from '../../core/models/task.model';
import type { TimeEntry as TimeEntryDto } from '../../core/models/time-entry.model';
import { DateTimePicker } from './date-time-picker';

interface TimeEntryEdit {
  id: string;
  projectId: string;
  taskId: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
}

interface RunningTimerEdit {
  projectId: string;
  taskId: string;
  startTime: string;
  originalStartTime?: string;
}

interface ManualEntryDraft {
  projectId: string;
  taskId: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
}

interface TimeEntryDay {
  key: string;
  date: Date;
  entries: TimeEntryDto[];
  totalDurationSeconds: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DatePipe, DateTimePicker],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly timeEntryService = inject(TimeEntryService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly destroyRef = inject(DestroyRef);

  readonly description = signal('');
  readonly timeEntries = signal<TimeEntryDto[]>([]);
  readonly clockNow = signal(Date.now());
  readonly weekStart = signal(this.startOfWeek(new Date()));
  readonly weekEnd = computed(() => {
    const end = new Date(this.weekStart());
    end.setDate(end.getDate() + 6);
    return end;
  });
  readonly currentWeekStart = computed(() => this.startOfWeek(new Date(this.clockNow())));
  readonly canGoToNextWeek = computed(
    () => this.weekStart().getTime() < this.currentWeekStart().getTime(),
  );
  readonly entryDays = computed(() => {
    const days = new Map<string, TimeEntryDay>();
    const now = this.clockNow();
    for (const entry of this.timeEntries()) {
      const start = new Date(entry.startTime);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
        start.getDate(),
      ).padStart(2, '0')}`;
      let day = days.get(key);
      if (!day) {
        day = {
          key,
          date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          entries: [],
          totalDurationSeconds: 0,
        };
        days.set(key, day);
      }
      day.entries.push(entry);
      day.totalDurationSeconds += entry.endTime
        ? (entry.durationSeconds ??
          Math.max(0, Math.round((new Date(entry.endTime).getTime() - start.getTime()) / 1000)))
        : Math.max(0, Math.round((now - start.getTime()) / 1000));
    }
    return [...days.values()];
  });
  readonly weekEntryDays = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return this.entryDays().filter((day) => day.date >= start && day.date < end);
  });
  readonly runningEntry = signal<TimeEntryDto | null>(null);
  readonly runningTimerEdit = signal<RunningTimerEdit | null>(null);
  readonly runningTasks = signal<TaskDto[]>([]);
  readonly projects = signal<ProjectDto[]>([]);
  readonly tasks = signal<TaskDto[]>([]);
  readonly selectedProjectId = signal('');
  readonly selectedTaskId = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly editingEntry = signal<TimeEntryEdit | null>(null);
  readonly editingDateTimeValue = computed(() => {
    const draft = this.editingEntry();
    return draft ? `${draft.date}T${draft.startTime || '00:00'}` : '';
  });
  readonly editingDuration = computed(() => {
    const draft = this.editingEntry();
    return draft ? this.durationPreview(draft.date, draft.startTime, draft.endTime, true) : '—';
  });
  readonly editingTasks = signal<TaskDto[]>([]);
  readonly editingError = signal<string | null>(null);
  readonly isSavingEntry = signal(false);
  readonly entryPendingRemovalId = signal<string | null>(null);
  readonly isRemovingEntry = signal(false);
  readonly isManualEntryOpen = signal(false);
  readonly manualEntry = signal<ManualEntryDraft | null>(null);
  readonly manualEntryDateTimeValue = computed(() => {
    const draft = this.manualEntry();
    return draft ? `${draft.date}T${draft.startTime || '00:00'}` : '';
  });
  readonly manualEntryDuration = computed(() => {
    const draft = this.manualEntry();
    return draft
      ? this.durationPreview(draft.date, draft.startTime, draft.endTime, false)
      : '—';
  });
  readonly manualTasks = signal<TaskDto[]>([]);
  readonly manualEntryError = signal<string | null>(null);
  readonly isSavingManualEntry = signal(false);

  private durationPreview(
    date: string,
    startTime: string,
    endTime: string,
    running: boolean,
  ): string {
    if (!date || !startTime) {
      return '—';
    }

    const start = new Date(`${date}T${startTime}`);
    const end = endTime
      ? new Date(`${date}T${endTime}`)
      : running
        ? new Date(this.clockNow())
        : null;
    if (
      Number.isNaN(start.getTime()) ||
      !end ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return '—';
    }

    return this.formatDurationSeconds(Math.round((end.getTime() - start.getTime()) / 1000));
  }

  ngOnInit(): void {
    this.refresh();
    this.loadProjects();
    interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clockNow.set(Date.now()));
  }

  onProjectChange(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.selectedTaskId.set('');
    this.tasks.set([]);
    this.errorMessage.set(null);

    if (projectId) {
      this.taskService.listByProject(projectId).subscribe({
        next: ({ tasks }) => this.tasks.set(tasks),
        error: () => this.errorMessage.set('Could not load tasks for this project.'),
      });
    }
  }

  startTimer(): void {
    const taskId = this.selectedTaskId();
    if (!taskId) {
      this.errorMessage.set('Select a project and task before starting the timer.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.timeEntryService.start({ description: this.description(), taskId }).subscribe({
      next: () => {
        this.description.set('');
        this.selectedTaskId.set('');
        this.selectedProjectId.set('');
        this.tasks.set([]);
        this.isSubmitting.set(false);
        this.refresh();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Could not start the timer. Check the selected task and try again.');
      },
    });
  }

  startTimerFromEntry(entry: TimeEntryDto): void {
    if (!entry.taskId || !entry.endTime || this.isSubmitting()) {
      return;
    }

    const running = this.runningEntry();
    if (!running) {
      this.startEntryTimer(entry, false);
      return;
    }

    const draft = this.runningTimerEdit();
    if (!draft?.taskId || !draft.projectId || !draft.startTime) {
      this.errorMessage.set('Select a project and task and enter a valid start time before switching timers.');
      return;
    }
    const start = this.getRunningStartTime(draft);
    if (Number.isNaN(start.getTime()) || start >= new Date()) {
      this.errorMessage.set('Enter a valid start time before switching timers.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.timeEntryService
      .stop(running.id, { taskId: draft.taskId, startTime: start.toISOString() })
      .subscribe({
        next: () => this.startEntryTimer(entry, true),
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Could not save the running timer. The selected entry was not started.');
        },
      });
  }

  private startEntryTimer(entry: TimeEntryDto, previousTimerSaved: boolean): void {
    if (!entry.taskId) {
      this.isSubmitting.set(false);
      this.errorMessage.set('The selected entry has no task and cannot be started.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.timeEntryService.start({ taskId: entry.taskId, description: entry.description }).subscribe({
      next: () => {
        this.description.set('');
        this.selectedTaskId.set('');
        this.selectedProjectId.set('');
        this.tasks.set([]);
        this.isSubmitting.set(false);
        this.refresh();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          previousTimerSaved
            ? 'The running timer was saved, but the selected entry could not be started.'
            : 'Could not start the selected entry. Check its project and task, then try again.',
        );
      },
    });
  }

  openManualEntry(): void {
    const end = new Date();
    end.setSeconds(0, 0);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    const date = this.toLocalDateTime(end.toISOString()).slice(0, 10);
    const startDateTime = this.toLocalDateTime(start.toISOString());
    this.manualEntry.set({
      projectId: '',
      taskId: '',
      description: '',
      date,
      startTime: startDateTime.slice(0, 10) === date ? startDateTime.slice(11) : '00:00',
      endTime: this.toLocalDateTime(end.toISOString()).slice(11),
      isBillable: true,
    });
    this.manualTasks.set([]);
    this.manualEntryError.set(null);
    this.isManualEntryOpen.set(true);
  }

  closeManualEntry(): void {
    this.isManualEntryOpen.set(false);
    this.manualEntry.set(null);
    this.manualTasks.set([]);
    this.manualEntryError.set(null);
  }

  updateManualEntry(changes: Partial<ManualEntryDraft>): void {
    this.manualEntry.update((draft) => (draft ? { ...draft, ...changes } : null));
  }

  manualEntryTimePickerValue(time: string | undefined): string {
    const draft = this.manualEntry();
    return draft && time ? `${draft.date}T${time}` : '';
  }

  updateManualEntryDate(value: string): void {
    this.updateManualEntry({ date: value.slice(0, 10) });
  }

  updateManualEntryTimeDraft(field: 'startTime' | 'endTime', value: string): void {
    const time = value.slice(11, 16);
    if (field === 'startTime') {
      this.updateManualEntry({ startTime: time });
    } else {
      this.updateManualEntry({ endTime: time });
    }
  }

  onManualProjectChange(projectId: string): void {
    this.updateManualEntry({ projectId, taskId: '' });
    this.manualTasks.set([]);
    this.manualEntryError.set(null);
    if (projectId) {
      this.taskService.listByProject(projectId).subscribe({
        next: ({ tasks }) => this.manualTasks.set(tasks),
        error: () => this.manualEntryError.set('Could not load tasks for this project.'),
      });
    }
  }

  saveManualEntry(): void {
    const draft = this.manualEntry();
    if (!draft?.taskId) {
      this.manualEntryError.set('Select a project and task.');
      return;
    }
    if (!draft.date || !draft.startTime || !draft.endTime) {
      this.manualEntryError.set('Enter a date, start time, and end time.');
      return;
    }
    const start = new Date(`${draft.date}T${draft.startTime}`);
    const end = new Date(`${draft.date}T${draft.endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      this.manualEntryError.set('Enter a valid date, start time, and end time.');
      return;
    }
    if (end <= start) {
      this.manualEntryError.set('End time must be after start time on the same date.');
      return;
    }
    if (end > new Date()) {
      this.manualEntryError.set('End time cannot be in the future.');
      return;
    }

    this.isSavingManualEntry.set(true);
    this.manualEntryError.set(null);
    this.timeEntryService
      .create({
        taskId: draft.taskId,
        description: draft.description,
        isBillable: draft.isBillable,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      })
      .subscribe({
        next: () => {
          this.isSavingManualEntry.set(false);
          this.closeManualEntry();
          this.refresh();
        },
        error: () => {
          this.isSavingManualEntry.set(false);
          this.manualEntryError.set(
            'Could not save the time entry. Check the details and try again.',
          );
        },
      });
  }

  onRunningProjectChange(projectId: string): void {
    this.runningTimerEdit.update((draft) => (draft ? { ...draft, projectId, taskId: '' } : null));
    this.errorMessage.set(null);
    this.loadRunningTasks(projectId);
  }

  updateRunningTimerDraft(changes: Partial<RunningTimerEdit>): void {
    this.runningTimerEdit.update((draft) => (draft ? { ...draft, ...changes } : null));
  }

  endAndSaveRunningTimer(): void {
    const running = this.runningEntry();
    const draft = this.runningTimerEdit();
    if (!running || !draft) {
      return;
    }
    if (!draft.projectId || !draft.taskId) {
      this.errorMessage.set('Select a project and task before ending the timer.');
      return;
    }
    if (!draft.startTime) {
      this.errorMessage.set('Enter a start date and time before ending the timer.');
      return;
    }

    const start = this.getRunningStartTime(draft);
    if (Number.isNaN(start.getTime())) {
      this.errorMessage.set('Enter a valid start date and time.');
      return;
    }
    if (start >= new Date()) {
      this.errorMessage.set('Start time must be before now to end the timer.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.timeEntryService
      .stop(running.id, { taskId: draft.taskId, startTime: start.toISOString() })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.refresh();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set(
            'Could not save the timer changes or end the timer. Check the details and try again.',
          );
        },
      });
  }

  runningDuration(): string {
    const draft = this.runningTimerEdit();
    if (!draft?.startTime) {
      return '00:00:00';
    }

    const start = this.getRunningStartTime(draft).getTime();
    if (Number.isNaN(start)) {
      return '00:00:00';
    }
    const totalSeconds = Math.max(0, Math.floor((this.clockNow() - start) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  toggleEntryEdit(entry: TimeEntryDto): void {
    if (this.editingEntry()?.id === entry.id) {
      this.cancelEntryEdit();
      return;
    }
    const draft: TimeEntryEdit = {
      id: entry.id,
      projectId: entry.projectId ?? '',
      taskId: entry.taskId ?? '',
      description: entry.description,
      date: this.toLocalDateTime(entry.startTime).slice(0, 10),
      startTime: this.toLocalDateTime(entry.startTime).slice(11),
      endTime: entry.endTime ? this.toLocalDateTime(entry.endTime).slice(11) : '',
      isBillable: entry.isBillable,
    };
    this.entryPendingRemovalId.set(null);
    this.editingEntry.set(draft);
    this.editingError.set(null);
    this.loadEditingTasks(draft.projectId);
  }

  onEntryKeydown(event: KeyboardEvent, entry: TimeEntryDto): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleEntryEdit(entry);
    }
  }

  cancelEntryEdit(): void {
    this.editingEntry.set(null);
    this.editingTasks.set([]);
    this.editingError.set(null);
    this.entryPendingRemovalId.set(null);
  }

  requestEntryRemoval(entry: TimeEntryDto): void {
    if (this.isRemovingEntry()) {
      return;
    }
    this.entryPendingRemovalId.set(entry.id);
    this.editingError.set(null);
  }

  cancelEntryRemoval(): void {
    if (!this.isRemovingEntry()) {
      this.entryPendingRemovalId.set(null);
    }
  }

  removeEntry(entry: TimeEntryDto): void {
    if (this.entryPendingRemovalId() !== entry.id || this.isRemovingEntry()) {
      return;
    }

    this.isRemovingEntry.set(true);
    this.editingError.set(null);
    this.timeEntryService.remove(entry.id).subscribe({
      next: () => {
        this.isRemovingEntry.set(false);
        if (this.editingEntry()?.id === entry.id) {
          this.cancelEntryEdit();
        } else {
          this.entryPendingRemovalId.set(null);
        }
        this.refresh();
      },
      error: () => {
        this.isRemovingEntry.set(false);
        if (this.editingEntry()?.id === entry.id) {
          this.editingError.set('Could not remove the time entry. Try again.');
        } else {
          this.errorMessage.set('Could not remove the time entry. Try again.');
        }
      },
    });
  }

  updateEntryDraft(changes: Partial<TimeEntryEdit>): void {
    this.editingEntry.update((draft) => (draft ? { ...draft, ...changes } : null));
  }

  entryTimePickerValue(time: string | undefined): string {
    const draft = this.editingEntry();
    return draft && time ? `${draft.date}T${time}` : '';
  }

  updateEntryDate(value: string): void {
    this.updateEntryDraft({ date: value.slice(0, 10) });
  }

  updateEntryTimeDraft(field: 'startTime' | 'endTime', value: string): void {
    const time = value.slice(11, 16);
    if (field === 'startTime') {
      this.updateEntryDraft({ startTime: time });
    } else {
      this.updateEntryDraft({ endTime: time });
    }
  }

  onEditProjectChange(projectId: string): void {
    this.updateEntryDraft({ projectId, taskId: '' });
    this.loadEditingTasks(projectId);
  }

  saveEntryEdit(): void {
    const draft = this.editingEntry();
    if (!draft?.taskId) {
      this.editingError.set('Select a project and task.');
      return;
    }
    if (!draft.date || !draft.startTime) {
      this.editingError.set('Enter a date and start time.');
      return;
    }

    const start = new Date(`${draft.date}T${draft.startTime}`);
    const end = draft.endTime ? new Date(`${draft.date}T${draft.endTime}`) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
      this.editingError.set('Enter a valid date and start and end times.');
      return;
    }
    if (end && end <= start) {
      this.editingError.set('End time must be after start time on the same date.');
      return;
    }

    this.isSavingEntry.set(true);
    this.editingError.set(null);
    this.timeEntryService
      .update(draft.id, {
        taskId: draft.taskId,
        description: draft.description,
        isBillable: draft.isBillable,
        startTime: start.toISOString(),
        endTime: end?.toISOString() ?? null,
      })
      .subscribe({
        next: () => {
          this.isSavingEntry.set(false);
          this.cancelEntryEdit();
          this.refresh();
        },
        error: () => {
          this.isSavingEntry.set(false);
          this.editingError.set(
            'Could not update the time entry. Check the details and try again.',
          );
        },
      });
  }

  formatDuration(entry: TimeEntryDto): string {
    if (entry.endTime === null) {
      return 'Running';
    }

    const seconds =
      entry.durationSeconds ??
      Math.max(
        0,
        Math.round(
          (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000,
        ),
      );
    return this.formatDurationSeconds(seconds);
  }

  formatDurationSeconds(seconds: number): string {
    const wholeMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(wholeMinutes / 60);
    const minutes = wholeMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  showPreviousWeek(): void {
    const start = new Date(this.weekStart());
    start.setDate(start.getDate() - 7);
    this.weekStart.set(start);
  }

  showNextWeek(): void {
    if (!this.canGoToNextWeek()) {
      return;
    }
    const start = new Date(this.weekStart());
    start.setDate(start.getDate() + 7);
    this.weekStart.set(start);
  }

  private refresh(): void {
    this.timeEntryService.list().subscribe({
      next: ({ timeEntries }) => {
        this.timeEntries.set(timeEntries);
        const running = timeEntries.find((entry) => entry.endTime === null) ?? null;
        this.runningEntry.set(running);
        this.runningTimerEdit.set(
          running
            ? {
                projectId: running.projectId ?? '',
                taskId: running.taskId ?? '',
                startTime: this.toLocalDateTime(running.startTime),
                originalStartTime: running.startTime,
              }
            : null,
        );
        this.loadRunningTasks(running?.projectId ?? '');
      },
      error: () => this.errorMessage.set('Could not load time entries. Try refreshing the page.'),
    });
  }

  private loadEditingTasks(projectId: string): void {
    this.editingTasks.set([]);
    if (!projectId) {
      return;
    }

    this.taskService.listByProject(projectId).subscribe({
      next: ({ tasks }) => this.editingTasks.set(tasks),
      error: () => this.editingError.set('Could not load tasks for the selected project.'),
    });
  }

  private loadRunningTasks(projectId: string): void {
    this.runningTasks.set([]);
    if (!projectId) {
      return;
    }

    this.taskService.listByProject(projectId).subscribe({
      next: ({ tasks }) => this.runningTasks.set(tasks),
      error: () => this.errorMessage.set('Could not load tasks for the running timer project.'),
    });
  }

  private toLocalDateTime(value: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }

  private getRunningStartTime(draft: RunningTimerEdit): Date {
    if (
      draft.originalStartTime &&
      draft.startTime === this.toLocalDateTime(draft.originalStartTime)
    ) {
      return new Date(draft.originalStartTime);
    }
    return new Date(draft.startTime);
  }

  private loadProjects(): void {
    this.workspaceService.list().subscribe({
      next: ({ workspaces }) => {
        const workspace = workspaces[0];
        if (!workspace) {
          this.projects.set([]);
          return;
        }

        this.projectService.listByWorkspace(workspace.id).subscribe({
          next: ({ projects }) => this.projects.set(projects),
          error: () => this.errorMessage.set('Could not load projects. Try refreshing the page.'),
        });
      },
      error: () => this.errorMessage.set('Could not load workspaces. Try refreshing the page.'),
    });
  }
}
