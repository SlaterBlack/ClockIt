export type DashboardReminderFrequencyUnit = 'days' | 'weeks';

export interface DashboardReminderRule {
  id: string;
  text: string;
  startDate: string;
  frequencyUnit: DashboardReminderFrequencyUnit;
  frequencyInterval: number;
  weekdays: number[];
  startTime: string;
  endTime: string;
  timezone: string;
  enabled: boolean;
}

export type DashboardReminderInput = Omit<DashboardReminderRule, 'id'>;

export interface ActiveDashboardReminder {
  id: string;
  text: string;
}
