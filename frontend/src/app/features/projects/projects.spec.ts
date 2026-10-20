import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Projects } from './projects';

describe('Projects', () => {
  let component: Projects;
  let fixture: ComponentFixture<Projects>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    httpMock.expectOne(() => true).flush({ workspaces: [] });
    httpMock
      .expectOne(() => true)
      .flush({
        workspace: { id: 'w1', name: 'My Workspace', ownerId: 'u1', createdAt: '', updatedAt: '' },
      });
    const projectsRequest = httpMock.expectOne((req) => req.url.endsWith('/projects'));
    expect(projectsRequest.request.params.get('includeTasks')).toBe('true');
    projectsRequest.flush({
      projects: [
        {
          ...exampleProject,
          tasks: [
            {
              id: 't1',
              name: 'Loaded task',
              projectId: 'p1',
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads project tasks from the single project-list response', () => {
    expect(component).toBeTruthy();
    expect(component.projects()[0].tasks.map((task) => task.name)).toEqual(['Loaded task']);
  });

  it('starts each project task section collapsed', () => {
    setExampleProject();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.project-card') as HTMLElement;
    expect(panel.getAttribute('aria-expanded')).toBe('false');
    expect(panel.querySelector('.tasks-heading')).toBeNull();
    expect(panel.querySelector('.expand-hint')).toBeNull();
    expect(panel.querySelector('.tasks-disclosure')).toBeNull();
  });

  it('toggles tasks from the project panel but not from interactive controls', () => {
    setExampleProject();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.project-card') as HTMLElement;
    panel.click();
    fixture.detectChanges();
    expect(panel.getAttribute('aria-expanded')).toBe('true');

    const colorButton = fixture.nativeElement.querySelector(
      '.is-compact .project-color',
    ) as HTMLButtonElement;
    colorButton.click();
    fixture.detectChanges();

    expect(panel.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.color-popover')).toBeTruthy();
  });

  it('saves a selected preset color immediately', () => {
    setExampleProject();
    fixture.detectChanges();

    const colorButton = fixture.nativeElement.querySelector(
      '.is-compact .project-color',
    ) as HTMLButtonElement;
    colorButton.click();
    fixture.detectChanges();

    const swatch = fixture.nativeElement.querySelector(
      '.color-swatch[aria-label="Ocean"]',
    ) as HTMLButtonElement;
    swatch.click();

    const request = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url.endsWith('/projects/p1'),
    );
    expect(request.request.body).toEqual({ color: '#3B82A0' });
    request.flush({ project: { ...exampleProject, color: '#3B82A0' } });

    expect(component.projects()[0].color).toBe('#3B82A0');
  });

  it('closes the color selector when its button is clicked a second time', () => {
    setExampleProject();
    fixture.detectChanges();

    const colorButton = fixture.nativeElement.querySelector(
      '.is-compact .project-color',
    ) as HTMLButtonElement;
    colorButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.color-popover')).toBeTruthy();

    colorButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.color-popover')).toBeNull();
  });

  it('edits project details through the options menu and sorts by project number', () => {
    component.projects.set([
      makeProject('p1', '742', 'Example project'),
      makeProject('p2', '364', 'Another project'),
    ]);
    fixture.detectChanges();

    const optionsButton = fixture.nativeElement.querySelector(
      '[aria-label="Options for 742 Example project"]',
    ) as HTMLButtonElement;
    optionsButton.click();
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector(
      '.project-options-menu [role="menuitem"]',
    ) as HTMLButtonElement;
    editButton.click();
    component.setEditedProjectNumber('p1', '100');
    component.setEditedProjectName('p1', 'Renamed project');
    component.saveProjectDetails('p1');

    const request = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url.endsWith('/projects/p1'),
    );
    expect(request.request.body).toEqual({ name: 'Renamed project', projectNumber: '100' });
    request.flush({
      project: { ...exampleProject, name: 'Renamed project', projectNumber: '100' },
    });

    expect(component.projects().map((project) => project.projectNumber)).toEqual(['100', '364']);
    expect(component.projects()[0].name).toBe('Renamed project');
  });

  it('archives a project from its options menu and removes it from the active list', () => {
    component.projects.set([makeProject('p1', '001', 'Example project')]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.project-options-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('[role="menuitem"]:nth-child(2)') as HTMLButtonElement
    ).click();

    const request = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url.endsWith('/projects/p1'),
    );
    expect(request.request.body).toEqual({ archived: true });
    request.flush({ project: { ...exampleProject, archived: true } });

    const reload = httpMock.expectOne((req) => req.url.endsWith('/projects'));
    expect(reload.request.params.get('includeArchived')).toBeNull();
    reload.flush({ projects: [] });
    expect(component.projects()).toEqual([]);
  });

  it('loads archived projects in the archived view', () => {
    component.toggleArchivedProjects();
    const request = httpMock.expectOne((req) => req.url.endsWith('/projects'));
    expect(request.request.params.get('includeArchived')).toBe('true');
    request.flush({
      projects: [{ ...exampleProject, archived: true, tasks: [] }],
    });

    expect(component.projects().map((project) => project.name)).toEqual(['Example project']);
    expect(component.projects()[0].archived).toBe(true);
  });

  it('opens task creation from the project options menu', () => {
    component.projects.set([makeProject('p1', '001', 'Example project')]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.project-options-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const addTaskOption = [
      ...fixture.nativeElement.querySelectorAll('.project-options-menu [role="menuitem"]'),
    ].find((item) => item.textContent.trim() === 'Add task') as HTMLButtonElement;
    addTaskOption.click();
    fixture.detectChanges();

    expect(component.isProjectTasksExpanded('p1')).toBe(true);
    expect(fixture.nativeElement.querySelector('.new-task-form')).toBeTruthy();
  });

  it('requires a three-digit project number when creating a project', () => {
    component.newProjectName.set('New project');
    component.newProjectNumber.set('12');

    component.createProject();

    expect(component.newProjectError()).toBe('Enter a three-digit project number.');
    httpMock.expectNone((req) => req.method === 'POST');
  });

  it('edits task details from the task options menu', () => {
    const project = makeProject('p1', '001', 'Example project');
    project.tasks = [makeTask('t1', 'Planning')];
    component.projects.set([project]);
    component.toggleProjectTasks('p1');
    fixture.detectChanges();

    const optionsButton = fixture.nativeElement.querySelector(
      '[aria-label="Options for task Planning"]',
    ) as HTMLButtonElement;
    optionsButton.click();
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector(
      '.task-options-menu [role="menuitem"]',
    ) as HTMLButtonElement;
    editButton.click();
    component.setEditedTaskName('p1', 't1', 'Design planning');
    component.setEditedTaskPayType('p1', 't1', 'annual-leave');
    component.saveTaskDetails('p1', 't1');

    const request = httpMock.expectOne(
      (req) => req.method === 'PATCH' && req.url.endsWith('/projects/p1/tasks/t1'),
    );
    expect(request.request.body).toEqual({ name: 'Design planning', payType: 'annual-leave' });
    request.flush({
      task: { id: 't1', name: 'Design planning', projectId: 'p1', payType: 'annual-leave' },
    });

    expect(component.projects()[0].tasks[0].name).toBe('Design planning');
    expect(component.projects()[0].tasks[0].payType).toBe('annual-leave');
  });

  it('creates tasks with the selected pay type', () => {
    const project = makeProject('p1', '001', 'Example project');
    component.projects.set([project]);
    component.setNewTaskName('p1', 'Public holiday');
    component.setNewTaskPayType('p1', 'public-holiday');

    component.createTask('p1');

    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/projects/p1/tasks'),
    );
    expect(request.request.body).toEqual({ name: 'Public holiday', payType: 'public-holiday' });
    request.flush({
      task: { id: 't9', name: 'Public holiday', projectId: 'p1', payType: 'public-holiday' },
    });

    expect(component.projects()[0].tasks[0].payType).toBe('public-holiday');
    expect(component.projects()[0].newTaskPayType).toBe('hourly');
  });

  it('closes color, project, and task popups after clicking outside them', () => {
    const project = makeProject('p1', '001', 'Example project');
    project.tasks = [makeTask('t1', 'Planning')];
    component.projects.set([project]);
    component.toggleProjectTasks('p1');
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.is-compact .project-color') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.color-popover')).toBeTruthy();
    (fixture.nativeElement.querySelector('.project-name') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.color-popover')).toBeNull();

    (fixture.nativeElement.querySelector('.project-options-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.project-options-menu')).toBeTruthy();
    (fixture.nativeElement.querySelector('.project-name') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.project-options-menu')).toBeNull();

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Options for task Planning"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-options-menu')).toBeTruthy();
    (fixture.nativeElement.querySelector('.tasks-heading') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-options-menu')).toBeNull();
  });

  function setExampleProject(): void {
    component.projects.set([makeProject('p1', '001', 'Example project')]);
  }

  function makeTask(id: string, name: string) {
    return {
      id,
      name,
      projectId: 'p1',
      payType: 'hourly' as const,
      createdAt: '',
      updatedAt: '',
      editingDetails: false,
      editedName: name,
      editedPayType: 'hourly' as const,
      detailsError: null,
    };
  }

  function makeProject(id: string, projectNumber: string, name: string) {
    return {
      id,
      name,
      projectNumber,
      color: '#2D6A4F',
      isBillable: true,
      workspaceId: 'w1',
      archived: false,
      createdAt: '',
      updatedAt: '',
      tasks: [] as Array<ReturnType<typeof makeTask>>,
      newTaskName: '',
      newTaskPayType: 'hourly' as const,
      taskError: null,
      colorError: null,
      archiveError: null,
      editingDetails: false,
      editedName: name,
      editedProjectNumber: projectNumber,
      detailsError: null,
    };
  }

  const exampleProject = {
    id: 'p1',
    name: 'Example project',
    projectNumber: '001',
    color: '#2D6A4F',
    isBillable: true,
    workspaceId: 'w1',
    archived: false,
    createdAt: '',
    updatedAt: '',
  };
});
