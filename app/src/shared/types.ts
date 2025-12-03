export type Qualification =
  | '3-jährig examiniert'
  | '1-jährig examiniert'
  | 'Pflegekraft/-helfer'
  | 'Sonstige';

export interface QualificationType {
  id?: number;
  name: string;
  note?: string | null;
}

export interface Employee {
  id?: number;
  name: string;
  qualification: Qualification | string;
  dataSource?: string;
  note?: string;
  documentPath?: string;
  weeklyHours?: number | null;
}

export interface EmploymentPeriod {
  id?: number;
  employeeId?: number;
  startDate: string;
  endDate?: string | null;
  fte: number;
  qualification?: Qualification | string | null;
  note?: string | null;
}

export interface EmployeeWithPeriod extends Employee {
  periodId?: number;
  startDate: string;
  endDate?: string | null;
  fte: number;
  status: 'active' | 'new' | 'left';
  weeklyHours?: number | null;
}

export type EmployeeEventType =
  | 'join'
  | 'leave'
  | 'name-change'
  | 'note-change'
  | 'care-visit'
  | 'emergency-training'
  | 'custom';

export interface EmployeeEvent {
  id?: number;
  employeeId?: number;
  eventDate: string;
  type: EmployeeEventType;
  title: string;
  details?: string | null;
  meta?: Record<string, unknown> | null;
  previousValue?: string | null;
  newValue?: string | null;
}

export interface Aggregation {
  totalHeadcount: number;
  totalFte: number;
  categories: {
    qualification: string;
    headcount: number;
    fte: number;
  }[];
}

export interface YearDataset {
  employees: EmployeeWithPeriod[];
  aggregation: Aggregation;
  baseHours?: number;
}

export interface AppState {
  configured: boolean;
  unlocked: boolean;
}
