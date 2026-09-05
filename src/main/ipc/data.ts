/**
 * Data IPC Handlers
 *
 * Handles employee, period, and event data operations.
 */

import { ipcMain, shell } from 'electron';

import type { AuditResult, EmployeeEventType, IntervalSource, YearDataset } from '../../shared/types';
import { getDb, isDbOpen, getEncryptionKey, getStorageMode, openDatabase, closeDb, deleteDatabase as deleteDbFiles, ensureDataDir } from '../database/connection';
import {
  getYearDataset,
  listPeriods,
  saveEmployee,
  deleteEmployee,
  deletePeriod,
} from '../repositories/employees';
import { listEvents, saveEvent, deleteEvent, listUpcomingEvents, listEventsInRange } from '../repositories/events';
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
  // Employee data
  ipcMain.handle('data:list', (_event, { year }: { year: number }): YearDataset => {
    ensureDbReady();
    return getYearDataset(year);
  });

  ipcMain.handle('data:listPeriods', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listPeriods(employeeId);
  });

  ipcMain.handle('data:save', (_event, input) => {
    ensureDbReady();
    return saveEmployee(input);
  });

  ipcMain.handle('data:delete', (_event, { id, year }: { id: number; year: number }) => {
    ensureDbReady();
    return deleteEmployee(id, year);
  });

  ipcMain.handle(
    'data:export',
    async (_event, { year, format }: { year: number; format: 'csv' | 'xlsx' }) => {
      ensureDbReady();
      return exportData(year, format);
    },
  );

  ipcMain.handle('data:openDocument', async (_event, { path: filePath }: { path: string }) => {
    if (!filePath) return;
    await shell.openPath(filePath);
  });

  // Periods
  ipcMain.handle('period:delete', (_event, { periodId, year }: { periodId: number; year: number }) => {
    ensureDbReady();
    return deletePeriod(periodId, year);
  });

  // Qualifications
  ipcMain.handle('qualifications:list', () => {
    ensureDbReady();
    return listQualifications();
  });

  ipcMain.handle(
    'qualifications:add',
    (_event, { name, note }: { name: string; note?: string | null }) => {
      ensureDbReady();
      return addQualification(name, note);
    },
  );

  ipcMain.handle(
    'qualifications:update',
    (_event, { id, name, note }: { id: number; name: string; note?: string | null }) => {
      ensureDbReady();
      return updateQualification(id, name, note);
    },
  );

  ipcMain.handle('qualifications:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteQualification(id);
  });

  ipcMain.handle('qualifications:reorder', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderQualifications(ids);
  });

  // Competencies
  ipcMain.handle('competencies:listDefinitions', () => {
    ensureDbReady();
    return listCompetencyDefinitions();
  });

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('competencies:deleteDefinition', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteCompetencyDefinition(id);
  });

  ipcMain.handle('competencies:reorderDefinitions', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderCompetencyDefinitions(ids);
  });

  ipcMain.handle('competencies:listEmployee', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEmployeeCompetencies(employeeId);
  });

  ipcMain.handle(
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

  ipcMain.handle(
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
  ipcMain.handle('instructions:listDefinitions', () => {
    ensureDbReady();
    return listInstructionDefinitions();
  });

  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('instructions:deleteDefinition', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteInstructionDefinition(id);
  });

  ipcMain.handle('instructions:reorderDefinitions', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderInstructionDefinitions(ids);
  });

  ipcMain.handle('instructions:listEmployee', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEmployeeInstructions(employeeId);
  });

  ipcMain.handle(
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

  ipcMain.handle(
    'instructions:employeesWithOpen',
    (_event, { instructionDefinitionId }: { instructionDefinitionId: number }) => {
      ensureDbReady();
      return listEmployeesWithOpenInstruction(instructionDefinitionId);
    },
  );

  ipcMain.handle(
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

  ipcMain.handle(
    'instructions:deleteEmployee',
    (
      _event,
      {
        employeeId,
        instructionDefinitionId,
      }: {
        employeeId: number;
        instructionDefinitionId: number;
      },
    ) => {
      ensureDbReady();
      return deleteEmployeeInstruction(employeeId, instructionDefinitionId);
    },
  );

  // Events
  ipcMain.handle('events:list', (_event, { employeeId }: { employeeId: number }) => {
    ensureDbReady();
    return listEvents(employeeId);
  });

  ipcMain.handle(
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

  ipcMain.handle('events:delete', (_event, { id, employeeId }: { id: number; employeeId: number }) => {
    ensureDbReady();
    return deleteEvent(id, employeeId);
  });

  ipcMain.handle(
    'events:listUpcoming',
    (_event, { fromDate, limit }: { fromDate?: string; limit?: number }) => {
      ensureDbReady();
      return listUpcomingEvents(fromDate, limit);
    },
  );

  ipcMain.handle(
    'events:listRange',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listEventsInRange(startDate, endDate);
    },
  );

  // Settings
  ipcMain.handle('settings:getBaseHours', () => {
    ensureDbReady();
    return getBaseHours();
  });

  ipcMain.handle('settings:setBaseHours', (_event, { hours }: { hours: number }) => {
    ensureDbReady();
    return setBaseHours(hours);
  });

  ipcMain.handle('settings:getHiddenEventTypes', () => {
    ensureDbReady();
    return getHiddenEventTypes();
  });

  ipcMain.handle('settings:setHiddenEventTypes', (_event, { types }: { types: string[] }) => {
    ensureDbReady();
    return setHiddenEventTypes(types);
  });

  // Database management
  ipcMain.handle('db:export', (_event, { mode }: { mode: 'encrypted' | 'plain' }) => {
    ensureDbReady();
    return exportDatabase(mode);
  });

  ipcMain.handle('db:import', (_event, { mode }: { mode: 'encrypted' | 'plain' }) => {
    ensureDbReady();
    return importDatabase(mode);
  });

  ipcMain.handle('db:delete', () => {
    ensureDataDir();
    closeDb();
    deleteDbFiles();
    return true;
  });

  // Dashboard widgets
  ipcMain.handle(
    'dashboard:expiringTrainings',
    (_event, { withinDays, limit }: { withinDays?: number; limit?: number }) => {
      ensureDbReady();
      return getExpiringTrainings(withinDays, limit);
    }
  );

  ipcMain.handle(
    'dashboard:birthdaysAnniversaries',
    (_event, { withinDays, limit }: { withinDays?: number; limit?: number }) => {
      ensureDbReady();
      return getBirthdaysAndAnniversaries(withinDays, limit);
    }
  );

  ipcMain.handle(
    'dashboard:employeeStats',
    (_event, { dueSoonDays, limit }: { dueSoonDays?: number; limit?: number }) => {
      ensureDbReady();
      return getEmployeeDashboardStats(dueSoonDays, limit);
    }
  );

  ipcMain.handle('dashboard:openInstructions', (_event, { limit }: { limit?: number }) => {
    ensureDbReady();
    return listOpenInstructions(limit);
  });

  ipcMain.handle('dashboard:definitionUsage', () => {
    ensureDbReady();
    return getDefinitionUsage();
  });

  // Backups into the configured folder
  ipcMain.handle('backup:settings', () => {
    ensureDbReady();
    const settings = getBackupSettings();
    return { ...settings, backups: listBackups(settings.folder) };
  });

  ipcMain.handle('backup:setSettings', (_event, input: Partial<BackupSettings>) => {
    ensureDbReady();
    const settings = setBackupSettings(input);
    return { ...settings, backups: listBackups(settings.folder) };
  });

  ipcMain.handle('backup:chooseFolder', async () => {
    ensureDbReady();
    await chooseBackupFolder();
    const settings = getBackupSettings();
    return { ...settings, backups: listBackups(settings.folder) };
  });

  ipcMain.handle('backup:run', async () => {
    ensureDbReady();
    const result = await runBackup();
    const settings = getBackupSettings();
    return { ...result, settings: { ...settings, backups: listBackups(settings.folder) } };
  });

  ipcMain.handle('backup:restore', async (_event, { path: source }: { path: string }) => {
    ensureDbReady();
    const result = await restoreBackup(source);
    const settings = getBackupSettings();
    return { ...result, settings: { ...settings, backups: listBackups(settings.folder) } };
  });

  ipcMain.handle('settings:careSettings', () => {
    ensureDbReady();
    return {
      visitIntervalDays: getVisitIntervalDays(),
      instructionReminderDays: getInstructionReminderDays(),
    };
  });

  ipcMain.handle(
    'settings:setCareSettings',
    (
      _event,
      input: { visitIntervalDays?: number; instructionReminderDays?: number },
    ) => {
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
  ipcMain.handle('dev:tables', () => {
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
  ipcMain.handle('patients:list', () => {
    ensureDbReady();
    return listPatients();
  });

  ipcMain.handle('patients:get', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return getPatient(id);
  });

  ipcMain.handle(
    'patients:save',
    (
      _event,
      input: SavePatientInput,
    ) => {
      ensureDbReady();
      return savePatient(input);
    },
  );

  ipcMain.handle('patients:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deletePatient(id);
  });

  // Patient Visits
  ipcMain.handle('visits:list', (_event, { patientId }: { patientId: number }) => {
    ensureDbReady();
    return listVisits(patientId);
  });

  ipcMain.handle(
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

  ipcMain.handle('visits:recent', (_event, { perPatient }: { perPatient?: number }) => {
    ensureDbReady();
    return listRecentVisits(perPatient);
  });

  ipcMain.handle('visits:delete', (_event, { id, patientId }: { id: number; patientId: number }) => {
    ensureDbReady();
    return deleteVisit(id, patientId);
  });

  // Dashboard - Patient widgets
  ipcMain.handle('dashboard:actionNeeded', (_event, { limit }: { limit?: number }) => {
    ensureDbReady();
    return getActionNeeded(limit);
  });

  ipcMain.handle('dashboard:patientStats', () => {
    ensureDbReady();
    return getPatientStats();
  });

  // Patient events for calendar/upcoming
  ipcMain.handle(
    'patients:listBirthdays',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listPatientBirthdays(startDate, endDate);
    },
  );

  ipcMain.handle(
    'patients:listVisitsInRange',
    (_event, { startDate, endDate }: { startDate: string; endDate: string }) => {
      ensureDbReady();
      return listPatientVisitsInRange(startDate, endDate);
    },
  );

  // MD-Prüfung
  ipcMain.handle('audits:sections', () => AUDIT_SECTIONS);

  ipcMain.handle('audits:exportPersonList', () => {
    ensureDbReady();
    return exportPersonList();
  });

  ipcMain.handle('audits:list', () => {
    ensureDbReady();
    return listAudits();
  });

  ipcMain.handle(
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

  ipcMain.handle('audits:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteAudit(id);
  });
};
