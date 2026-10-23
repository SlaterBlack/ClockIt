export interface TimeEntryImport {
  startTime: string;
  endTime: string;
  projectNumber: string | null;
  projectName: string;
  taskName: string;
  description: string;
  isBillable: boolean;
}
