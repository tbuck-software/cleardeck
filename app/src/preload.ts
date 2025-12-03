import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, EmploymentPeriod, YearDataset } from './shared/types';

type ExportFormat = 'csv' | 'xlsx';

export type Api = {
  getAppState: () => Promise<AppState>;
  register: (password: string) => Promise<AppState>;
  login: (password: string) => Promise<AppState>;
  listEmployees: (year: number) => Promise<YearDataset>;
  listPeriods: (employeeId: number) => Promise<EmploymentPeriod[]>;
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
  exportData: (year: number, format: ExportFormat) => Promise<{ saved: boolean; filePath?: string }>;
  openDocument: (path: string) => Promise<void>;
};

const api: Api = {
  getAppState: () => ipcRenderer.invoke('app:state'),
  register: (password) => ipcRenderer.invoke('auth:register', password),
  login: (password) => ipcRenderer.invoke('auth:login', password),
  listEmployees: (year) => ipcRenderer.invoke('data:list', { year }),
  listPeriods: (employeeId) => ipcRenderer.invoke('data:listPeriods', { employeeId }),
  saveEmployee: (input) => ipcRenderer.invoke('data:save', input),
  deleteEmployee: (id, year) => ipcRenderer.invoke('data:delete', { id, year }),
  exportData: (year, format) => ipcRenderer.invoke('data:export', { year, format }),
  openDocument: (path) => ipcRenderer.invoke('data:openDocument', { path }),
};

contextBridge.exposeInMainWorld('api', api);
