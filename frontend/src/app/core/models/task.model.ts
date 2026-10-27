import type { PayType } from './pay-type.model';

export interface Task {
  id: string;
  name: string;
  projectId: string;
  payType: PayType;
  isBillable: boolean;
  createdAt: string;
  updatedAt: string;
}
