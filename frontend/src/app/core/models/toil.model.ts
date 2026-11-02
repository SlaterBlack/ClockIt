export interface ToilUserSettings {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  contractedHoursPerCycle: number | null;
}

export interface ToilUsage {
  id: string;
  userId: string;
  userName: string;
  usageDate: string;
  hours: number;
  reason: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface ToilSettingsResponse {
  accrualMultiplier: number;
  payCycle: {
    startDate: string | null;
    periodDays: number;
  };
  users: ToilUserSettings[];
  usages: ToilUsage[];
}

export interface ToilReportTotals {
  accruedHours: Map<string, number>;
  usedHours: Map<string, number>;
}
