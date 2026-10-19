import { Request, Response } from 'express';
import { Project, Task, TimeEntry, Workspace } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

async function assertWorkspaceOwnership(workspaceId: string, userId: string): Promise<void> {
  const workspace = await Workspace.findOne({ where: { id: workspaceId, ownerId: userId } });
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }
}

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId } = req.query as { workspaceId?: string };
  if (!workspaceId) {
    throw new ApiError(400, 'workspaceId query parameter is required');
  }

  await assertWorkspaceOwnership(workspaceId, req.user!.id);
  const projects = await Project.findAll({ where: { workspaceId } });
  res.json({ projects });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { name, color, isBillable, workspaceId } = req.body as {
    name?: string;
    color?: string;
    isBillable?: boolean;
    workspaceId?: string;
  };

  if (!name || !workspaceId) {
    throw new ApiError(400, 'name and workspaceId are required');
  }

  await assertWorkspaceOwnership(workspaceId, req.user!.id);
  const project = await Project.create({ name, color, isBillable, workspaceId });
  res.status(201).json({ project });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  await assertWorkspaceOwnership(project.workspaceId, req.user!.id);
  if ((await TimeEntry.count({ where: { projectId: project.id } })) > 0) {
    throw new ApiError(409, 'Projects with recorded time entries cannot be deleted');
  }

  await Task.destroy({ where: { projectId: project.id } });
  await project.destroy();
  res.status(204).send();
});

export const listProjectTasks = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findByPk(req.params.projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }
  await assertWorkspaceOwnership(project.workspaceId, req.user!.id);

  const tasks = await Task.findAll({
    where: { projectId: project.id },
    order: [['name', 'ASC']],
  });
  res.json({ tasks });
});

export const createProjectTask = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findByPk(req.params.projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }
  await assertWorkspaceOwnership(project.workspaceId, req.user!.id);

  const { name } = req.body as { name?: string };
  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new ApiError(400, 'name is required');
  }
  if (trimmedName.length > 120) {
    throw new ApiError(400, 'name must be 120 characters or fewer');
  }

  const task = await Task.create({ name: trimmedName, projectId: project.id });
  res.status(201).json({ task });
});

export const deleteProjectTask = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findByPk(req.params.projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }
  await assertWorkspaceOwnership(project.workspaceId, req.user!.id);

  const task = await Task.findOne({
    where: { id: req.params.taskId, projectId: project.id },
  });
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  if ((await TimeEntry.count({ where: { taskId: task.id } })) > 0) {
    throw new ApiError(409, 'Tasks assigned to time entries cannot be deleted');
  }

  await task.destroy();
  res.status(204).send();
});
