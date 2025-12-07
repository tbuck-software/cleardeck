import type { Api } from '../preload';
import type { UpdateStatus } from '../shared/types';

const baseApi: Api = (window as Window & { api: Api }).api;

const toError = (name: string, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
  return new Error(`API ${String(name)} failed: ${message}`);
};

async function call<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  ...args: Parameters<T>
): Promise<Awaited<ReturnType<T>>> {
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`api.${String(name)} error`, error);
    throw toError(name, error);
  }
}

export type ExportFormat = 'csv' | 'xlsx';

export const api = {
  app: {
    getInfo: () => call('getAppInfo', baseApi.getAppInfo),
  },
  auth: {
    getState: () => call('getAppState', baseApi.getAppState),
    register: (password: string) => call('register', baseApi.register, password),
    login: (password: string) => call('login', baseApi.login, password),
  },
  recovery: {
    getKey: () => call('getRecoveryKey', baseApi.getRecoveryKey),
    recover: (input: Parameters<Api['recoverWithKey']>[0]) =>
      call('recoverWithKey', baseApi.recoverWithKey, input),
  },
  employees: {
    list: (year: number) => call('listEmployees', baseApi.listEmployees, year),
    listPeriods: (employeeId: number) => call('listPeriods', baseApi.listPeriods, employeeId),
    listEvents: (employeeId: number) => call('listEvents', baseApi.listEvents, employeeId),
    save: (input: Parameters<Api['saveEmployee']>[0]) => call('saveEmployee', baseApi.saveEmployee, input),
    delete: (id: number, year: number) => call('deleteEmployee', baseApi.deleteEmployee, id, year),
  },
  events: {
    save: (input: Parameters<Api['saveEvent']>[0]) => call('saveEvent', baseApi.saveEvent, input),
    delete: (id: number, employeeId: number) =>
      call('deleteEvent', baseApi.deleteEvent, id, employeeId),
  },
  qualifications: {
    list: () => call('listQualifications', baseApi.listQualifications),
    add: (name: string, note?: string | null) =>
      call('addQualification', baseApi.addQualification, name, note),
    update: (id: number, name: string, note?: string | null) =>
      call('updateQualification', baseApi.updateQualification, id, name, note),
    delete: (id: number) => call('deleteQualification', baseApi.deleteQualification, id),
    reorder: (ids: number[]) => call('reorderQualifications', baseApi.reorderQualifications, ids),
  },
  data: {
    export: (year: number, format: ExportFormat) => call('exportData', baseApi.exportData, year, format),
    openDocument: (path: string) => call('openDocument', baseApi.openDocument, path),
  },
  db: {
    export: (mode: 'encrypted' | 'plain') => call('exportDatabase', baseApi.exportDatabase, mode),
    import: (mode: 'encrypted' | 'plain') => call('importDatabase', baseApi.importDatabase, mode),
    delete: () => call('deleteDatabase', baseApi.deleteDatabase),
    reset: () => call('resetApp', baseApi.resetApp),
  },
  periods: {
    delete: (periodId: number, year: number) =>
      call('deletePeriod', baseApi.deletePeriod, periodId, year),
  },
  settings: {
    getBaseHours: () => call('getBaseHours', baseApi.getBaseHours),
    setBaseHours: (hours: number) => call('setBaseHours', baseApi.setBaseHours, hours),
  },
  updates: {
    check: () => call('checkUpdates', baseApi.checkUpdates),
    install: () => call('installUpdate', baseApi.installUpdate),
    onStatus: (cb: (status: UpdateStatus) => void) => baseApi.onUpdateStatus(cb),
  },
  dev: {
    getTables: () => call('getDevTables', baseApi.getDevTables),
  },
};

export type AppApi = typeof api;

export default api;
