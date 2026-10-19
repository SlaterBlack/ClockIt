import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { Project as ProjectService } from '../../core/services/project';
import { Task as TaskService } from '../../core/services/task';
import { Workspace as WorkspaceService } from '../../core/services/workspace';
import type { Project as ProjectDto } from '../../core/models/project.model';
import type { Task as TaskDto } from '../../core/models/task.model';
import type { Workspace as WorkspaceDto } from '../../core/models/workspace.model';

interface ProjectView extends ProjectDto {
  tasks: TaskDto[];
  newTaskName: string;
  taskError: string | null;
}

@Component({
  selector: 'app-projects',
  imports: [FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly workspaceService = inject(WorkspaceService);

  readonly workspace = signal<WorkspaceDto | null>(null);
  readonly projects = signal<ProjectView[]>([]);
  readonly newProjectName = signal('');

  ngOnInit(): void {
    this.workspaceService.list().subscribe(({ workspaces }) => {
      if (workspaces.length > 0) {
        this.workspace.set(workspaces[0]);
        this.loadProjects(workspaces[0].id);
        return;
      }

      this.workspaceService.create('My Workspace').subscribe(({ workspace }) => {
        this.workspace.set(workspace);
        this.loadProjects(workspace.id);
      });
    });
  }

  createProject(): void {
    const workspace = this.workspace();
    const name = this.newProjectName().trim();
    if (!workspace || !name) {
      return;
    }

    this.projectService
      .create({ name, workspaceId: workspace.id })
      .pipe(switchMap(() => this.projectService.listByWorkspace(workspace.id)))
      .subscribe(({ projects }) => {
        this.setProjects(projects);
        this.newProjectName.set('');
      });
  }

  removeProject(id: string): void {
    const workspace = this.workspace();
    if (!workspace) {
      return;
    }

    this.projectService
      .remove(id)
      .pipe(switchMap(() => this.projectService.listByWorkspace(workspace.id)))
      .subscribe(({ projects }) => this.setProjects(projects));
  }

  setNewTaskName(projectId: string, name: string): void {
    this.updateProject(projectId, (project) => ({ ...project, newTaskName: name }));
  }

  createTask(projectId: string): void {
    const project = this.projects().find((item) => item.id === projectId);
    const name = project?.newTaskName.trim();
    if (!name) {
      this.updateProject(projectId, (item) => ({
        ...item,
        taskError: 'Enter a task name before adding it.',
      }));
      return;
    }

    this.taskService.create(projectId, name).subscribe({
      next: ({ task }) =>
        this.updateProject(projectId, (item) => ({
          ...item,
          tasks: [...item.tasks, task].sort((a, b) => a.name.localeCompare(b.name)),
          newTaskName: '',
          taskError: null,
        })),
      error: () =>
        this.updateProject(projectId, (item) => ({
          ...item,
          taskError: 'Could not create the task. Try again.',
        })),
    });
  }

  removeTask(projectId: string, taskId: string): void {
    this.taskService.remove(projectId, taskId).subscribe({
      next: () =>
        this.updateProject(projectId, (item) => ({
          ...item,
          tasks: item.tasks.filter((task) => task.id !== taskId),
          taskError: null,
        })),
      error: () =>
        this.updateProject(projectId, (item) => ({
          ...item,
          taskError: 'Could not remove the task. It may already be assigned to a time entry.',
        })),
    });
  }

  private loadProjects(workspaceId: string): void {
    this.projectService.listByWorkspace(workspaceId).subscribe(({ projects }) => {
      this.setProjects(projects);
    });
  }

  private setProjects(projects: ProjectDto[]): void {
    this.projects.set(
      projects.map((project) => ({
        ...project,
        tasks: [],
        newTaskName: '',
        taskError: null,
      })),
    );

    for (const project of projects) {
      this.taskService.listByProject(project.id).subscribe({
        next: ({ tasks }) =>
          this.updateProject(project.id, (item) => ({ ...item, tasks })),
        error: () =>
          this.updateProject(project.id, (item) => ({
            ...item,
            taskError: 'Could not load project tasks.',
          })),
      });
    }
  }

  private updateProject(
    projectId: string,
    update: (project: ProjectView) => ProjectView,
  ): void {
    this.projects.update((projects) =>
      projects.map((project) => (project.id === projectId ? update(project) : project)),
    );
  }
}
