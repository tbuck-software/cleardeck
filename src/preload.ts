import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppState,
  AppInfo,
  EmploymentPeriod,
  QualificationType,
  Department,
  YearDataset,
  EmployeeEvent,
  EmployeeEventType,
  UpdateStatus,
  RecoveryInfo,
  UpcomingEvent,
  ExpiringTraining,
  DepartmentStats,
  BirthdayAnniversary,
} from './shared/types';

type ExportFormat = 'csv' | 'xlsx';

export type Api = {
  getAppState: () => Promise<AppState>;
  getAppInfo: () => Promise<AppInfo>;
  register: (password: string) => Promise<AppState>;
  login: (password: string) => Promise<AppState>;
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
  listDepartments: () => Promise<Department[]>;
  addDepartment: (name: string, note?: string | null) => Promise<Department[]>;
  updateDepartment: (id: number, name: string, note?: string | null) => Promise<Department[]>;
  deleteDepartment: (id: number) => Promise<Department[]>;
  reorderDepartments: (ids: number[]) => Promise<Department[]>;
  exportDatabase: (mode: 'encrypted' | 'plain') => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  importDatabase: (
    mode: 'encrypted' | 'plain',
  ) => Promise<{ imported: boolean; error?: string; backupPath?: string }>;
  deletePeriod: (periodId: number, year: number) => Promise<YearDataset>;
  deleteDatabase: () => Promise<boolean>;
  resetApp: () => Promise<AppState>;
  getBaseHours: () => Promise<number>;
  setBaseHours: (hours: number) => Promise<number>;
  getHiddenEventTypes: () => Promise<string[]>;
  setHiddenEventTypes: (types: string[]) => Promise<string[]>;
  checkUpdates: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  getDevTables: () => Promise<Record<string, Record<string, unknown>[]>>;
  // Dashboard widgets
  getExpiringTrainings: (withinDays?: number, limit?: number) => Promise<ExpiringTraining[]>;
  getDepartmentStats: (year: number) => Promise<DepartmentStats[]>;
  getBirthdaysAndAnniversaries: (withinDays?: number, limit?: number) => Promise<BirthdayAnniversary[]>;
};

const api: Api = {
  getAppState: () => ipcRenderer.invoke('app:state'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  register: (password) => ipcRenderer.invoke('auth:register', password),
  login: (password) => ipcRenderer.invoke('auth:login', password),
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
  listDepartments: () => ipcRenderer.invoke('departments:list'),
  addDepartment: (name, note) => ipcRenderer.invoke('departments:add', { name, note }),
  updateDepartment: (id, name, note) => ipcRenderer.invoke('departments:update', { id, name, note }),
  deleteDepartment: (id) => ipcRenderer.invoke('departments:delete', { id }),
  reorderDepartments: (ids) => ipcRenderer.invoke('departments:reorder', { ids }),
  exportDatabase: (mode) => ipcRenderer.invoke('db:export', { mode }),
  importDatabase: (mode) => ipcRenderer.invoke('db:import', { mode }),
  deletePeriod: (periodId, year) => ipcRenderer.invoke('period:delete', { periodId, year }),
  deleteDatabase: () => ipcRenderer.invoke('db:delete'),
  resetApp: () => ipcRenderer.invoke('app:reset'),
  getBaseHours: () => ipcRenderer.invoke('settings:getBaseHours'),
  setBaseHours: (hours) => ipcRenderer.invoke('settings:setBaseHours', { hours }),
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
  getDepartmentStats: (year) => ipcRenderer.invoke('dashboard:departmentStats', { year }),
  getBirthdaysAndAnniversaries: (withinDays, limit) =>
    ipcRenderer.invoke('dashboard:birthdaysAnniversaries', { withinDays, limit }),
};

contextBridge.exposeInMainWorld('api', api);
