import { Request, Response } from 'express';
import { Project, Workspace } from '../models';
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
  await project.destroy();
  res.status(204).send();
});
