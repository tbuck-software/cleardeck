export type Qualification =
  | '3-jaehrig examiniert'
  | '1-jaehrig examiniert'
  | 'Pflegekraft/-helfer'
  | 'Sonstige';

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
