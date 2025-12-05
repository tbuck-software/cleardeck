import type { EmploymentPeriod, EmployeeEvent, EmployeeEventType } from '../shared/types';
import type { RecoveryInfo } from '../shared/types';

export type Page = 'dashboard' | 'list' | 'new' | 'edit' | 'settings' | 'view';

export type EventModalType = EmployeeEventType | 'period';

export type TimelineItem =
  | { kind: 'period'; date: string; record: EmploymentPeriod }
  | { kind: 'event'; date: string; record: EmployeeEvent };

export type FormState = {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
  dataSource: string;
  note: string;
  startDate: string;
  endDate: string;
  fte: number;
  weeklyHours?: number | null;
  linked?: boolean;
};

export type QualificationModalState = {
  open: boolean;
  id?: number;
  value: string;
  note: string;
};

export type RecoveryResetState = {
  open: boolean;
  recoveryKey: string;
  newPassword: string;
  repeat: string;
  error?: string | null;
};

export type RecoveryKeyModalState = {
  open: boolean;
  info: RecoveryInfo | null;
  source: 'setup' | 'settings';
};

export type ConfirmState = {
  message: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  danger?: boolean;
} | null;

export type EditModalState = {
  open: boolean;
  name: string;
  note: string;
  weeklyHours: string;
  linked: boolean;
  fteValue: string;
};

export type AddPeriodFormState = {
  startDate: string;
  endDate: string;
  fte: number;
  qualification: string;
  periodId?: number;
  note?: string;
};

export type EventModalState = {
  open: boolean;
  id?: number;
  eventDate: string;
  type: EventModalType;
  title: string;
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
};
