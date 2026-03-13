import type {
  EmploymentPeriod,
  EmployeeEvent,
  EmployeeEventType,
  QprRating,
  RecoveryInfo,
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
  | 'patient-edit';

export type CalendarView = 'month' | 'week' | 'year';

export type EventModalType = EmployeeEventType | 'period';

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
  open: boolean;
  id?: number;
  topic: string;
  legalBasis: string;
  note: string;
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
};

export type ConfirmState = {
  message: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  danger?: boolean;
} | null;

export type EditModalState = {
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
  open: boolean;
  id?: number;
  instructionDefinitionId: number | null;
  instructionName: string;
  dueDate: string;
  completedAt: string;
  conductedBy: string;
  note: string;
};

export type SuggestedCompetencyModalState = {
  open: boolean;
  selectedDefinitionIds: number[];
};

export type PeriodToDeleteState = { periodId: number; label: string } | null;

// Patient-related UI types

export type PatientFormState = {
  id?: number;
  name: string;
  birthDate: string;
  diagnosis: string;
  qprStatus: QprRating | '';
  note: string;
};

export type PatientModalState = {
  open: boolean;
  mode: 'create' | 'edit';
  id?: number;
  name: string;
  birthDate: string;
  diagnosis: string;
  qprStatus: QprRating | '';
  note: string;
};

export type VisitModalState = {
  open: boolean;
  id?: number;
  patientId: number;
  visitDate: string;
  qprRating: QprRating;
  comment: string;
};
