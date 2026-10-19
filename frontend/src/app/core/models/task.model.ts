import type { PayType } from './pay-type.model';

export interface Task {
  id: string;
  name: string;
  projectId: string;
  payType: PayType;
  createdAt: string;
  updatedAt: string;
}
