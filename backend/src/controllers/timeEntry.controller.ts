import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Project, Task, TimeEntry, Workspace } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listTimeEntries = asyncHandler(async (req: Request, res: Response) => {
  const timeEntries = await TimeEntry.findAll({
    where: { userId: req.user?.id },
    include: [{ model: Task, as: 'task', attributes: ['id', 'name'], required: false }],
    order: [['startTime', 'DESC']],
  });
  res.json({ timeEntries });
});

async function assertTaskOwnership(taskId: string, userId: string): Promise<Task> {
  const task = await Task.findByPk(taskId);
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  const project = await Project.findByPk(task.projectId);
  if (!project) {
    throw new ApiError(404, 'Task project not found');
  }

  const workspace = await Workspace.findOne({
    where: { id: project.workspaceId, ownerId: userId },
  });
  if (!workspace) {
    throw new ApiError(404, 'Task not found');
  }

  return task;
}

/** Starts a new running timer. A user may only have one running timer at a time. */
export const startTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const { description, taskId, isBillable } = req.body as {
    description?: string;
    taskId?: string;
    isBillable?: boolean;
  };

  if (!taskId) {
    throw new ApiError(400, 'taskId is required before a timer can be started');
  }
  const task = await assertTaskOwnership(taskId, req.user!.id);

  const runningEntry = await TimeEntry.findOne({
    where: { userId: req.user!.id, endTime: { [Op.is]: null } },
  });
  if (runningEntry) {
    throw new ApiError(409, 'A time entry is already running. Stop it before starting a new one.');
  }

  const timeEntry = await TimeEntry.create({
    description: description ?? '',
    projectId: task.projectId,
    taskId: task.id,
    isBillable,
    startTime: new Date(),
    userId: req.user!.id,
  });

  res.status(201).json({ timeEntry });
});

/** Stops the currently running timer and records its duration. */
export const stopTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const timeEntry = await TimeEntry.findOne({
    where: { id: req.params.id, userId: req.user?.id },
  });
  if (!timeEntry) {
    throw new ApiError(404, 'Time entry not found');
  }
  if (timeEntry.endTime) {
    throw new ApiError(409, 'Time entry is already stopped');
  }
  if (!timeEntry.taskId) {
    throw new ApiError(409, 'Assign a task before stopping this timer');
  }

  const endTime = new Date();
  const durationSeconds = Math.round((endTime.getTime() - timeEntry.startTime.getTime()) / 1000);

  await timeEntry.update({ endTime, durationSeconds });
  res.json({ timeEntry });
});

export const updateTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const timeEntry = await TimeEntry.findOne({
    where: { id: req.params.id, userId: req.user?.id },
  });
  if (!timeEntry) {
    throw new ApiError(404, 'Time entry not found');
  }

  const { description, taskId, isBillable } = req.body as {
    description?: string;
    taskId?: string;
    isBillable?: boolean;
  };

  const effectiveTaskId = taskId ?? timeEntry.taskId;
  if (!effectiveTaskId) {
    throw new ApiError(400, 'taskId is required before a time entry can be saved');
  }
  const task = await assertTaskOwnership(effectiveTaskId, req.user!.id);

  await timeEntry.update({
    description,
    taskId: task.id,
    projectId: task.projectId,
    isBillable,
  });
  res.json({ timeEntry });
});

export const deleteTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await TimeEntry.destroy({
    where: { id: req.params.id, userId: req.user?.id },
  });
  if (!deleted) {
    throw new ApiError(404, 'Time entry not found');
  }
  res.status(204).send();
});
