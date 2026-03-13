/**
 * Data IPC Handlers
 *
 * Handles employee, period, and event data operations.
 */

import { ipcMain, shell } from 'electron';

import type { EmployeeEventType, YearDataset, QprRating } from '../../shared/types';
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
} from '../repositories/dashboard';
import {
  listQualifications,
  addQualification,
  updateQualification,
  reorderQualifications,
  deleteQualification,
} from '../repositories/qualifications';
import { getBaseHours, setBaseHours, getHiddenEventTypes, setHiddenEventTypes } from '../repositories/settings';
import {
  listPatients,
  getPatient,
  savePatient,
  deletePatient,
  listVisits,
  saveVisit,
  deleteVisit,
  getConcerningRatings,
  getPatientStats,
  listPatientBirthdays,
  listPatientVisitsInRange,
} from '../repositories/patients';
import { exportDatabase, importDatabase, exportData } from '../export';
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
      input: {
        id?: number;
        name: string;
        birthDate?: string | null;
        diagnosis?: string | null;
        qprStatus?: QprRating | null;
        note?: string | null;
      },
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
        qprRating: QprRating;
        comment?: string | null;
      },
    ) => {
      ensureDbReady();
      return saveVisit(input);
    },
  );

  ipcMain.handle('visits:delete', (_event, { id, patientId }: { id: number; patientId: number }) => {
    ensureDbReady();
    return deleteVisit(id, patientId);
  });

  // Dashboard - Patient widgets
  ipcMain.handle('dashboard:concerningRatings', (_event, { limit }: { limit?: number }) => {
    ensureDbReady();
    return getConcerningRatings(limit);
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
};
