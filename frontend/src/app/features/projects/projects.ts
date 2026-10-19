import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { Project as ProjectService } from '../../core/services/project';
import { Workspace as WorkspaceService } from '../../core/services/workspace';
import type { Project as ProjectDto } from '../../core/models/project.model';
import type { Workspace as WorkspaceDto } from '../../core/models/workspace.model';

@Component({
  selector: 'app-projects',
  imports: [FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly workspaceService = inject(WorkspaceService);

  readonly workspace = signal<WorkspaceDto | null>(null);
  readonly projects = signal<ProjectDto[]>([]);
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
        this.projects.set(projects);
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
      .subscribe(({ projects }) => this.projects.set(projects));
  }

  private loadProjects(workspaceId: string): void {
    this.projectService.listByWorkspace(workspaceId).subscribe(({ projects }) => {
      this.projects.set(projects);
    });
  }
}
