import type { Api } from '../preload';
import type { UpdateStatus } from '../shared/types';

const baseApi: Api = (window as Window & { api: Api }).api;

/** Die Meldung bleibt anzeigbar; der Aufruf steht im Namen und in cause. */
const toError = (name: string, error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unbekannter Fehler';
  const wrapped = new Error(message);
  wrapped.name = `ApiError(${String(name)})`;
  Object.defineProperty(wrapped, 'cause', { value: error, enumerable: false });
  return wrapped;
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
  connection: {
    get: () => call('getServerConnection', baseApi.getServerConnection),
    connect: (input: Parameters<Api['connectServer']>[0]) => call('connectServer', baseApi.connectServer, input),
    local: () => call('useLocalConnection', baseApi.useLocalConnection),
    refresh: () => call('refreshServer', baseApi.refreshServer),
    resolveConflict: (choice: 'server' | 'local') => call('resolveServerConflict', baseApi.resolveServerConflict, choice),
    setEditing: (editing: boolean) => call('setServerEditing', baseApi.setServerEditing, editing),
  },
  app: {
    getInfo: () => call('getAppInfo', baseApi.getAppInfo),
    openExternal: (url: string) => call('openExternal', baseApi.openExternal, url),
  },
  auth: {
    getState: () => call('getAppState', baseApi.getAppState),
    register: (password: string) => call('register', baseApi.register, password),
    registerPlain: () => call('registerPlain', baseApi.registerPlain),
    login: (password: string) => call('login', baseApi.login, password),
    lock: () => call('lock', baseApi.lock),
    changePassword: (input: Parameters<Api['changePassword']>[0]) =>
      call('changePassword', baseApi.changePassword, input),
    enableEncryption: (password: string) =>
      call('enableEncryption', baseApi.enableEncryption, password),
    disableEncryption: () => call('disableEncryption', baseApi.disableEncryption),
  },
  recovery: {
    getKey: () => call('getRecoveryKey', baseApi.getRecoveryKey),
    recover: (input: Parameters<Api['recoverWithKey']>[0]) =>
      call('recoverWithKey', baseApi.recoverWithKey, input),
  },
  employees: {
    list: (year: number, mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory') =>
      call('listEmployees', baseApi.listEmployees, year, mode),
    listPeriods: (employeeId: number) => call('listPeriods', baseApi.listPeriods, employeeId),
    getEmployeePeriod: (employeeId: number, periodId: number, year: number) =>
      call('getEmployeePeriod', baseApi.getEmployeePeriod, employeeId, periodId, year),
    listEvents: (employeeId: number) => call('listEvents', baseApi.listEvents, employeeId),
    save: (input: Parameters<Api['saveEmployee']>[0]) =>
      call('saveEmployee', baseApi.saveEmployee, input),
    recordDeparture: (input: Parameters<Api['recordDeparture']>[0]) =>
      call('recordDeparture', baseApi.recordDeparture, input),
    switchQualification: (input: Parameters<Api['switchQualification']>[0]) =>
      call('switchQualification', baseApi.switchQualification, input),
    delete: (id: number, year: number) => call('deleteEmployee', baseApi.deleteEmployee, id, year),
  },
  workingTimes: {
    save: (input: Parameters<Api['saveWorkingTime']>[0]) =>
      call('saveWorkingTime', baseApi.saveWorkingTime, input),
  },
  events: {
    save: (input: Parameters<Api['saveEvent']>[0]) => call('saveEvent', baseApi.saveEvent, input),
    delete: (id: number, employeeId: number) =>
      call('deleteEvent', baseApi.deleteEvent, id, employeeId),
    listUpcoming: (fromDate?: string, limit?: number) =>
      call('listUpcomingEvents', baseApi.listUpcomingEvents, fromDate, limit),
    listRange: (startDate: string, endDate: string) =>
      call('listEventsInRange', baseApi.listEventsInRange, startDate, endDate),
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
  services: {
    list: () => call('listServiceDefinitions', baseApi.listServiceDefinitions),
    add: (input: Parameters<Api['addServiceDefinition']>[0]) =>
      call('addServiceDefinition', baseApi.addServiceDefinition, input),
    update: (input: Parameters<Api['updateServiceDefinition']>[0]) =>
      call('updateServiceDefinition', baseApi.updateServiceDefinition, input),
    setActive: (id: number, active: boolean) =>
      call('setServiceDefinitionActive', baseApi.setServiceDefinitionActive, id, active),
    reorder: (ids: number[]) =>
      call('reorderServiceDefinitions', baseApi.reorderServiceDefinitions, ids),
  },
  competencies: {
    listDefinitions: () => call('listCompetencyDefinitions', baseApi.listCompetencyDefinitions),
    addDefinition: (input: Parameters<Api['addCompetencyDefinition']>[0]) =>
      call('addCompetencyDefinition', baseApi.addCompetencyDefinition, input),
    updateDefinition: (input: Parameters<Api['updateCompetencyDefinition']>[0]) =>
      call('updateCompetencyDefinition', baseApi.updateCompetencyDefinition, input),
    deleteDefinition: (id: number) =>
      call('deleteCompetencyDefinition', baseApi.deleteCompetencyDefinition, id),
    reorderDefinitions: (ids: number[]) =>
      call('reorderCompetencyDefinitions', baseApi.reorderCompetencyDefinitions, ids),
    listEmployee: (employeeId: number) =>
      call('listEmployeeCompetencies', baseApi.listEmployeeCompetencies, employeeId),
    assignEmployee: (input: Parameters<Api['assignEmployeeCompetencies']>[0]) =>
      call('assignEmployeeCompetencies', baseApi.assignEmployeeCompetencies, input),
    bulkChange: (input: Parameters<Api['bulkChangeCompetencies']>[0]) =>
      call('bulkChangeCompetencies', baseApi.bulkChangeCompetencies, input),
    saveEmployee: (input: Parameters<Api['saveEmployeeCompetency']>[0]) =>
      call('saveEmployeeCompetency', baseApi.saveEmployeeCompetency, input),
    deleteEmployee: (employeeId: number, competencyDefinitionId: number) =>
      call(
        'deleteEmployeeCompetency',
        baseApi.deleteEmployeeCompetency,
        employeeId,
        competencyDefinitionId,
      ),
  },
  instructions: {
    listDefinitions: () => call('listInstructionDefinitions', baseApi.listInstructionDefinitions),
    addDefinition: (input: Parameters<Api['addInstructionDefinition']>[0]) =>
      call('addInstructionDefinition', baseApi.addInstructionDefinition, input),
    updateDefinition: (input: Parameters<Api['updateInstructionDefinition']>[0]) =>
      call('updateInstructionDefinition', baseApi.updateInstructionDefinition, input),
    deleteDefinition: (id: number) =>
      call('deleteInstructionDefinition', baseApi.deleteInstructionDefinition, id),
    reorderDefinitions: (ids: number[]) =>
      call('reorderInstructionDefinitions', baseApi.reorderInstructionDefinitions, ids),
    listEmployee: (employeeId: number) =>
      call('listEmployeeInstructions', baseApi.listEmployeeInstructions, employeeId),
    saveEmployee: (input: Parameters<Api['saveEmployeeInstruction']>[0]) =>
      call('saveEmployeeInstruction', baseApi.saveEmployeeInstruction, input),
    deleteEmployee: (employeeId: number, instructionDefinitionId: number) =>
      call(
        'deleteEmployeeInstruction',
        baseApi.deleteEmployeeInstruction,
        employeeId,
        instructionDefinitionId,
      ),
    employeesWithOpen: (instructionDefinitionId: number) =>
      call(
        'employeesWithOpenInstruction',
        baseApi.employeesWithOpenInstruction,
        instructionDefinitionId,
      ),
    assignToEmployees: (input: Parameters<Api['assignInstructionToEmployees']>[0]) =>
      call('assignInstructionToEmployees', baseApi.assignInstructionToEmployees, input),
  },
  data: {
    export: (
      year: number,
      format: ExportFormat,
      mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory',
    ) => call('exportData', baseApi.exportData, year, format, mode),
    openDocument: (path: string) => call('openDocument', baseApi.openDocument, path),
  },
  db: {
    export: (mode: 'encrypted' | 'plain') => call('exportDatabase', baseApi.exportDatabase, mode),
    import: (mode: 'encrypted' | 'plain', recoveryKey?: string) =>
      call('importDatabase', baseApi.importDatabase, mode, recoveryKey),
    delete: () => call('deleteDatabase', baseApi.deleteDatabase),
    reset: () => call('resetApp', baseApi.resetApp),
  },
  periods: {
    delete: (periodId: number, year: number) =>
      call('deletePeriod', baseApi.deletePeriod, periodId, year),
  },
  employment: {
    integrityOverview: () =>
      call('getEmploymentIntegrityOverview', baseApi.getEmploymentIntegrityOverview),
    previewConsolidate: (input: Parameters<Api['previewConsolidatePeriods']>[0]) =>
      call('previewConsolidatePeriods', baseApi.previewConsolidatePeriods, input),
    applyConsolidate: (input: Parameters<Api['applyConsolidatePeriods']>[0]) =>
      call('applyConsolidatePeriods', baseApi.applyConsolidatePeriods, input),
    previewMerge: (input: Parameters<Api['previewEmployeeMerge']>[0]) =>
      call('previewEmployeeMerge', baseApi.previewEmployeeMerge, input),
    applyMerge: (input: Parameters<Api['applyEmployeeMerge']>[0]) =>
      call('applyEmployeeMerge', baseApi.applyEmployeeMerge, input),
    previewReconcile: (input: Parameters<Api['previewReconcilePeriods']>[0]) =>
      call('previewReconcilePeriods', baseApi.previewReconcilePeriods, input),
    applyReconcile: (input: Parameters<Api['applyReconcilePeriods']>[0]) =>
      call('applyReconcilePeriods', baseApi.applyReconcilePeriods, input),
  },
  settings: {
    getBaseHours: () => call('getBaseHours', baseApi.getBaseHours),
    setBaseHours: (hours: number) => call('setBaseHours', baseApi.setBaseHours, hours),
    getStorageMode: () => call('getStorageMode', baseApi.getStorageMode),
    getHiddenEventTypes: () => call('getHiddenEventTypes', baseApi.getHiddenEventTypes),
    setHiddenEventTypes: (types: string[]) =>
      call('setHiddenEventTypes', baseApi.setHiddenEventTypes, types),
  },
  diagnostics: {
    read: () => call('readDiagnostics', baseApi.readDiagnostics),
    export: () => call('exportDiagnostics', baseApi.exportDiagnostics),
    openFolder: () => call('openDiagnosticsFolder', baseApi.openDiagnosticsFolder),
    clear: () => call('clearDiagnostics', baseApi.clearDiagnostics),
  },
  updates: {
    check: (manual = false) => call('checkUpdates', baseApi.checkUpdates, manual),
    download: () => call('downloadUpdate', baseApi.downloadUpdate),
    install: () => call('installUpdate', baseApi.installUpdate),
    getPreferences: () => call('getUpdatePreferences', baseApi.getUpdatePreferences),
    savePreferences: (input: Parameters<Api['saveUpdatePreferences']>[0]) =>
      call('saveUpdatePreferences', baseApi.saveUpdatePreferences, input),
    onStatus: (cb: (status: UpdateStatus) => void) => baseApi.onUpdateStatus(cb),
  },
  dev: {
    getTables: () => call('getDevTables', baseApi.getDevTables),
  },
  patients: {
    list: () => call('listPatients', baseApi.listPatients),
    get: (id: number) => call('getPatient', baseApi.getPatient, id),
    save: (input: Parameters<Api['savePatient']>[0]) =>
      call('savePatient', baseApi.savePatient, input),
    delete: (id: number) => call('deletePatient', baseApi.deletePatient, id),
    listVisits: (patientId: number) => call('listVisits', baseApi.listVisits, patientId),
    saveVisit: (input: Parameters<Api['saveVisit']>[0]) =>
      call('saveVisit', baseApi.saveVisit, input),
    deleteVisit: (id: number, patientId: number) =>
      call('deleteVisit', baseApi.deleteVisit, id, patientId),
    listRecentVisits: (perPatient?: number) =>
      call('listRecentVisits', baseApi.listRecentVisits, perPatient),
    getActionNeeded: (limit?: number) => call('getActionNeeded', baseApi.getActionNeeded, limit),
    getPatientStats: () => call('getPatientStats', baseApi.getPatientStats),
    listBirthdays: (startDate: string, endDate: string) =>
      call('listPatientBirthdays', baseApi.listPatientBirthdays, startDate, endDate),
    listVisitsInRange: (startDate: string, endDate: string) =>
      call('listPatientVisitsInRange', baseApi.listPatientVisitsInRange, startDate, endDate),
  },
  definitions: {
    usage: () => call('getDefinitionUsage', baseApi.getDefinitionUsage),
  },
  backup: {
    get: () => call('getBackupSettings', baseApi.getBackupSettings),
    set: (input: Parameters<Api['setBackupSettings']>[0]) =>
      call('setBackupSettings', baseApi.setBackupSettings, input),
    chooseFolder: () => call('chooseBackupFolder', baseApi.chooseBackupFolder),
    run: () => call('runBackup', baseApi.runBackup),
    restore: (path: string, recoveryKey?: string) =>
      call('restoreBackup', baseApi.restoreBackup, path, recoveryKey),
  },
  careSettings: {
    get: () => call('getCareSettings', baseApi.getCareSettings),
    set: (input: Parameters<Api['setCareSettings']>[0]) =>
      call('setCareSettings', baseApi.setCareSettings, input),
  },
  audits: {
    sections: () => call('listAuditSections', baseApi.listAuditSections),
    exportPersonList: () => call('exportPersonList', baseApi.exportPersonList),
    list: () => call('listAudits', baseApi.listAudits),
    save: (input: Parameters<Api['saveAudit']>[0]) => call('saveAudit', baseApi.saveAudit, input),
    delete: (id: number) => call('deleteAudit', baseApi.deleteAudit, id),
  },
};

export type AppApi = typeof api;

export default api;
