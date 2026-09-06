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

export interface CompetencyDefinition {
  id?: number;
  code?: string | null;
  name: string;
  category?: string | null;
  relevance?: string | null;
  note?: string | null;
  sortOrder?: number | null;
}

export interface EmployeeCompetency {
  stageScheme?: 'legacy' | 'practice-v1';
  stageHistory?: {
    stageScheme?: string;
    changedAt: string;
    level: number | null;
    approvedAt: string | null;
    approvedBy: string | null;
    note: string | null;
  }[];
  id?: number;
  employeeId?: number;
  competencyDefinitionId: number;
  competencyCode?: string | null;
  competencyName: string;
  category?: string | null;
  relevance?: string | null;
  level?: number | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  note?: string | null;
  definitionNote?: string | null;
  sortOrder?: number | null;
}

/** Where a repetition interval comes from — see docs/adr/0002. */
export type IntervalSource = 'norm' | 'betrieblich';

export interface InstructionDefinition {
  minorHazardInstruction?: boolean;
  id?: number;
  topic: string;
  legalBasis?: string | null;
  note?: string | null;
  sortOrder?: number | null;
  /** null means "no fixed interval" — a valid state, never a missing value. */
  intervalMonths?: number | null;
  intervalSource?: IntervalSource | null;
}

export interface EmployeeInstruction {
  minorHazardInstruction?: boolean;
  evidenceRef?: string | null;
  content?: string | null;
  scheduleReviewRequired?: boolean;
  id?: number;
  employeeId?: number;
  instructionDefinitionId: number;
  instructionName: string;
  legalBasis?: string | null;
  intervalMonths?: number | null;
  intervalSource?: IntervalSource | null;
  dueDate?: string | null;
  completedAt?: string | null;
  conductedBy?: string | null;
  note?: string | null;
  sortOrder?: number | null;
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
  sourceRef?: string | null;
  hoursHistory?: {
    effectiveFrom: string;
    weeklyHours: number | null;
    fte: number | null;
    verified: number;
    sourceRef: string | null;
    changedAt: string;
  }[];
  hoursVerified?: boolean;
  hoursMissing?: boolean;
  reportDays?: number;
  unweightedFte?: number | null;
  hoursEffectiveFrom?: string;
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
  | 'instruction-due'
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
  availableYears?: number[];
  reportMode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory';
  referenceDate?: string;
  unverifiedHoursCount?: number;
  employees: EmployeeWithPeriod[];
  aggregation: Aggregation;
  baseHours?: number;
}

export type StorageMode = 'encrypted' | 'plain';

export interface AppState {
  configured: boolean;
  unlocked: boolean;
  storageMode: StorageMode;
  startupError?: string;
}

export interface RecoveryInfo {
  recoveryKey: string;
  fingerprint: string;
}

export type UpdateStatus = {
  version?: string;
  releaseNotes?: string;
} & (
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'not-available' }
  | { state: 'downloading'; progress?: number; remainingSeconds?: number }
  | { state: 'downloaded' }
  | { state: 'installing' }
  | { state: 'error'; message: string; retry?: 'check' | 'download' | 'install' }
);

export interface DiagnosticEntry {
  at: string;
  level: 'info' | 'error';
  source: 'App' | 'Updates';
  message: string;
}
export interface DiagnosticSnapshot {
  entries: DiagnosticEntry[];
  storageError?: string;
}

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

export interface DashboardEmployeeBucket {
  employeeId: number;
  employeeName: string;
  count: number;
}

export interface EmployeeDashboardStats {
  instructions: {
    totalAssigned: number;
    overdue: number;
    dueSoon: number;
    completedRate: number;
    topOpenEmployees: DashboardEmployeeBucket[];
  };
  competencies: {
    totalAssigned: number;
    open: number;
    pendingApproval: number;
    approvedRate: number;
    topGapEmployees: DashboardEmployeeBucket[];
  };
}

export interface OpenInstruction {
  evidenceMissing?: boolean;
  id: number;
  employeeId: number;
  employeeName: string;
  topic: string;
  legalBasis?: string | null;
  dueDate: string | null;
  scheduleReviewRequired?: boolean;
  /** Negative once the due date has passed. */
  daysUntilDue: number | null;
}

/** Assignment counts per catalogue entry, keyed by definition id. */
export interface DefinitionUsage {
  competencies: Record<number, number>;
  instructions: Record<number, number>;
}

export type AutoBackupMode = 'off' | 'close' | 'daily' | 'weekly';

export interface BackupFileInfo {
  file: string;
  path: string;
  size: number;
  modifiedAt: string;
}

/** Backup configuration plus what is currently in the folder. */
export interface BackupState {
  folder: string | null;
  auto: AutoBackupMode;
  keep: number;
  lastBackupAt: string | null;
  lastBackupError?: string | null;
  backups: BackupFileInfo[];
}

/** Cadence settings that shape due dates across the app. */
export interface CareSettings {
  visitIntervalDays: number;
  instructionReminderDays: number;
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

// Patient types (QPR ambulant, Teil 1a, gültig ab 01.07.2026)
//
// Three separate things used to share the letters A–D. They are kept apart here:
//   Teilgruppe    — which MD sampling group a person falls in (below)
//   Pflegevisite  — internal QM; carries actionNeeded, never a letter
//   Prüfergebnis  — the MD's per-quality-aspect result (see AuditResultValue)
// See docs/adr/0001-qpr-stichprobe-pflegevisite-und-pruefergebnisse.md.

/** MD sampling group from the Pflegegrad assessment. `none` = no impairment. */
export type Teilgruppe = 'A' | 'B' | 'C' | 'none';

/** The four HKP codes that alone justify Teilgruppe D (QPR Kap. 8 Abs. 3). */
export type HkpCode = '6' | '8' | '29' | '31a';

/** Außerklinische Intensivpflege / psychiatrische HKP, incl. Erstverordnung. */
export type IntensiveCare = 'AKI' | 'AKI-B' | 'pHKP' | 'pHKP-EV';

export interface Patient {
  legacyQprStatus?: string | null;
  serviceStatus?: 'active' | 'ended';
  serviceEndDate?: string | null;
  serviceScope?: 'eligible' | 'excluded' | 'unknown';
  representativeStatus?: 'present' | 'none' | 'unknown';
  hkpCodes?: HkpCode[];
  assessmentSource?: 'report' | 'own' | 'unknown';
  assessmentDate?: string | null;
  assessmentNote?: string | null;
  akiSetting?: 'EV' | 'MV' | null;
  phkpFirst?: boolean;
  phkpStartDate?: string | null;

  id?: number;
  name: string;
  birthDate?: string | null;
  diagnosis?: string | null;
  note?: string | null;
  createdAt?: string;
  /** Name (Bezug) · Telefon — required on the Anlage 7 person list. */
  contact?: string | null;
  admissionDate?: string | null;
  /** Modul 2 ≥ 6 points, or own assessment. null = assessment data missing. */
  cognitionImpaired?: boolean | null;
  /** Modul 1 ≥ 4 points, or own assessment. null = assessment data missing. */
  mobilityImpaired?: boolean | null;
  hkpCode?: HkpCode | null;
  intensiveCare?: IntensiveCare | null;
  careLevel?: number | null;
}

export interface PatientVisit {
  legacyQprRating?: string | null;
  assignedTo?: string | null;
  actionDueDate?: string | null;
  status?: 'planned' | 'completed';
  resolvedAt?: string | null;
  id?: number;
  patientId: number;
  visitDate: string;
  /** Follow-up required — surfaces in "Heute zu tun" until explicit resolution. */
  actionNeeded: boolean;
  comment?: string | null;
  createdAt?: string;
}

export interface PatientWithLatestVisit extends Patient {
  openActionOwner?: string | null;
  openActionDueDate?: string | null;
  latestVisitDate?: string | null;
  latestActionNeeded?: boolean | null;
  visitCount?: number;
}

export interface PatientActionNeeded {
  patientId: number;
  patientName: string;
  visitId: number;
  visitDate: string;
  comment?: string | null;
}

export interface PatientStats {
  totalPatients: number;
  /** Headcount per sampling group; `unrated` lacks assessment data entirely. */
  byGroup: {
    A: number;
    B: number;
    C: number;
    none: number;
    unrated: number;
  };
  /** Teilgruppe D is an additional mark, so it is counted separately. */
  hkpCount: number;
  intensiveCareCount: number;
  recentVisits: number;
  actionNeededCount: number;
  missingContactCount: number;
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
  status?: 'planned' | 'completed';
  visitDate: string;
  actionNeeded: boolean;
  comment: string | null;
}

// MD audit (Qualitätsprüfung) types

/** QB 1–3 scale. QB 4 is descriptive, QB 5 and Abrechnung are pass/fail. */
export type AuditResultValue = 'A' | 'B' | 'C' | 'D' | 'text' | 'ok' | 'no' | 'unrecorded';

export type AuditSectionScale = 'abcd' | 'text' | 'yesno';

export interface AuditSectionDefinition {
  key: string;
  name: string;
  scale: AuditSectionScale;
}

export interface AuditResult {
  sectionKey: string;
  result: AuditResultValue;
  note?: string | null;
}

export interface Audit {
  reportRef?: string | null;
  confirmed?: boolean;
  id?: number;
  auditDate: string;
  inspector?: string | null;
  /** Regelprüfung is announced two working days ahead (§ 114a SGB XI). */
  kind?: 'regel' | 'anlass' | null;
  findings?: string | null;
  createdAt?: string;
}

export interface AuditWithDetails extends Audit {
  results: AuditResult[];
  clientIds: number[];
}
