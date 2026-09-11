import { saveWorkingTime } from '../repositories/workingTimes';
import { recordDeparture, switchQualification } from '../repositories/employmentActions';
import { chooseStaffImport, commitStaffImport } from '../staffImport';
/**
 * Data IPC Handlers
 *
 * Handles employee, period, and event data operations.
 */

import { shell } from 'electron';
import { handleData } from './persistentHandler';

import type {
  BulkCompetencyChange,
  AuditResult,
  EmployeeEventType,
  IntervalSource,
  YearDataset,
} from '../../shared/types';
import {
  getDb,
  isDbOpen,
  getEncryptionKey,
  getStorageMode,
  openDatabase,
  closeDb,
  deleteDatabase as deleteDbFiles,
  ensureDataDir,
} from '../database/connection';
import {
  getYearDataset,
  listPeriods,
  saveEmployee,
  deleteEmployee,
  deletePeriod,
} from '../repositories/employees';
import {
  listEvents,
  saveEvent,
  deleteEvent,
  listUpcomingEvents,
  listEventsInRange,
} from '../repositories/events';
import {
  getExpiringTrainings,
  getBirthdaysAndAnniversaries,
  getEmployeeDashboardStats,
  listOpenInstructions,
  getDefinitionUsage,
} from '../repositories/dashboard';
import {
  listQualifications,
  addQualification,
  updateQualification,
  reorderQualifications,
  deleteQualification,
} from '../repositories/qualifications';
import {
  addCompetencyDefinition,
  deleteCompetencyDefinition,
  deleteEmployeeCompetency,
  listCompetencyDefinitions,
  listEmployeeCompetencies,
  reorderCompetencyDefinitions,
  bulkChangeCompetencies,
  saveEmployeeCompetency,
  updateCompetencyDefinition,
} from '../repositories/competencies';
import {
  addInstructionDefinition,
  deleteEmployeeInstruction,
  deleteInstructionDefinition,
  listEmployeeInstructions,
  listInstructionDefinitions,
  reorderInstructionDefinitions,
  saveEmployeeInstruction,
  assignInstructionToEmployees,
  listEmployeesWithOpenInstruction,
  updateInstructionDefinition,
} from '../repositories/instructions';
import {
  getBaseHours,
  setBaseHours,
  getHiddenEventTypes,
  setHiddenEventTypes,
  getVisitIntervalDays,
  setVisitIntervalDays,
  getInstructionReminderDays,
  setInstructionReminderDays,
  getBackupSettings,
  setBackupSettings,
} from '../repositories/settings';
import type { BackupSettings } from '../repositories/settings';
import { chooseBackupFolder, listBackups, restoreBackup, runBackup } from '../backup';
import {
  listPatients,
  getPatient,
  savePatient,
  deletePatient,
  listVisits,
  saveVisit,
  deleteVisit,
  getActionNeeded,
  listRecentVisits,
  getPatientStats,
  listPatientBirthdays,
  listPatientVisitsInRange,
} from '../repositories/patients';
import type { SavePatientInput } from '../repositories/patients';
import { AUDIT_SECTIONS, deleteAudit, listAudits, saveAudit } from '../repositories/audits';
import { exportDatabase, importDatabase, exportData, exportPersonList } from '../export';
import { isUnlocked } from './auth';

/**
 * Ensure database is ready for operations
 */
const ensureDbReady = (): void => {
  if (!isUnlocked()) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (getStorageMode() === 'encrypted' && !getEncryptionKey()) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (!isDbOpen()) {
    openDatabase();
  }
};

/**
 * Register all data-related IPC handlers
 */
export const registerDataHandlers = (): void => {
  handleData('staff:prepareImport', async () => {
    ensureDbReady();
    return chooseStaffImport();
  });
  handleData('staff:commitImport', (_event, rows) => {
    ensureDbReady();
    return commitStaffImport(rows);
  });
  // Employee data
  handleData(
    'data:list',
    (
      _event,
      {
        year,
        mode,
      }: { year: number; mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory' },
    ): YearDataset => {
      ensureDbReady();
      return getYearDataset(year, mode);
    },
  );

  handleData('data:listPeriods', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listPeriods(employeeId);
  });

  handleData('data:saveWorkingTime', (_event, input) => {
    ensureDbReady();
    return saveWorkingTime(input);
  });

  handleData('employment:recordDeparture', (_event, input) => {
    ensureDbReady();
    return recordDeparture(input);
  });

  handleData('employment:switchQualification', (_event, input) => {
    ensureDbReady();
    return switchQualification(input);
  });

  handleData('data:save', (_event, input) => {
    ensureDbReady();
    return saveEmployee(input);
  });

  handleData('data:delete', (_event, { id, year }: { id: number; year: number }) => {
    ensureDbReady();
    return deleteEmployee(id, year);
  });

  handleData(
    'data:export',
    async (
      _event,
      {
        year,
        format,
        mode,
      }: {
        year: number;
        format: 'csv' | 'xlsx';
        mode?: 'year' | 'stichtag' | 'current' | 'year-average' | 'directory';
      },
    ) => {
      ensureDbReady();
      return exportData(year, format, mode);
    },
  );

  handleData('data:openDocument', async (_event, { path: filePath }: { path: string }) => {
    if (!filePath) return;
    await shell.openPath(filePath);
  });

  // Periods
  handleData('period:delete', (_event, { periodId, year }: { periodId: number; year: number }) => {
    ensureDbReady();
    return deletePeriod(periodId, year);
  });

  // Qualifications
  handleData('qualifications:list', () => {
    ensureDbReady();
    return listQualifications();
  });

  handleData(
    'qualifications:add',
    (_event, { name, note }: { name: string; note?: string | null }) => {
      ensureDbReady();
      return addQualification(name, note);
    },
  );

  handleData(
    'qualifications:update',
    (_event, { id, name, note }: { id: number; name: string; note?: string | null }) => {
      ensureDbReady();
      return updateQualification(id, name, note);
    },
  );

  handleData('qualifications:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteQualification(id);
  });

  handleData('qualifications:reorder', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderQualifications(ids);
  });

  // Competencies
  handleData('competencies:listDefinitions', () => {
    ensureDbReady();
    return listCompetencyDefinitions();
  });

  handleData(
    'competencies:addDefinition',
    (
      _event,
      input: {
        code?: string | null;
        name: string;
        category?: string | null;
        relevance?: string | null;
        note?: string | null;
      },
    ) => {
      ensureDbReady();
      return addCompetencyDefinition(input);
    },
  );

  handleData(
    'competencies:updateDefinition',
    (
      _event,
      input: {
        id: number;
        code?: string | null;
        name: string;
        category?: string | null;
        relevance?: string | null;
        note?: string | null;
      },
    ) => {
      ensureDbReady();
      return updateCompetencyDefinition(input);
    },
  );

  handleData('competencies:deleteDefinition', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteCompetencyDefinition(id);
  });

  handleData('competencies:reorderDefinitions', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderCompetencyDefinitions(ids);
  });

  handleData('competencies:bulkChange', (_event, input: BulkCompetencyChange) => {
    ensureDbReady();
    return bulkChangeCompetencies(input);
  });

  handleData('competencies:listEmployee', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEmployeeCompetencies(employeeId);
  });

  handleData(
    'competencies:saveEmployee',
    (
      _event,
      input: {
        id?: number;
        employeeId: number;
        competencyDefinitionId: number;
        level?: number | null;
        approvedAt?: string | null;
        approvedBy?: string | null;
        note?: string | null;
      },
    ) => {
      ensureDbReady();
      return saveEmployeeCompetency(input);
    },
  );

  handleData(
    'competencies:deleteEmployee',
    (
      _event,
      {
        employeeId,
        competencyDefinitionId,
      }: {
        employeeId: number;
        competencyDefinitionId: number;
      },
    ) => {
      ensureDbReady();
      return deleteEmployeeCompetency(employeeId, competencyDefinitionId);
    },
  );

  // Instructions
  handleData('instructions:listDefinitions', () => {
    ensureDbReady();
    return listInstructionDefinitions();
  });

  handleData(
    'instructions:addDefinition',
    (
      _event,
      input: {
        topic: string;
        legalBasis?: string | null;
        note?: string | null;
        intervalMonths?: number | null;
        intervalSource?: IntervalSource | null;
      },
    ) => {
      ensureDbReady();
      return addInstructionDefinition(input);
    },
  );

  handleData(
    'instructions:updateDefinition',
    (
      _event,
      input: {
        id: number;
        topic: string;
        legalBasis?: string | null;
        note?: string | null;
        intervalMonths?: number | null;
        intervalSource?: IntervalSource | null;
      },
    ) => {
      ensureDbReady();
      return updateInstructionDefinition(input);
    },
  );

  handleData('instructions:deleteDefinition', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteInstructionDefinition(id);
  });

  handleData('instructions:reorderDefinitions', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderInstructionDefinitions(ids);
  });

  handleData('instructions:listEmployee', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEmployeeInstructions(employeeId);
  });

  handleData(
    'instructions:saveEmployee',
    (
      _event,
      input: {
        id?: number;
        employeeId: number;
        instructionDefinitionId: number;
        dueDate?: string | null;
        completedAt?: string | null;
        conductedBy?: string | null;
        note?: string | null;
        scheduleFollowUp?: boolean;
      },
    ) => {
      ensureDbReady();
      return saveEmployeeInstruction(input);
    },
  );

  handleData(
    'instructions:employeesWithOpen',
    (_event, { instructionDefinitionId }: { instructionDefinitionId: number }) => {
      ensureDbReady();
      return listEmployeesWithOpenInstruction(instructionDefinitionId);
    },
  );

  handleData(
    'instructions:assignToEmployees',
    (
      _event,
      input: {
        instructionDefinitionId: number;
        employeeIds: number[];
        dueDate?: string | null;
      },
    ) => {
      ensureDbReady();
      return assignInstructionToEmployees(input);
    },
  );

  handleData(
    'instructions:deleteEmployee',
    (
      _event,
      {
        employeeId,
        recordId,
      }: {
        employeeId: number;
        recordId: number;
      },
    ) => {
      ensureDbReady();
      return deleteEmployeeInstruction(employeeId, recordId);
    },
  );

  // Events
  handleData('events:list', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEvents(employeeId);
  });

  handleData(
    'events:save',
    (
      _event,
      input: {
        id?: number;
        employeeId: number;
        eventDate: string;
        type: EmployeeEventType;
        title: string;
        details?: string | null;
        meta?: Record<string, unknown> | null;
        expiresAt?: string | null;
      },
    ) => {
      ensureDbReady();
      return saveEvent(input);
    },
  );

  handleData('events:delete', (_event, { id, employeeId }: { id: number; employeeId: number }) => {
    ensureDbReady();
    return deleteEvent(id, employeeId);
  });

  handleData(
    'events:listUpcoming',
    (_event, { fromDate, limit }: { fromDate?: string; limit?: number }) => {
      ensureDbReady();
      return listUpcomingEvents(fromDate, limit);
    },
  );

  handleData(
    'events:listRange',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listEventsInRange(startDate, endDate);
    },
  );

  // Settings
  handleData('settings:getBaseHours', () => {
    ensureDbReady();
    return getBaseHours();
  });

  handleData('settings:setBaseHours', (_event, { hours }: { hours: number }) => {
    ensureDbReady();
    return setBaseHours(hours);
  });

  handleData('settings:getHiddenEventTypes', () => {
    ensureDbReady();
    return getHiddenEventTypes();
  });

  handleData('settings:setHiddenEventTypes', (_event, { types }: { types: string[] }) => {
    ensureDbReady();
    return setHiddenEventTypes(types);
  });

  // Database management
  handleData('db:export', (_event, { mode }: { mode: 'encrypted' | 'plain' }) => {
    ensureDbReady();
    return exportDatabase(mode);
  });

  handleData(
    'db:import',
    (_event, { mode, recoveryKey }: { mode: 'encrypted' | 'plain'; recoveryKey?: string }) => {
      ensureDbReady();
      return importDatabase(mode, recoveryKey);
    },
  );

  handleData('db:delete', () => {
    ensureDataDir();
    closeDb();
    deleteDbFiles();
    return true;
  });

  // Dashboard widgets
  handleData(
    'dashboard:expiringTrainings',
    (_event, { withinDays, limit }: { withinDays?: number; limit?: number }) => {
      ensureDbReady();
      return getExpiringTrainings(withinDays, limit);
    },
  );

  handleData(
    'dashboard:birthdaysAnniversaries',
    (_event, { withinDays, limit }: { withinDays?: number; limit?: number }) => {
      ensureDbReady();
      return getBirthdaysAndAnniversaries(withinDays, limit);
    },
  );

  handleData(
    'dashboard:employeeStats',
    (_event, { dueSoonDays, limit }: { dueSoonDays?: number; limit?: number }) => {
      ensureDbReady();
      return getEmployeeDashboardStats(dueSoonDays, limit);
    },
  );

  handleData('dashboard:openInstructions', (_event, { limit }: { limit?: number }) => {
    ensureDbReady();
    return listOpenInstructions(limit);
  });

  handleData('dashboard:definitionUsage', () => {
    ensureDbReady();
    return getDefinitionUsage();
  });

  // Backups into the configured folder
  handleData('backup:settings', () => {
    ensureDbReady();
    const settings = getBackupSettings();
    return { ...settings, backups: listBackups(settings.folder) };
  });

  handleData('backup:setSettings', (_event, input: Partial<BackupSettings>) => {
    ensureDbReady();
    const settings = setBackupSettings(input);
    return { ...settings, backups: listBackups(settings.folder) };
  });

  handleData('backup:chooseFolder', async () => {
    ensureDbReady();
    await chooseBackupFolder();
    const settings = getBackupSettings();
    return { ...settings, backups: listBackups(settings.folder) };
  });

  handleData('backup:run', async () => {
    ensureDbReady();
    const result = await runBackup();
    const settings = getBackupSettings();
    return { ...result, settings: { ...settings, backups: listBackups(settings.folder) } };
  });

  handleData(
    'backup:restore',
    async (_event, { path: source, recoveryKey }: { path: string; recoveryKey?: string }) => {
      ensureDbReady();
      const result = await restoreBackup(source, recoveryKey);
      const settings = getBackupSettings();
      return { ...result, settings: { ...settings, backups: listBackups(settings.folder) } };
    },
  );

  handleData('settings:careSettings', () => {
    ensureDbReady();
    return {
      visitIntervalDays: getVisitIntervalDays(),
      instructionReminderDays: getInstructionReminderDays(),
    };
  });

  handleData(
    'settings:setCareSettings',
    (_event, input: { visitIntervalDays?: number; instructionReminderDays?: number }) => {
      ensureDbReady();
      if (input.visitIntervalDays != null) setVisitIntervalDays(input.visitIntervalDays);
      if (input.instructionReminderDays != null)
        setInstructionReminderDays(input.instructionReminderDays);
      return {
        visitIntervalDays: getVisitIntervalDays(),
        instructionReminderDays: getInstructionReminderDays(),
      };
    },
  );

  // DEV: Raw table data
  handleData('dev:tables', () => {
    if (!isDbOpen()) return {};
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const result: Record<string, unknown[]> = {};
    for (const { name } of tables) {
      result[name] = db.prepare(`SELECT * FROM "${name}"`).all();
    }
    return result;
  });

  // Patients
  handleData('patients:list', () => {
    ensureDbReady();
    return listPatients();
  });

  handleData('patients:get', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return getPatient(id);
  });

  handleData('patients:save', (_event, input: SavePatientInput) => {
    ensureDbReady();
    return savePatient(input);
  });

  handleData('patients:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deletePatient(id);
  });

  // Patient Visits
  handleData('visits:list', (_event, { patientId }: { patientId: number }) => {
    ensureDbReady();
    return listVisits(patientId);
  });

  handleData(
    'visits:save',
    (
      _event,
      input: {
        id?: number;
        patientId: number;
        visitDate: string;
        actionNeeded: boolean;
        comment?: string | null;
      },
    ) => {
      ensureDbReady();
      return saveVisit(input);
    },
  );

  handleData('visits:recent', (_event, { perPatient }: { perPatient?: number }) => {
    ensureDbReady();
    return listRecentVisits(perPatient);
  });

  handleData('visits:delete', (_event, { id, patientId }: { id: number; patientId: number }) => {
    ensureDbReady();
    return deleteVisit(id, patientId);
  });

  // Dashboard - Patient widgets
  handleData('dashboard:actionNeeded', (_event, { limit }: { limit?: number }) => {
    ensureDbReady();
    return getActionNeeded(limit);
  });

  handleData('dashboard:patientStats', () => {
    ensureDbReady();
    return getPatientStats();
  });

  // Patient events for calendar/upcoming
  handleData(
    'patients:listBirthdays',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listPatientBirthdays(startDate, endDate);
    },
  );

  handleData(
    'patients:listVisitsInRange',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listPatientVisitsInRange(startDate, endDate);
    },
  );

  // MD-Prüfung
  handleData('audits:sections', () => AUDIT_SECTIONS);

  handleData('audits:exportPersonList', () => {
    ensureDbReady();
    return exportPersonList();
  });

  handleData('audits:list', () => {
    ensureDbReady();
    return listAudits();
  });

  handleData(
    'audits:save',
    (
      _event,
      input: {
        id?: number;
        auditDate: string;
        inspector?: string | null;
        kind?: 'regel' | 'anlass' | null;
        findings?: string | null;
        results: AuditResult[];
        clientIds: number[];
      },
    ) => {
      ensureDbReady();
      return saveAudit(input);
    },
  );

  handleData('audits:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteAudit(id);
  });
};
