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
  note?: string;
  weeklyHours?: number | null;
  fte?: number | null;
  createdAt?: string;
}

export interface EmploymentPeriod {
  id?: number;
  employeeId?: number;
  startDate: string;
  endDate?: string | null;
  qualification: Qualification | string;
  note?: string | null;
}

export interface EmployeeWithPeriod extends Employee {
  periodId?: number;
  startDate: string;
  endDate?: string | null;
  fte: number;
  status: 'active' | 'left';
  weeklyHours?: number | null;
  qualification: Qualification | string;
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

export interface RecoveryInfo {
  recoveryKey: string;
  fingerprint: string;
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version?: string }
  | { state: 'not-available' }
  | { state: 'downloading'; version?: string; progress?: number }
  | { state: 'downloaded'; version?: string }
  | { state: 'error'; message: string };

export interface AppInfo {
  name: string;
  version: string;
  author: string;
  email: string;
  github: string;
  license: string;
  copyright: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}
