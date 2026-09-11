import type { StaffImportPreview, StaffImportRow } from './shared/staffImport';
import { contextBridge, ipcRenderer } from 'electron';
import type {
  BulkCompetencyChange,
  SaveWorkingTimeInput,
  AppState,
  AppInfo,
  EmploymentPeriod,
  QualificationType,
  CompetencyDefinition,
  EmployeeCompetency,
  YearDataset,
  EmployeeEvent,
  EmployeeEventType,
  EmployeeInstruction,
  InstructionDefinition,
  IntervalSource,
  UpdateStatus,
  DiagnosticSnapshot,
  RecoveryInfo,
  UpcomingEvent,
  ExpiringTraining,
  BirthdayAnniversary,
  EmployeeDashboardStats,
  OpenInstruction,
  CareSettings,
  CareLevel,
  BackupState,
  DefinitionUsage,
  Patient,
  PatientVisit,
  PatientWithLatestVisit,
  PatientActionNeeded,
  PatientStats,
  PatientBirthdayEvent,
  PatientVisitEvent,
  HkpCode,
  IntensiveCare,
  AuditResult,
  AuditSectionDefinition,
  AuditWithDetails,
  StorageMode,
  EmploymentIntegrityOverview,
  PeriodDatePreview,
  ConsolidatePreview,
  EmployeeMergePreview,
  ReconcilePeriodsPreview,
} from './shared/types';

type ExportFormat = 'csv' | 'xlsx';

export type Api = {
  getAppState: () => Promise<AppState>;
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<boolean>;
  register: (password: string) => Promise<AppState>;
  registerPlain: () => Promise<AppState>;
  login: (password: string) => Promise<AppState>;
  lock: () => Promise<AppState>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<AppState>;
  enableEncryption: (password: string) => Promise<AppState>;
  disableEncryption: () => Promise<AppState>;
  getRecoveryKey: () => Promise<RecoveryInfo>;
  recoverWithKey: (input: { recoveryKey: string; newPassword: string }) => Promise<AppState>;
  chooseStaffImport: () => Promise<StaffImportPreview | null>;
  commitStaffImport: (rows: StaffImportRow[]) => Promise<{ imported: number; safetyPath: string }>;
  listEmployees: (
    year: number,
    mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory',
  ) => Promise<YearDataset>;
  listPeriods: (employeeId: number) => Promise<EmploymentPeriod[]>;
  listEvents: (employeeId: number) => Promise<EmployeeEvent[]>;
  saveWorkingTime: (input: SaveWorkingTimeInput) => Promise<void>;
  saveEmployee: (input: {
    id?: number;
    periodId?: number;
    name: string;
    qualification: string;
    note?: string;
    weeklyHours?: number | null;
    startDate: string;
    endDate?: string | null;
    fte: number;
    year: number;
    periodNote?: string | null;
    linked?: boolean;
    birthDate?: string | null;
    sourceRef?: string | null;
    hoursEffectiveFrom?: string;
    hoursVerified?: boolean;
    updateHours?: boolean;
    department?: string | null;
  }) => Promise<YearDataset>;
  deleteEmployee: (id: number, year: number) => Promise<YearDataset>;
  saveEvent: (input: {
    id?: number;
    employeeId: number;
    eventDate: string;
    type: EmployeeEventType;
    title: string;
    details?: string | null;
    meta?: Record<string, unknown> | null;
    previousValue?: string | null;
    newValue?: string | null;
    expiresAt?: string | null;
  }) => Promise<EmployeeEvent[]>;
  deleteEvent: (id: number, employeeId: number) => Promise<EmployeeEvent[]>;
  listUpcomingEvents: (fromDate?: string, limit?: number) => Promise<UpcomingEvent[]>;
  listEventsInRange: (startDate: string, endDate: string) => Promise<UpcomingEvent[]>;
  exportData: (
    year: number,
    format: ExportFormat,
    mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory',
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  openDocument: (path: string) => Promise<void>;
  listQualifications: () => Promise<QualificationType[]>;
  addQualification: (name: string, note?: string | null) => Promise<QualificationType[]>;
  updateQualification: (
    id: number,
    name: string,
    note?: string | null,
  ) => Promise<QualificationType[]>;
  deleteQualification: (id: number) => Promise<QualificationType[]>;
  reorderQualifications: (ids: number[]) => Promise<QualificationType[]>;
  listCompetencyDefinitions: () => Promise<CompetencyDefinition[]>;
  addCompetencyDefinition: (input: {
    code?: string | null;
    name: string;
    category?: string | null;
    relevance?: string | null;
    note?: string | null;
  }) => Promise<CompetencyDefinition[]>;
  updateCompetencyDefinition: (input: {
    id: number;
    code?: string | null;
    name: string;
    category?: string | null;
    relevance?: string | null;
    note?: string | null;
  }) => Promise<CompetencyDefinition[]>;
  deleteCompetencyDefinition: (id: number) => Promise<CompetencyDefinition[]>;
  reorderCompetencyDefinitions: (ids: number[]) => Promise<CompetencyDefinition[]>;
  listEmployeeCompetencies: (employeeId: number) => Promise<EmployeeCompetency[]>;
  bulkChangeCompetencies: (input: BulkCompetencyChange) => Promise<EmployeeCompetency[]>;
  saveEmployeeCompetency: (input: {
    stageScheme?: 'legacy' | 'practice-v1';
    id?: number;
    employeeId: number;
    competencyDefinitionId: number;
    level?: number | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    note?: string | null;
  }) => Promise<EmployeeCompetency[]>;
  deleteEmployeeCompetency: (
    employeeId: number,
    competencyDefinitionId: number,
  ) => Promise<EmployeeCompetency[]>;
  listInstructionDefinitions: () => Promise<InstructionDefinition[]>;
  addInstructionDefinition: (input: {
    topic: string;
    legalBasis?: string | null;
    note?: string | null;
    intervalMonths?: number | null;
    intervalSource?: IntervalSource | null;
    minorHazardInstruction?: boolean;
  }) => Promise<InstructionDefinition[]>;
  updateInstructionDefinition: (input: {
    id: number;
    topic: string;
    legalBasis?: string | null;
    note?: string | null;
    intervalMonths?: number | null;
    intervalSource?: IntervalSource | null;
    minorHazardInstruction?: boolean;
  }) => Promise<InstructionDefinition[]>;
  deleteInstructionDefinition: (id: number) => Promise<InstructionDefinition[]>;
  reorderInstructionDefinitions: (ids: number[]) => Promise<InstructionDefinition[]>;
  listEmployeeInstructions: (employeeId: number) => Promise<EmployeeInstruction[]>;
  saveEmployeeInstruction: (input: {
    id?: number;
    employeeId: number;
    instructionDefinitionId: number;
    dueDate?: string | null;
    completedAt?: string | null;
    conductedBy?: string | null;
    note?: string | null;
    scheduleFollowUp?: boolean;
    evidenceRef?: string | null;
    content?: string | null;
    scheduleReviewRequired?: boolean;
  }) => Promise<EmployeeInstruction[]>;
  deleteEmployeeInstruction: (
    employeeId: number,
    recordId: number,
  ) => Promise<EmployeeInstruction[]>;
  employeesWithOpenInstruction: (instructionDefinitionId: number) => Promise<number[]>;
  /** Resolves with the number actually assigned; people with an open entry are skipped. */
  assignInstructionToEmployees: (input: {
    instructionDefinitionId: number;
    employeeIds: number[];
    dueDate?: string | null;
  }) => Promise<number>;
  exportDatabase: (
    mode: 'encrypted' | 'plain',
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  importDatabase: (
    mode: 'encrypted' | 'plain',
    recoveryKey?: string,
  ) => Promise<{ imported: boolean; error?: string; backupPath?: string }>;
  deletePeriod: (periodId: number, year: number) => Promise<YearDataset>;
  getEmploymentIntegrityOverview: () => Promise<EmploymentIntegrityOverview>;
  previewPeriodDateCorrection: (input: {
    periodId: number;
    startDate: string;
    endDate: string | null;
  }) => Promise<PeriodDatePreview>;
  applyPeriodDateCorrection: (input: {
    periodId: number;
    startDate: string;
    endDate: string | null;
    previewToken: string;
  }) => Promise<void>;
  previewConsolidatePeriods: (input: { periodIds: [number, number] }) => Promise<ConsolidatePreview>;
  applyConsolidatePeriods: (input: {
    periodIds: [number, number];
    previewToken: string;
  }) => Promise<void>;
  previewEmployeeMerge: (input: {
    targetEmployeeId: number;
    sourceEmployeeId: number;
  }) => Promise<EmployeeMergePreview>;
  applyEmployeeMerge: (input: {
    targetEmployeeId: number;
    sourceEmployeeId: number;
    previewToken: string;
  }) => Promise<void>;
  previewReconcilePeriods: (input: {
    periodIds: [number, number];
    retainedPeriodId: number;
    startDate: string;
    endDate: string | null;
  }) => Promise<ReconcilePeriodsPreview>;
  applyReconcilePeriods: (input: {
    periodIds: [number, number];
    retainedPeriodId: number;
    startDate: string;
    endDate: string | null;
    previewToken: string;
  }) => Promise<void>;
  deleteDatabase: () => Promise<boolean>;
  resetApp: () => Promise<AppState>;
  getBaseHours: () => Promise<number>;
  setBaseHours: (hours: number) => Promise<number>;
  getStorageMode: () => Promise<StorageMode>;
  getHiddenEventTypes: () => Promise<string[]>;
  setHiddenEventTypes: (types: string[]) => Promise<string[]>;
  readDiagnostics: () => Promise<DiagnosticSnapshot>;
  openDiagnosticsFolder: () => Promise<boolean>;
  clearDiagnostics: () => Promise<void>;
  exportDiagnostics: () => Promise<boolean>;
  checkUpdates: (manual?: boolean) => Promise<boolean>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  getDevTables: () => Promise<Record<string, Record<string, unknown>[]>>;
  // Dashboard widgets
  getExpiringTrainings: (withinDays?: number, limit?: number) => Promise<ExpiringTraining[]>;
  getBirthdaysAndAnniversaries: (
    withinDays?: number,
    limit?: number,
  ) => Promise<BirthdayAnniversary[]>;
  getEmployeeDashboardStats: (
    dueSoonDays?: number,
    limit?: number,
  ) => Promise<EmployeeDashboardStats>;
  listOpenInstructions: (limit?: number) => Promise<OpenInstruction[]>;
  getDefinitionUsage: () => Promise<DefinitionUsage>;
  getBackupSettings: () => Promise<BackupState>;
  setBackupSettings: (input: Partial<BackupState>) => Promise<BackupState>;
  chooseBackupFolder: () => Promise<BackupState>;
  runBackup: () => Promise<{
    saved: boolean;
    file?: string;
    error?: string;
    settings: BackupState;
  }>;
  restoreBackup: (
    path: string,
    recoveryKey?: string,
  ) => Promise<{ saved: boolean; file?: string; error?: string; settings: BackupState }>;
  getCareSettings: () => Promise<CareSettings>;
  setCareSettings: (input: Partial<CareSettings>) => Promise<CareSettings>;

  // Patients
  listPatients: () => Promise<PatientWithLatestVisit[]>;
  getPatient: (id: number) => Promise<Patient | null>;
  savePatient: (input: {
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
    contact?: string | null;
    admissionDate?: string | null;
    cognitionImpaired?: boolean | null;
    mobilityImpaired?: boolean | null;
    hkpCode?: HkpCode | null;
    intensiveCare?: IntensiveCare | null;
    careLevel?: CareLevel | null;
  }) => Promise<PatientWithLatestVisit[]>;
  deletePatient: (id: number) => Promise<PatientWithLatestVisit[]>;

  // Patient Visits
  listVisits: (patientId: number) => Promise<PatientVisit[]>;
  saveVisit: (input: {
    assignedTo?: string | null;
    actionDueDate?: string | null;
    status?: 'planned' | 'completed';
    resolvedAt?: string | null;
    id?: number;
    patientId: number;
    visitDate: string;
    actionNeeded: boolean;
    comment?: string | null;
  }) => Promise<PatientVisit[]>;
  deleteVisit: (id: number, patientId: number) => Promise<PatientVisit[]>;
  listRecentVisits: (perPatient?: number) => Promise<Record<number, PatientVisit[]>>;

  // Dashboard - Patient widgets
  getActionNeeded: (limit?: number) => Promise<PatientActionNeeded[]>;
  getPatientStats: () => Promise<PatientStats>;

  // Patient events for calendar/upcoming
  listPatientBirthdays: (startDate: string, endDate: string) => Promise<PatientBirthdayEvent[]>;
  listPatientVisitsInRange: (startDate: string, endDate: string) => Promise<PatientVisitEvent[]>;

  // MD-Prüfung
  listAuditSections: () => Promise<AuditSectionDefinition[]>;
  exportPersonList: () => Promise<{
    saved: boolean;
    filePath?: string;
    error?: string;
    total?: number;
    withoutGroup?: number;
  }>;
  listAudits: () => Promise<AuditWithDetails[]>;
  saveAudit: (input: {
    reportRef?: string | null;
    confirmed?: boolean;
    id?: number;
    auditDate: string;
    inspector?: string | null;
    kind?: 'regel' | 'anlass' | null;
    findings?: string | null;
    results: AuditResult[];
    clientIds: number[];
  }) => Promise<AuditWithDetails[]>;
  deleteAudit: (id: number) => Promise<AuditWithDetails[]>;
};

const api: Api = {
  getAppState: () => ipcRenderer.invoke('app:state'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  register: (password) => ipcRenderer.invoke('auth:register', password),
  registerPlain: () => ipcRenderer.invoke('auth:registerPlain'),
  login: (password) => ipcRenderer.invoke('auth:login', password),
  lock: () => ipcRenderer.invoke('auth:lock'),
  changePassword: (input) => ipcRenderer.invoke('auth:changePassword', input),
  enableEncryption: (password) => ipcRenderer.invoke('auth:enableEncryption', password),
  disableEncryption: () => ipcRenderer.invoke('auth:disableEncryption'),
  getRecoveryKey: () => ipcRenderer.invoke('auth:recoveryKey'),
  recoverWithKey: (input) => ipcRenderer.invoke('auth:recover', input),
  chooseStaffImport: () => ipcRenderer.invoke('staff:prepareImport'),
  commitStaffImport: (rows) => ipcRenderer.invoke('staff:commitImport', rows),
  listEmployees: (year, mode) => ipcRenderer.invoke('data:list', { year, mode }),
  listPeriods: (employeeId) => ipcRenderer.invoke('data:listPeriods', { employeeId }),
  listEvents: (employeeId) => ipcRenderer.invoke('events:list', { employeeId }),
  saveEmployee: (input) => ipcRenderer.invoke('data:save', input),
  saveWorkingTime: (input) => ipcRenderer.invoke('data:saveWorkingTime', input),
  deleteEmployee: (id, year) => ipcRenderer.invoke('data:delete', { id, year }),
  saveEvent: (input) => ipcRenderer.invoke('events:save', input),
  deleteEvent: (id, employeeId) => ipcRenderer.invoke('events:delete', { id, employeeId }),
  listUpcomingEvents: (fromDate, limit) =>
    ipcRenderer.invoke('events:listUpcoming', { fromDate, limit }),
  listEventsInRange: (startDate, endDate) =>
    ipcRenderer.invoke('events:listRange', { startDate, endDate }),
  exportData: (year, format, mode) => ipcRenderer.invoke('data:export', { year, format, mode }),
  openDocument: (path) => ipcRenderer.invoke('data:openDocument', { path }),
  listQualifications: () => ipcRenderer.invoke('qualifications:list'),
  addQualification: (name, note) => ipcRenderer.invoke('qualifications:add', { name, note }),
  updateQualification: (id, name, note) =>
    ipcRenderer.invoke('qualifications:update', { id, name, note }),
  deleteQualification: (id) => ipcRenderer.invoke('qualifications:delete', { id }),
  reorderQualifications: (ids) => ipcRenderer.invoke('qualifications:reorder', { ids }),
  listCompetencyDefinitions: () => ipcRenderer.invoke('competencies:listDefinitions'),
  addCompetencyDefinition: (input) => ipcRenderer.invoke('competencies:addDefinition', input),
  updateCompetencyDefinition: (input) => ipcRenderer.invoke('competencies:updateDefinition', input),
  deleteCompetencyDefinition: (id) => ipcRenderer.invoke('competencies:deleteDefinition', { id }),
  reorderCompetencyDefinitions: (ids) =>
    ipcRenderer.invoke('competencies:reorderDefinitions', { ids }),
  listEmployeeCompetencies: (employeeId) =>
    ipcRenderer.invoke('competencies:listEmployee', { employeeId }),
  bulkChangeCompetencies: (input) => ipcRenderer.invoke('competencies:bulkChange', input),
  saveEmployeeCompetency: (input) => ipcRenderer.invoke('competencies:saveEmployee', input),
  deleteEmployeeCompetency: (employeeId, competencyDefinitionId) =>
    ipcRenderer.invoke('competencies:deleteEmployee', { employeeId, competencyDefinitionId }),
  listInstructionDefinitions: () => ipcRenderer.invoke('instructions:listDefinitions'),
  addInstructionDefinition: (input) => ipcRenderer.invoke('instructions:addDefinition', input),
  updateInstructionDefinition: (input) =>
    ipcRenderer.invoke('instructions:updateDefinition', input),
  deleteInstructionDefinition: (id) => ipcRenderer.invoke('instructions:deleteDefinition', { id }),
  reorderInstructionDefinitions: (ids) =>
    ipcRenderer.invoke('instructions:reorderDefinitions', { ids }),
  listEmployeeInstructions: (employeeId) =>
    ipcRenderer.invoke('instructions:listEmployee', { employeeId }),
  saveEmployeeInstruction: (input) => ipcRenderer.invoke('instructions:saveEmployee', input),
  deleteEmployeeInstruction: (employeeId, recordId) =>
    ipcRenderer.invoke('instructions:deleteEmployee', { employeeId, recordId }),
  employeesWithOpenInstruction: (instructionDefinitionId) =>
    ipcRenderer.invoke('instructions:employeesWithOpen', { instructionDefinitionId }),
  assignInstructionToEmployees: (input) =>
    ipcRenderer.invoke('instructions:assignToEmployees', input),
  exportDatabase: (mode) => ipcRenderer.invoke('db:export', { mode }),
  importDatabase: (mode, recoveryKey) => ipcRenderer.invoke('db:import', { mode, recoveryKey }),
  deletePeriod: (periodId, year) => ipcRenderer.invoke('period:delete', { periodId, year }),
  getEmploymentIntegrityOverview: () => ipcRenderer.invoke('employment:integrityOverview'),
  previewPeriodDateCorrection: (input) => ipcRenderer.invoke('employment:previewPeriodDate', input),
  applyPeriodDateCorrection: (input) => ipcRenderer.invoke('employment:applyPeriodDate', input),
  previewConsolidatePeriods: (input) => ipcRenderer.invoke('employment:previewConsolidate', input),
  applyConsolidatePeriods: (input) => ipcRenderer.invoke('employment:applyConsolidate', input),
  previewEmployeeMerge: (input) => ipcRenderer.invoke('employment:previewMerge', input),
  applyEmployeeMerge: (input) => ipcRenderer.invoke('employment:applyMerge', input),
  previewReconcilePeriods: (input) => ipcRenderer.invoke('employment:previewReconcile', input),
  applyReconcilePeriods: (input) => ipcRenderer.invoke('employment:applyReconcile', input),
  deleteDatabase: () => ipcRenderer.invoke('db:delete'),
  resetApp: () => ipcRenderer.invoke('app:reset'),
  getBaseHours: () => ipcRenderer.invoke('settings:getBaseHours'),
  setBaseHours: (hours) => ipcRenderer.invoke('settings:setBaseHours', { hours }),
  getStorageMode: () =>
    ipcRenderer.invoke('app:state').then((state: AppState) => state.storageMode),
  getHiddenEventTypes: () => ipcRenderer.invoke('settings:getHiddenEventTypes'),
  setHiddenEventTypes: (types) => ipcRenderer.invoke('settings:setHiddenEventTypes', { types }),
  readDiagnostics: () => ipcRenderer.invoke('diagnostics:read'),
  openDiagnosticsFolder: () => ipcRenderer.invoke('diagnostics:openFolder'),
  clearDiagnostics: () => ipcRenderer.invoke('diagnostics:clear'),
  exportDiagnostics: () => ipcRenderer.invoke('diagnostics:export'),
  checkUpdates: (manual = false) => ipcRenderer.invoke('updates:check', manual),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status);
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  },
  getDevTables: () => ipcRenderer.invoke('dev:tables'),
  // Dashboard widgets
  getExpiringTrainings: (withinDays, limit) =>
    ipcRenderer.invoke('dashboard:expiringTrainings', { withinDays, limit }),
  getBirthdaysAndAnniversaries: (withinDays, limit) =>
    ipcRenderer.invoke('dashboard:birthdaysAnniversaries', { withinDays, limit }),
  getEmployeeDashboardStats: (dueSoonDays, limit) =>
    ipcRenderer.invoke('dashboard:employeeStats', { dueSoonDays, limit }),
  listOpenInstructions: (limit) => ipcRenderer.invoke('dashboard:openInstructions', { limit }),
  getDefinitionUsage: () => ipcRenderer.invoke('dashboard:definitionUsage'),
  getBackupSettings: () => ipcRenderer.invoke('backup:settings'),
  setBackupSettings: (input) => ipcRenderer.invoke('backup:setSettings', input),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
  runBackup: () => ipcRenderer.invoke('backup:run'),
  restoreBackup: (path, recoveryKey) => ipcRenderer.invoke('backup:restore', { path, recoveryKey }),
  getCareSettings: () => ipcRenderer.invoke('settings:careSettings'),
  setCareSettings: (input) => ipcRenderer.invoke('settings:setCareSettings', input),

  // Patients
  listPatients: () => ipcRenderer.invoke('patients:list'),
  getPatient: (id) => ipcRenderer.invoke('patients:get', { id }),
  savePatient: (input) => ipcRenderer.invoke('patients:save', input),
  deletePatient: (id) => ipcRenderer.invoke('patients:delete', { id }),

  // Patient Visits
  listVisits: (patientId) => ipcRenderer.invoke('visits:list', { patientId }),
  saveVisit: (input) => ipcRenderer.invoke('visits:save', input),
  deleteVisit: (id, patientId) => ipcRenderer.invoke('visits:delete', { id, patientId }),
  listRecentVisits: (perPatient) => ipcRenderer.invoke('visits:recent', { perPatient }),

  // Dashboard - Patient widgets
  getActionNeeded: (limit) => ipcRenderer.invoke('dashboard:actionNeeded', { limit }),
  getPatientStats: () => ipcRenderer.invoke('dashboard:patientStats'),

  // Patient events for calendar/upcoming
  listPatientBirthdays: (startDate, endDate) =>
    ipcRenderer.invoke('patients:listBirthdays', { startDate, endDate }),
  listPatientVisitsInRange: (startDate, endDate) =>
    ipcRenderer.invoke('patients:listVisitsInRange', { startDate, endDate }),

  // MD-Prüfung
  listAuditSections: () => ipcRenderer.invoke('audits:sections'),
  exportPersonList: () => ipcRenderer.invoke('audits:exportPersonList'),
  listAudits: () => ipcRenderer.invoke('audits:list'),
  saveAudit: (input) => ipcRenderer.invoke('audits:save', input),
  deleteAudit: (id) => ipcRenderer.invoke('audits:delete', { id }),
};

contextBridge.exposeInMainWorld('api', api);
