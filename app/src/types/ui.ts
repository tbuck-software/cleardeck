import type { EmploymentPeriod, EmployeeEvent, EmployeeEventType } from '../shared/types';

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
