import type {
  AuditResultValue,
  EmploymentPeriod,
  EmployeeEvent,
  EmployeeEventType,
  HkpCode,
  IntensiveCare,
  CareLevel,
  IntervalSource,
  RecoveryInfo,
  ServiceScopeSource,
  StorageMode,
} from '../shared/types';

export type Page =
  | 'dashboard'
  | 'list'
  | 'new'
  | 'edit'
  | 'settings'
  | 'view'
  | 'dev'
  | 'calendar'
  | 'patients'
  | 'patient-view'
  | 'patient-new'
  | 'patient-edit'
  | 'audit'
  | 'tasks'
  | 'quals'
  | 'services'
  | 'comps'
  | 'instrs'
  | 'security'
  | 'about'
  | 'logs'
  | 'shortcuts';

/** Pages that live behind the Einstellungen sidebar rather than the main nav. */
export const SETTINGS_PAGES: Page[] = ['settings', 'security', 'about', 'logs', 'shortcuts'];

/** Filter for the Patient:innen list — 'D' means "has an aufwändige HKP code". */
export type TeilgruppeFilter = 'archived' | 'all' | 'A' | 'B' | 'C' | 'D';

export type CalendarView = 'month' | 'week' | 'year';

export type EventModalType = EmployeeEventType | 'period' | 'working-time';

export type TimelineItem =
  | { kind: 'period'; date: string; record: EmploymentPeriod }
  | { kind: 'event'; date: string; record: EmployeeEvent };

export type FormState = {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
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

export type QualificationModalPayload = Pick<QualificationModalState, 'id' | 'value' | 'note'>;

export type CompetencyModalState = {
  open: boolean;
  id?: number;
  code: string;
  value: string;
  category: string;
  relevance: string;
  note: string;
};

export type CompetencyModalPayload = Pick<
  CompetencyModalState,
  'id' | 'code' | 'value' | 'category' | 'relevance' | 'note'
>;

export type InstructionModalState = {
  minorHazardInstruction?: boolean;
  open: boolean;
  id?: number;
  topic: string;
  legalBasis: string;
  note: string;
  /** Empty means "no fixed interval" — see docs/adr/0002. */
  intervalMonths: number | null;
  intervalSource: IntervalSource;
};

export type InstructionModalPayload = Pick<
  InstructionModalState,
  'id' | 'topic' | 'legalBasis' | 'note'
>;

export type RecoveryResetState = {
  open: boolean;
  recoveryKey: string;
  newPassword: string;
  repeat: string;
  error?: string | null;
};

export type EncryptionSetupState = {
  open: boolean;
  password: string;
  repeat: string;
  error?: string | null;
  nextMode: StorageMode;
};

export type RecoveryKeyModalState = {
  open: boolean;
  info: RecoveryInfo | null;
  source: 'setup' | 'settings';
};

export type ConfirmActionOptions = {
  confirmLabel?: string;
  danger?: boolean;
  title?: string;
  /** Word the user must retype before the action arms. For irreversible ones. */
  confirmPhrase?: string;
};

export type ConfirmState = {
  message: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  danger?: boolean;
  title?: string;
  confirmPhrase?: string;
} | null;

export type EditModalState = {
  sourceRef?: string | null;
  hoursEffectiveFrom?: string;
  initialHoursEffectiveFrom?: string;
  open: boolean;
  mode: 'edit' | 'create';
  name: string;
  note: string;
  weeklyHours: string;
  linked: boolean;
  fteValue: string;
  birthDate: string;
};

export type AddPeriodFormState = {
  startDate: string;
  endDate: string;
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
  expiresAt?: string | null;
};

export type EmployeeCompetencyModalState = {
  stageHistory?: {
    stageScheme?: string;
    changedAt: string;
    level: number | null;
    approvedAt: string | null;
    approvedBy: string | null;
    note: string | null;
  }[];
  stageScheme?: 'legacy' | 'practice-v1';
  open: boolean;
  id?: number;
  competencyDefinitionId: number | null;
  competencyName: string;
  level: number | null;
  approvedAt: string;
  approvedBy: string;
  note: string;
};

export type EmployeeInstructionModalState = {
  evidenceRef?: string;
  content?: string;
  scheduleReviewRequired?: boolean;
  open: boolean;
  id?: number;
  instructionDefinitionId: number | null;
  instructionName: string;
  dueDate: string;
  completedAt: string;
  conductedBy: string;
  note: string;
  /** Only offered when the definition carries an interval. */
  scheduleFollowUp: boolean;
};

export type SuggestedCompetencyModalState = {
  open: boolean;
  selectedDefinitionIds: number[];
};

export type PeriodToDeleteState = { periodId: number; label: string } | null;

// Patient-related UI types

export type PatientModalState = {
  serviceStatus?: 'active' | 'ended';
  serviceEndDate?: string | null;
  serviceScope?: 'eligible' | 'excluded' | 'unknown';
  serviceDefinitionIds?: number[];
  serviceScopeSource?: ServiceScopeSource;
  representativeStatus?: 'present' | 'none' | 'unknown';
  hkpCodes?: HkpCode[];
  assessmentSource?: 'report' | 'own' | 'unknown';
  assessmentDate?: string | null;
  assessmentNote?: string | null;
  akiSetting?: 'EV' | 'MV' | null;
  phkpFirst?: boolean;
  phkpStartDate?: string | null;

  open: boolean;
  mode: 'create' | 'edit';
  id?: number;
  name: string;
  birthDate: string;
  diagnosis: string;
  note: string;
  contact: string;
  admissionDate: string;
  /** null = not yet taken from the Pflegegrad-Gutachten. */
  cognitionImpaired: boolean | null;
  mobilityImpaired: boolean | null;
  hkpCode: HkpCode | null;
  intensiveCare: IntensiveCare | null;
  careLevel: CareLevel | null;
};

export type VisitModalState = {
  assignedTo?: string | null;
  actionDueDate?: string | null;
  status?: 'planned' | 'completed';
  resolvedAt?: string | null;
  open: boolean;
  id?: number;
  patientId: number;
  visitDate: string;
  actionNeeded: boolean;
  comment: string;
};

export type AuditModalState = {
  reportRef?: string;
  confirmed?: boolean;
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  id?: number;
  auditDate: string;
  inspector: string;
  kind: 'regel' | 'anlass';
  findings: string;
  results: Record<string, AuditResultValue>;
  clientIds: number[];
};
