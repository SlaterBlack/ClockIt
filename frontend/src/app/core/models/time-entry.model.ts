import type { PayType } from './pay-type.model';

export interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  isBillable: boolean;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  project?: { id: string; name: string; projectNumber: string | null } | null;
  task?: { id: string; name: string; payType?: PayType } | null;
  user?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
