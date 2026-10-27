import type { UserRole } from './user.model';

export type ReportFrequencyUnit = 'days' | 'weeks';

export interface ScheduledReportConfig {
  startDate: string | null;
  frequencyUnit: ReportFrequencyUnit;
  frequencyInterval: number;
  reportPeriodDays: number;
  sendWeekday: number;
  sendTime: string;
  timezone: string;
  includeAllUsers: boolean;
  includedUserIds: string[];
  recipientUserIds: string[];
  enabled: boolean;
}

export interface ScheduledReportUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ScheduledReportSettingsResponse {
  config: ScheduledReportConfig;
  users: ScheduledReportUser[];
  smtpConfigured: boolean;
  latestDelivery: {
    status: 'pending' | 'sent' | 'failed';
    periodStart: string;
    sentAt: string | null;
    errorMessage: string | null;
  } | null;
}
