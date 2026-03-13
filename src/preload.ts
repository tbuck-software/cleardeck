import { contextBridge, ipcRenderer } from 'electron';
import type {
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
  UpdateStatus,
  RecoveryInfo,
  UpcomingEvent,
  ExpiringTraining,
  BirthdayAnniversary,
  EmployeeDashboardStats,
  Patient,
  PatientVisit,
  PatientWithLatestVisit,
  PatientConcerningRating,
  PatientStats,
  PatientBirthdayEvent,
  PatientVisitEvent,
  QprRating,
  StorageMode,
} from './shared/types';

type ExportFormat = 'csv' | 'xlsx';

export type Api = {
  getAppState: () => Promise<AppState>;
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<boolean>;
  register: (password: string) => Promise<AppState>;
  registerPlain: () => Promise<AppState>;
  login: (password: string) => Promise<AppState>;
  enableEncryption: (password: string) => Promise<AppState>;
  disableEncryption: () => Promise<AppState>;
  getRecoveryKey: () => Promise<RecoveryInfo>;
  recoverWithKey: (input: { recoveryKey: string; newPassword: string }) => Promise<AppState>;
  listEmployees: (year: number) => Promise<YearDataset>;
  listPeriods: (employeeId: number) => Promise<EmploymentPeriod[]>;
  listEvents: (employeeId: number) => Promise<EmployeeEvent[]>;
  saveEmployee: (
    input: {
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
      department?: string | null;
    },
  ) => Promise<YearDataset>;
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
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  openDocument: (path: string) => Promise<void>;
  listQualifications: () => Promise<QualificationType[]>;
  addQualification: (name: string, note?: string | null) => Promise<QualificationType[]>;
  updateQualification: (id: number, name: string, note?: string | null) => Promise<QualificationType[]>;
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
  saveEmployeeCompetency: (input: {
    id?: number;
    employeeId: number;
    competencyDefinitionId: number;
    level?: number | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    note?: string | null;
  }) => Promise<EmployeeCompetency[]>;
  deleteEmployeeCompetency: (employeeId: number, competencyDefinitionId: number) => Promise<EmployeeCompetency[]>;
  listInstructionDefinitions: () => Promise<InstructionDefinition[]>;
  addInstructionDefinition: (input: {
    topic: string;
    legalBasis?: string | null;
    note?: string | null;
  }) => Promise<InstructionDefinition[]>;
  updateInstructionDefinition: (input: {
    id: number;
    topic: string;
    legalBasis?: string | null;
    note?: string | null;
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
  }) => Promise<EmployeeInstruction[]>;
  deleteEmployeeInstruction: (employeeId: number, instructionDefinitionId: number) => Promise<EmployeeInstruction[]>;
  exportDatabase: (mode: 'encrypted' | 'plain') => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  importDatabase: (
    mode: 'encrypted' | 'plain',
  ) => Promise<{ imported: boolean; error?: string; backupPath?: string }>;
  deletePeriod: (periodId: number, year: number) => Promise<YearDataset>;
  deleteDatabase: () => Promise<boolean>;
  resetApp: () => Promise<AppState>;
  getBaseHours: () => Promise<number>;
  setBaseHours: (hours: number) => Promise<number>;
  getStorageMode: () => Promise<StorageMode>;
  getHiddenEventTypes: () => Promise<string[]>;
  setHiddenEventTypes: (types: string[]) => Promise<string[]>;
  checkUpdates: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  getDevTables: () => Promise<Record<string, Record<string, unknown>[]>>;
  // Dashboard widgets
  getExpiringTrainings: (withinDays?: number, limit?: number) => Promise<ExpiringTraining[]>;
  getBirthdaysAndAnniversaries: (withinDays?: number, limit?: number) => Promise<BirthdayAnniversary[]>;
  getEmployeeDashboardStats: (dueSoonDays?: number, limit?: number) => Promise<EmployeeDashboardStats>;

  // Patients
  listPatients: () => Promise<PatientWithLatestVisit[]>;
  getPatient: (id: number) => Promise<Patient | null>;
  savePatient: (input: {
    id?: number;
    name: string;
    birthDate?: string | null;
    diagnosis?: string | null;
    qprStatus?: QprRating | null;
    note?: string | null;
  }) => Promise<PatientWithLatestVisit[]>;
  deletePatient: (id: number) => Promise<PatientWithLatestVisit[]>;

  // Patient Visits
  listVisits: (patientId: number) => Promise<PatientVisit[]>;
  saveVisit: (input: {
    id?: number;
    patientId: number;
    visitDate: string;
    qprRating: QprRating;
    comment?: string | null;
  }) => Promise<PatientVisit[]>;
  deleteVisit: (id: number, patientId: number) => Promise<PatientVisit[]>;

  // Dashboard - Patient widgets
  getConcerningRatings: (limit?: number) => Promise<PatientConcerningRating[]>;
  getPatientStats: () => Promise<PatientStats>;

  // Patient events for calendar/upcoming
  listPatientBirthdays: (startDate: string, endDate: string) => Promise<PatientBirthdayEvent[]>;
  listPatientVisitsInRange: (startDate: string, endDate: string) => Promise<PatientVisitEvent[]>;
};

const api: Api = {
  getAppState: () => ipcRenderer.invoke('app:state'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  register: (password) => ipcRenderer.invoke('auth:register', password),
  registerPlain: () => ipcRenderer.invoke('auth:registerPlain'),
  login: (password) => ipcRenderer.invoke('auth:login', password),
  enableEncryption: (password) => ipcRenderer.invoke('auth:enableEncryption', password),
  disableEncryption: () => ipcRenderer.invoke('auth:disableEncryption'),
  getRecoveryKey: () => ipcRenderer.invoke('auth:recoveryKey'),
  recoverWithKey: (input) => ipcRenderer.invoke('auth:recover', input),
  listEmployees: (year) => ipcRenderer.invoke('data:list', { year }),
  listPeriods: (employeeId) => ipcRenderer.invoke('data:listPeriods', { employeeId }),
  listEvents: (employeeId) => ipcRenderer.invoke('events:list', { employeeId }),
  saveEmployee: (input) => ipcRenderer.invoke('data:save', input),
  deleteEmployee: (id, year) => ipcRenderer.invoke('data:delete', { id, year }),
  saveEvent: (input) => ipcRenderer.invoke('events:save', input),
  deleteEvent: (id, employeeId) => ipcRenderer.invoke('events:delete', { id, employeeId }),
  listUpcomingEvents: (fromDate, limit) => ipcRenderer.invoke('events:listUpcoming', { fromDate, limit }),
  listEventsInRange: (startDate, endDate) => ipcRenderer.invoke('events:listRange', { startDate, endDate }),
  exportData: (year, format) => ipcRenderer.invoke('data:export', { year, format }),
  openDocument: (path) => ipcRenderer.invoke('data:openDocument', { path }),
  listQualifications: () => ipcRenderer.invoke('qualifications:list'),
  addQualification: (name, note) => ipcRenderer.invoke('qualifications:add', { name, note }),
  updateQualification: (id, name, note) => ipcRenderer.invoke('qualifications:update', { id, name, note }),
  deleteQualification: (id) => ipcRenderer.invoke('qualifications:delete', { id }),
  reorderQualifications: (ids) => ipcRenderer.invoke('qualifications:reorder', { ids }),
  listCompetencyDefinitions: () => ipcRenderer.invoke('competencies:listDefinitions'),
  addCompetencyDefinition: (input) => ipcRenderer.invoke('competencies:addDefinition', input),
  updateCompetencyDefinition: (input) =>
    ipcRenderer.invoke('competencies:updateDefinition', input),
  deleteCompetencyDefinition: (id) => ipcRenderer.invoke('competencies:deleteDefinition', { id }),
  reorderCompetencyDefinitions: (ids) => ipcRenderer.invoke('competencies:reorderDefinitions', { ids }),
  listEmployeeCompetencies: (employeeId) => ipcRenderer.invoke('competencies:listEmployee', { employeeId }),
  saveEmployeeCompetency: (input) => ipcRenderer.invoke('competencies:saveEmployee', input),
  deleteEmployeeCompetency: (employeeId, competencyDefinitionId) =>
    ipcRenderer.invoke('competencies:deleteEmployee', { employeeId, competencyDefinitionId }),
  listInstructionDefinitions: () => ipcRenderer.invoke('instructions:listDefinitions'),
  addInstructionDefinition: (input) => ipcRenderer.invoke('instructions:addDefinition', input),
  updateInstructionDefinition: (input) => ipcRenderer.invoke('instructions:updateDefinition', input),
  deleteInstructionDefinition: (id) => ipcRenderer.invoke('instructions:deleteDefinition', { id }),
  reorderInstructionDefinitions: (ids) => ipcRenderer.invoke('instructions:reorderDefinitions', { ids }),
  listEmployeeInstructions: (employeeId) => ipcRenderer.invoke('instructions:listEmployee', { employeeId }),
  saveEmployeeInstruction: (input) => ipcRenderer.invoke('instructions:saveEmployee', input),
  deleteEmployeeInstruction: (employeeId, instructionDefinitionId) =>
    ipcRenderer.invoke('instructions:deleteEmployee', { employeeId, instructionDefinitionId }),
  exportDatabase: (mode) => ipcRenderer.invoke('db:export', { mode }),
  importDatabase: (mode) => ipcRenderer.invoke('db:import', { mode }),
  deletePeriod: (periodId, year) => ipcRenderer.invoke('period:delete', { periodId, year }),
  deleteDatabase: () => ipcRenderer.invoke('db:delete'),
  resetApp: () => ipcRenderer.invoke('app:reset'),
  getBaseHours: () => ipcRenderer.invoke('settings:getBaseHours'),
  setBaseHours: (hours) => ipcRenderer.invoke('settings:setBaseHours', { hours }),
  getStorageMode: () => ipcRenderer.invoke('app:state').then((state: AppState) => state.storageMode),
  getHiddenEventTypes: () => ipcRenderer.invoke('settings:getHiddenEventTypes'),
  setHiddenEventTypes: (types) => ipcRenderer.invoke('settings:setHiddenEventTypes', { types }),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
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

  // Patients
  listPatients: () => ipcRenderer.invoke('patients:list'),
  getPatient: (id) => ipcRenderer.invoke('patients:get', { id }),
  savePatient: (input) => ipcRenderer.invoke('patients:save', input),
  deletePatient: (id) => ipcRenderer.invoke('patients:delete', { id }),

  // Patient Visits
  listVisits: (patientId) => ipcRenderer.invoke('visits:list', { patientId }),
  saveVisit: (input) => ipcRenderer.invoke('visits:save', input),
  deleteVisit: (id, patientId) => ipcRenderer.invoke('visits:delete', { id, patientId }),

  // Dashboard - Patient widgets
  getConcerningRatings: (limit) => ipcRenderer.invoke('dashboard:concerningRatings', { limit }),
  getPatientStats: () => ipcRenderer.invoke('dashboard:patientStats'),

  // Patient events for calendar/upcoming
  listPatientBirthdays: (startDate, endDate) =>
    ipcRenderer.invoke('patients:listBirthdays', { startDate, endDate }),
  listPatientVisitsInRange: (startDate, endDate) =>
    ipcRenderer.invoke('patients:listVisitsInRange', { startDate, endDate }),
};

contextBridge.exposeInMainWorld('api', api);
