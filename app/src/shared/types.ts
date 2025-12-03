export type Qualification =
  | '3-jährig examiniert'
  | '1-jährig examiniert'
  | 'Pflegekraft/-helfer'
  | 'Sonstige';

export interface QualificationType {
  id?: number;
  name: string;
}

export interface Employee {
  id?: number;
  name: string;
  qualification: Qualification | string;
  dataSource?: string;
  note?: string;
  documentPath?: string;
}

export interface EmploymentPeriod {
  id?: number;
  employeeId?: number;
  startDate: string;
  endDate?: string | null;
  fte: number;
  qualification?: Qualification | string | null;
}

export interface EmployeeWithPeriod extends Employee {
  periodId?: number;
  startDate: string;
  endDate?: string | null;
  fte: number;
  status: 'active' | 'new' | 'left';
}

export type EmployeeEventType = 'join' | 'leave' | 'name-change' | 'note-change' | 'custom';

export interface EmployeeEvent {
  id?: number;
  employeeId?: number;
  eventDate: string;
  type: EmployeeEventType;
  title: string;
  details?: string | null;
  meta?: Record<string, unknown> | null;
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
}

export interface AppState {
  configured: boolean;
  unlocked: boolean;
}
