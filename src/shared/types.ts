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
  birthDate?: string | null;
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
}

export type EmployeeEventType =
  | 'join'
  | 'leave'
  | 'name-change'
  | 'note-change'
  | 'fte-change'
  | 'weekly-hours-change'
  | 'care-visit'
  | 'emergency-training'
  | 'custom';

export type UnifiedEventType =
  | EmployeeEventType
  | 'birthday'
  | 'anniversary'
  | 'certificate-expiry'
  | 'patient-birthday'
  | 'patient-visit';

export interface EmployeeEvent {
  id?: number;
  employeeId?: number;
  eventDate: string;
  type: EmployeeEventType | UnifiedEventType;
  title: string;
  details?: string | null;
  meta?: Record<string, unknown> | null;
  previousValue?: string | null;
  newValue?: string | null;
  expiresAt?: string | null;
}

export interface UpcomingEvent extends EmployeeEvent {
  employeeName: string;
  patientId?: number;
  patientName?: string;
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
  employeeId?: number;
  employeeName?: string;
  patientId?: number;
  patientName?: string;
  type: UnifiedEventType;
  date: string;
  title: string;
  subtitle?: string;
  urgency?: 'normal' | 'warning' | 'urgent';
}

// Patient types (QPR 2026)

export type QprRating = 'A' | 'B' | 'C' | 'D';

export interface Patient {
  id?: number;
  name: string;
  birthDate?: string | null;
  diagnosis?: string | null;
  qprStatus?: QprRating | null;
  note?: string | null;
  createdAt?: string;
}

export interface PatientVisit {
  id?: number;
  patientId: number;
  visitDate: string;
  qprRating: QprRating;
  comment?: string | null;
  createdAt?: string;
}

export interface PatientWithLatestVisit extends Patient {
  latestVisitDate?: string | null;
  latestQprRating?: QprRating | null;
  visitCount?: number;
}

export interface PatientConcerningRating {
  patientId: number;
  patientName: string;
  visitId: number;
  visitDate: string;
  qprRating: QprRating;
  comment?: string | null;
}

export interface PatientStats {
  totalPatients: number;
  byRating: {
    A: number;
    B: number;
    C: number;
    D: number;
    unrated: number;
  };
  recentVisits: number;
  concerningCount: number;
}

export interface PatientBirthdayEvent {
  patientId: number;
  patientName: string;
  birthDate: string;
  date: string;
  hasKnownYear: boolean;
}

export interface PatientVisitEvent {
  visitId: number;
  patientId: number;
  patientName: string;
  visitDate: string;
  qprRating: QprRating;
  comment: string | null;
}
