import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { Project as ProjectService } from '../../core/services/project';
import { Task as TaskService } from '../../core/services/task';
import { Workspace as WorkspaceService } from '../../core/services/workspace';
import { ProjectColorPicker } from './project-color-picker';
import type { Project as ProjectDto } from '../../core/models/project.model';
import type { Task as TaskDto } from '../../core/models/task.model';
import type { Workspace as WorkspaceDto } from '../../core/models/workspace.model';
import { PAY_TYPES, payTypeLabel, type PayType } from '../../core/models/pay-type.model';

interface TaskView extends TaskDto {
  editingDetails: boolean;
  editedName: string;
  editedPayType: PayType;
  detailsError: string | null;
}

interface ProjectView extends ProjectDto {
  tasks: TaskView[];
  newTaskName: string;
  newTaskPayType: PayType;
  taskError: string | null;
  colorError: string | null;
  archiveError: string | null;
  editingDetails: boolean;
  editedName: string;
  editedProjectNumber: string;
  detailsError: string | null;
}

@Component({
  selector: 'app-projects',
  imports: [FormsModule, ProjectColorPicker],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly workspaceService = inject(WorkspaceService);

  readonly workspace = signal<WorkspaceDto | null>(null);
  readonly projects = signal<ProjectView[]>([]);
  readonly newProjectNumber = signal('');
  readonly newProjectName = signal('');
  readonly newProjectColor = signal('#2D6A4F');
  readonly newProjectError = signal<string | null>(null);
  readonly showArchived = signal(false);
  readonly addingTaskProjectId = signal<string | null>(null);
  readonly expandedProjectIds = signal<ReadonlySet<string>>(new Set());
  readonly openProjectMenuId = signal<string | null>(null);
  readonly openTaskMenuId = signal<string | null>(null);
  readonly payTypes = PAY_TYPES;
  readonly payTypeLabel = payTypeLabel;
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
    const projectNumber = this.newProjectNumber().trim();
    const name = this.newProjectName().trim();
    if (!/^\d{3}$/.test(projectNumber)) {
      this.newProjectError.set('Enter a three-digit project number.');
      return;
    }
    if (!name) {
      this.newProjectError.set('Enter a project name.');
      return;
    }
    if (!workspace) {
      return;
    }

    this.newProjectError.set(null);
    this.projectService
      .create({ name, projectNumber, workspaceId: workspace.id, color: this.newProjectColor() })
      .pipe(switchMap(() => this.projectService.listByWorkspace(workspace.id, true)))
      .subscribe({
        next: ({ projects }) => {
          this.setProjects(projects);
          this.newProjectNumber.set('');
          this.newProjectName.set('');
          this.newProjectColor.set('#2D6A4F');
        },
        error: () => this.newProjectError.set('Could not create the project. Try again.'),
      });
  }

  onProjectPanelClick(projectId: string, event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, select, textarea, a, label')) {
      return;
    }

    this.toggleProjectTasks(projectId);
  }

  onProjectPanelKeydown(projectId: string, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.toggleProjectTasks(projectId);
  }

  isProjectTasksExpanded(projectId: string): boolean {
    return this.expandedProjectIds().has(projectId);
  }

  toggleProjectTasks(projectId: string): void {
    this.expandedProjectIds.update((current) => {
      const expanded = new Set(current);
      if (expanded.has(projectId)) {
        expanded.delete(projectId);
      } else {
        expanded.add(projectId);
      }
      return expanded;
    });
  }

  toggleProjectMenu(projectId: string): void {
    this.openProjectMenuId.update((current) => (current === projectId ? null : projectId));
  }

  toggleArchivedProjects(): void {
    this.showArchived.update((showArchived) => !showArchived);
    const workspace = this.workspace();
    if (workspace) {
      this.loadProjects(workspace.id);
    }
  }

  addTaskFromProjectMenu(projectId: string): void {
    this.openProjectMenuId.set(null);
    this.addingTaskProjectId.set(projectId);
    if (!this.isProjectTasksExpanded(projectId)) {
      this.toggleProjectTasks(projectId);
    }
  }

  cancelAddingTask(projectId: string): void {
    if (this.addingTaskProjectId() === projectId) {
      this.addingTaskProjectId.set(null);
      this.updateProject(projectId, (project) => ({
        ...project,
        newTaskName: '',
        taskError: null,
      }));
    }
  }

  toggleTaskMenu(taskId: string): void {
    this.openTaskMenuId.update((current) => (current === taskId ? null : taskId));
  }

  @HostListener('document:click', ['$event'])
  closePopupsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (!target.closest('.project-options')) {
      this.openProjectMenuId.set(null);
    }
    if (!target.closest('.task-options')) {
      this.openTaskMenuId.set(null);
    }
  }

  editProjectDetails(projectId: string): void {
    this.openProjectMenuId.set(null);
    this.updateProject(projectId, (project) => ({
      ...project,
      editingDetails: true,
      editedName: project.name,
      editedProjectNumber: project.projectNumber ?? '',
      detailsError: null,
    }));
  }

  cancelProjectDetails(projectId: string): void {
    this.updateProject(projectId, (project) => ({
      ...project,
      editingDetails: false,
      detailsError: null,
    }));
  }

  setEditedProjectNumber(projectId: string, projectNumber: string): void {
    this.updateProject(projectId, (project) => ({
      ...project,
      editedProjectNumber: projectNumber,
    }));
  }

  setEditedProjectName(projectId: string, name: string): void {
    this.updateProject(projectId, (project) => ({ ...project, editedName: name }));
  }

  saveProjectDetails(projectId: string): void {
    const project = this.projects().find((item) => item.id === projectId);
    const name = project?.editedName.trim();
    const projectNumber = project?.editedProjectNumber.trim();
    if (!project || !name) {
      this.updateProject(projectId, (item) => ({
        ...item,
        detailsError: 'Enter a project name.',
      }));
      return;
    }
    if (!projectNumber || !/^\d{3}$/.test(projectNumber)) {
      this.updateProject(projectId, (item) => ({
        ...item,
        detailsError: 'Enter a three-digit project number.',
      }));
      return;
    }

    this.updateProject(projectId, (item) => ({ ...item, detailsError: null }));
    this.projectService.update(projectId, { name, projectNumber }).subscribe({
      next: ({ project: updatedProject }) => {
        this.projects.update((projects) =>
          this.sortProjects(
            projects.map((item) =>
              item.id === projectId
                ? {
                    ...item,
                    ...updatedProject,
                    tasks: item.tasks,
                    editingDetails: false,
                    editedName: updatedProject.name,
                    editedProjectNumber: updatedProject.projectNumber ?? '',
                    detailsError: null,
                  }
                : item,
            ),
          ),
        );
      },
      error: () =>
        this.updateProject(projectId, (item) => ({
          ...item,
          detailsError: 'Could not update project details. Try again.',
        })),
    });
  }

  selectProjectColor(projectId: string, color: string): void {
    const project = this.projects().find((item) => item.id === projectId);
    if (!project || project.color.toUpperCase() === color.toUpperCase()) {
      return;
    }

    this.updateProject(projectId, (item) => ({ ...item, colorError: null }));
    this.projectService.update(projectId, { color }).subscribe({
      next: ({ project: updatedProject }) =>
        this.updateProject(projectId, (item) => ({
          ...item,
          color: updatedProject.color,
          colorError: null,
        })),
      error: () =>
        this.updateProject(projectId, (item) => ({
          ...item,
          colorError: 'Could not update the project color. Try again.',
        })),
    });
  }

  removeProject(id: string): void {
    const workspace = this.workspace();
    if (!workspace) {
      return;
    }

    this.openProjectMenuId.set(null);
    this.projectService.remove(id).subscribe({
      next: () => this.loadProjects(workspace.id),
    });
  }

  setProjectArchived(projectId: string, archived: boolean): void {
    const workspace = this.workspace();
    if (!workspace) {
      return;
    }

    this.openProjectMenuId.set(null);
    this.updateProject(projectId, (project) => ({ ...project, archiveError: null }));
    this.projectService.update(projectId, { archived }).subscribe({
      next: () => this.loadProjects(workspace.id),
      error: () =>
        this.updateProject(projectId, (project) => ({
          ...project,
          archiveError: `Could not ${archived ? 'archive' : 'restore'} the project. Try again.`,
        })),
    });
  }

  setNewTaskName(projectId: string, name: string): void {
    this.updateProject(projectId, (project) => ({ ...project, newTaskName: name }));
  }

  setNewTaskPayType(projectId: string, payType: PayType): void {
    this.updateProject(projectId, (project) => ({ ...project, newTaskPayType: payType }));
  }

  setEditedTaskPayType(projectId: string, taskId: string, payType: PayType): void {
    this.updateTask(projectId, taskId, (task) => ({ ...task, editedPayType: payType }));
  }

  createTask(projectId: string): void {
    const project = this.projects().find((item) => item.id === projectId);
    const name = project?.newTaskName.trim();
    if (!project || !name) {
      this.updateProject(projectId, (item) => ({
        ...item,
        taskError: 'Enter a task name before adding it.',
      }));
      return;
    }

    this.taskService.create(projectId, name, project.newTaskPayType).subscribe({
      next: ({ task }) => {
        this.updateProject(projectId, (item) => ({
          ...item,
          tasks: this.sortTasks([...item.tasks, this.toTaskView(task)]),
          newTaskName: '',
          newTaskPayType: 'hourly',
          taskError: null,
        }));
        this.addingTaskProjectId.set(null);
      },
      error: () => {
        this.updateProject(projectId, (item) => ({
          ...item,
          taskError: 'Could not create the task. Try again.',
        }));
      },
    });
  }

  editTaskDetails(projectId: string, taskId: string): void {
    this.openTaskMenuId.set(null);
    this.updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              editingDetails: true,
              editedName: task.name,
              editedPayType: task.payType,
              detailsError: null,
            }
          : task,
      ),
    }));
  }

  cancelTaskDetails(projectId: string, taskId: string): void {
    this.updateTask(projectId, taskId, (task) => ({
      ...task,
      editingDetails: false,
      detailsError: null,
    }));
  }

  setEditedTaskName(projectId: string, taskId: string, name: string): void {
    this.updateTask(projectId, taskId, (task) => ({ ...task, editedName: name }));
  }

  saveTaskDetails(projectId: string, taskId: string): void {
    const task = this.projects()
      .find((project) => project.id === projectId)
      ?.tasks.find((item) => item.id === taskId);
    const name = task?.editedName.trim();
    if (!task || !name) {
      this.updateTask(projectId, taskId, (item) => ({
        ...item,
        detailsError: 'Enter a task name.',
      }));
      return;
    }
    if (name.length > 120) {
      this.updateTask(projectId, taskId, (item) => ({
        ...item,
        detailsError: 'Task names must be 120 characters or fewer.',
      }));
      return;
    }

    this.updateTask(projectId, taskId, (item) => ({ ...item, detailsError: null }));
    this.taskService.update(projectId, taskId, name, task.editedPayType).subscribe({
      next: ({ task: updatedTask }) =>
        this.updateProject(projectId, (project) => ({
          ...project,
          tasks: this.sortTasks(
            project.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    ...updatedTask,
                    editingDetails: false,
                    editedName: updatedTask.name,
                    editedPayType: updatedTask.payType,
                  }
                : item,
            ),
          ),
        })),
      error: () =>
        this.updateTask(projectId, taskId, (item) => ({
          ...item,
          detailsError: 'Could not update the task. Try again.',
        })),
    });
  }

  removeTask(projectId: string, taskId: string): void {
    this.openTaskMenuId.set(null);
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
    this.projectService
      .listByWorkspace(workspaceId, true, this.showArchived())
      .subscribe(({ projects }) => this.setProjects(projects));
  }

  private setProjects(projects: ProjectDto[]): void {
    this.projects.set(
      this.sortProjects(
        projects
          .filter((project) => Boolean(project.archived) === this.showArchived())
          .map((project) => ({
            ...project,
            tasks: (project.tasks ?? []).map((task) => this.toTaskView(task)),
            newTaskName: '',
            newTaskPayType: 'hourly' as PayType,
            taskError: null,
            colorError: null,
            archiveError: null,
            editingDetails: false,
            editedName: project.name,
            editedProjectNumber: project.projectNumber ?? '',
            detailsError: null,
          })),
      ),
    );
  }

  private updateProject(projectId: string, update: (project: ProjectView) => ProjectView): void {
    this.projects.update((projects) =>
      projects.map((project) => (project.id === projectId ? update(project) : project)),
    );
  }

  private updateTask(
    projectId: string,
    taskId: string,
    update: (task: TaskView) => TaskView,
  ): void {
    this.updateProject(projectId, (project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? update(task) : task)),
    }));
  }

  private toTaskView(task: TaskDto): TaskView {
    return {
      ...task,
      payType: task.payType ?? 'hourly',
      editingDetails: false,
      editedName: task.name,
      editedPayType: task.payType ?? 'hourly',
      detailsError: null,
    };
  }

  private sortTasks(tasks: TaskView[]): TaskView[] {
    return [...tasks].sort((left, right) => left.name.localeCompare(right.name));
  }

  private sortProjects<T extends ProjectDto>(projects: T[]): T[] {
    return [...projects].sort((left, right) => {
      const leftNumber =
        left.projectNumber === null ? Number.POSITIVE_INFINITY : Number(left.projectNumber);
      const rightNumber =
        right.projectNumber === null ? Number.POSITIVE_INFINITY : Number(right.projectNumber);
      return (
        leftNumber - rightNumber ||
        left.name.localeCompare(right.name, undefined, { numeric: true })
      );
    });
  }
}
