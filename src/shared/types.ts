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

export interface Department {
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
  birthDate?: string | null;
  department?: string | null;
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
  birthDate?: string | null;
  department?: string | null;
}

export type EmployeeEventType =
  | 'join'
  | 'leave'
  | 'name-change'
  | 'note-change'
  | 'care-visit'
  | 'emergency-training'
  | 'custom';

export type UnifiedEventType =
  | EmployeeEventType
  | 'birthday'
  | 'anniversary'
  | 'certificate-expiry';

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
  expiresAt?: string | null;
}

export interface UpcomingEvent extends EmployeeEvent {
  employeeName: string;
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

// Dashboard widget types

export interface ExpiringTraining {
  id: number;
  employeeId: number;
  employeeName: string;
  type: EmployeeEventType;
  title: string;
  eventDate: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface DepartmentStats {
  department: string;
  headcount: number;
  fte: number;
}

export interface BirthdayAnniversary {
  employeeId: number;
  employeeName: string;
  type: 'birthday' | 'anniversary';
  date: string;
  displayDate: string;
  age?: number;
  years?: number;
}

export interface UnifiedEvent {
  id: string;
  employeeId: number;
  employeeName: string;
  type: UnifiedEventType;
  date: string;
  title: string;
  subtitle?: string;
  urgency?: 'normal' | 'warning' | 'urgent';
}
