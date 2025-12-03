import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppState,
  EmploymentPeriod,
  QualificationType,
  YearDataset,
  EmployeeEvent,
  EmployeeEventType,
} from './shared/types';

type ExportFormat = 'csv' | 'xlsx';

export type Api = {
  getAppState: () => Promise<AppState>;
  register: (password: string) => Promise<AppState>;
  login: (password: string) => Promise<AppState>;
  listEmployees: (year: number) => Promise<YearDataset>;
  listPeriods: (employeeId: number) => Promise<EmploymentPeriod[]>;
  listEvents: (employeeId: number) => Promise<EmployeeEvent[]>;
  saveEmployee: (
    input: {
      id?: number;
      periodId?: number;
      name: string;
      qualification: string;
      dataSource?: string;
      note?: string;
      documentPath?: string;
      startDate: string;
      endDate?: string | null;
      fte: number;
      year: number;
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
  }) => Promise<EmployeeEvent[]>;
  deleteEvent: (id: number, employeeId: number) => Promise<EmployeeEvent[]>;
  exportData: (
    year: number,
    format: ExportFormat,
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  openDocument: (path: string) => Promise<void>;
  listQualifications: () => Promise<QualificationType[]>;
  addQualification: (name: string) => Promise<QualificationType[]>;
  updateQualification: (id: number, name: string) => Promise<QualificationType[]>;
  deleteQualification: (id: number) => Promise<QualificationType[]>;
  reorderQualifications: (ids: number[]) => Promise<QualificationType[]>;
  exportDatabase: (mode: 'encrypted' | 'plain') => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  importDatabase: (
    mode: 'encrypted' | 'plain',
  ) => Promise<{ imported: boolean; error?: string; backupPath?: string }>;
  deletePeriod: (periodId: number, year: number) => Promise<YearDataset>;
};

const api: Api = {
  getAppState: () => ipcRenderer.invoke('app:state'),
  register: (password) => ipcRenderer.invoke('auth:register', password),
  login: (password) => ipcRenderer.invoke('auth:login', password),
  listEmployees: (year) => ipcRenderer.invoke('data:list', { year }),
  listPeriods: (employeeId) => ipcRenderer.invoke('data:listPeriods', { employeeId }),
  listEvents: (employeeId) => ipcRenderer.invoke('events:list', { employeeId }),
  saveEmployee: (input) => ipcRenderer.invoke('data:save', input),
  deleteEmployee: (id, year) => ipcRenderer.invoke('data:delete', { id, year }),
  saveEvent: (input) => ipcRenderer.invoke('events:save', input),
  deleteEvent: (id, employeeId) => ipcRenderer.invoke('events:delete', { id, employeeId }),
  exportData: (year, format) => ipcRenderer.invoke('data:export', { year, format }),
  openDocument: (path) => ipcRenderer.invoke('data:openDocument', { path }),
  listQualifications: () => ipcRenderer.invoke('qualifications:list'),
  addQualification: (name) => ipcRenderer.invoke('qualifications:add', { name }),
  updateQualification: (id, name) => ipcRenderer.invoke('qualifications:update', { id, name }),
  deleteQualification: (id) => ipcRenderer.invoke('qualifications:delete', { id }),
  reorderQualifications: (ids) => ipcRenderer.invoke('qualifications:reorder', { ids }),
  exportDatabase: (mode) => ipcRenderer.invoke('db:export', { mode }),
  importDatabase: (mode) => ipcRenderer.invoke('db:import', { mode }),
  deletePeriod: (periodId, year) => ipcRenderer.invoke('period:delete', { periodId, year }),
};

contextBridge.exposeInMainWorld('api', api);
