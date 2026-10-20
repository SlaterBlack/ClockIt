import type { Task } from './task.model';

export interface Project {
  id: string;
  name: string;
  projectNumber: string | null;
  color: string;
  isBillable: boolean;
  archived: boolean;
  workspaceId: string;
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}
