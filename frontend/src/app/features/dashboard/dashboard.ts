import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project as ProjectService } from '../../core/services/project';
import { Task as TaskService } from '../../core/services/task';
import { TimeEntry as TimeEntryService } from '../../core/services/time-entry';
import { Workspace as WorkspaceService } from '../../core/services/workspace';
import type { Project as ProjectDto } from '../../core/models/project.model';
import type { Task as TaskDto } from '../../core/models/task.model';
import type { TimeEntry as TimeEntryDto } from '../../core/models/time-entry.model';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly timeEntryService = inject(TimeEntryService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);

  readonly description = signal('');
  readonly timeEntries = signal<TimeEntryDto[]>([]);
  readonly runningEntry = signal<TimeEntryDto | null>(null);
  readonly projects = signal<ProjectDto[]>([]);
  readonly tasks = signal<TaskDto[]>([]);
  readonly selectedProjectId = signal('');
  readonly selectedTaskId = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  ngOnInit(): void {
    this.refresh();
    this.loadProjects();
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

  stopTimer(): void {
    const running = this.runningEntry();
    if (!running) {
      return;
    }
    this.timeEntryService.stop(running.id).subscribe({
      next: () => this.refresh(),
      error: () => this.errorMessage.set('Could not stop the timer. Try again.'),
    });
  }

  assignTaskToRunningTimer(): void {
    const running = this.runningEntry();
    const taskId = this.selectedTaskId();
    if (!running || !taskId) {
      this.errorMessage.set('Select a project and task before saving this timer.');
      return;
    }

    this.timeEntryService.update(running.id, { taskId }).subscribe({
      next: () => {
        this.selectedTaskId.set('');
        this.selectedProjectId.set('');
        this.tasks.set([]);
        this.refresh();
      },
      error: () => this.errorMessage.set('Could not assign the selected task. Try again.'),
    });
  }

  private refresh(): void {
    this.timeEntryService.list().subscribe({
      next: ({ timeEntries }) => {
        this.timeEntries.set(timeEntries);
        this.runningEntry.set(timeEntries.find((entry) => entry.endTime === null) ?? null);
      },
      error: () => this.errorMessage.set('Could not load time entries. Try refreshing the page.'),
    });
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
