import { Request, Response } from 'express';
import { Workspace } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listWorkspaces = asyncHandler(async (req: Request, res: Response) => {
  const workspaces = await Workspace.findAll({ where: { ownerId: req.user?.id } });
  res.json({ workspaces });
});

export const createWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    throw new ApiError(400, 'name is required');
  }

  const workspace = await Workspace.create({ name, ownerId: req.user!.id });
  res.status(201).json({ workspace });
});

export const getWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await Workspace.findOne({
    where: { id: req.params.id, ownerId: req.user?.id },
  });
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }
  res.json({ workspace });
});

export const deleteWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Workspace.destroy({
    where: { id: req.params.id, ownerId: req.user?.id },
  });
  if (!deleted) {
    throw new ApiError(404, 'Workspace not found');
  }
  res.status(204).send();
});
