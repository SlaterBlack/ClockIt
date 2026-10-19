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
  task?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
