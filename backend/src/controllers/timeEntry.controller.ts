import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { TimeEntry } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listTimeEntries = asyncHandler(async (req: Request, res: Response) => {
  const timeEntries = await TimeEntry.findAll({
    where: { userId: req.user?.id },
    order: [['startTime', 'DESC']],
  });
  res.json({ timeEntries });
});

/** Starts a new running timer. A user may only have one running timer at a time. */
export const startTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const { description, projectId, isBillable } = req.body as {
    description?: string;
    projectId?: string;
    isBillable?: boolean;
  };

  const runningEntry = await TimeEntry.findOne({
    where: { userId: req.user!.id, endTime: { [Op.is]: null } },
  });
  if (runningEntry) {
    throw new ApiError(409, 'A time entry is already running. Stop it before starting a new one.');
  }

  const timeEntry = await TimeEntry.create({
    description: description ?? '',
    projectId: projectId ?? null,
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

  const { description, projectId, isBillable } = req.body as {
    description?: string;
    projectId?: string | null;
    isBillable?: boolean;
  };

  await timeEntry.update({ description, projectId, isBillable });
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
