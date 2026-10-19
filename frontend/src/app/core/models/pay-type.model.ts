export const PAY_TYPES = [
  { value: 'hourly', label: 'Hourly Pay', defaultEarningsRate: 'Ordinary Hours' },
  { value: 'public-holiday', label: 'Public Holiday', defaultEarningsRate: 'Public Holiday' },
  { value: 'sick-leave', label: 'Sick Leave', defaultEarningsRate: 'Sick Leave' },
  { value: 'annual-leave', label: 'Annual Leave', defaultEarningsRate: 'Annual Leave' },
] as const;

export type PayType = (typeof PAY_TYPES)[number]['value'];

export function payTypeLabel(payType: PayType | undefined): string {
  return PAY_TYPES.find((type) => type.value === payType)?.label ?? PAY_TYPES[0].label;
}
