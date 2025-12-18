/**
 * Data IPC Handlers
 *
 * Handles employee, period, and event data operations.
 */

import { ipcMain, shell } from 'electron';

import type { EmployeeEventType, YearDataset } from '../../shared/types';
import { getDb, isDbOpen, getEncryptionKey, openDatabase, closeDb, deleteDatabase as deleteDbFiles, ensureDataDir } from '../database/connection';
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
  getDepartmentStats,
  getBirthdaysAndAnniversaries,
} from '../repositories/dashboard';
import {
  listQualifications,
  addQualification,
  updateQualification,
  reorderQualifications,
  deleteQualification,
} from '../repositories/qualifications';
import {
  listDepartments,
  addDepartment,
  updateDepartment,
  reorderDepartments,
  deleteDepartment,
} from '../repositories/departments';
import { getBaseHours, setBaseHours, getHiddenEventTypes, setHiddenEventTypes } from '../repositories/settings';
import { exportDatabase, importDatabase, exportData } from '../export';
import { isUnlocked } from './auth';

/**
 * Ensure database is ready for operations
 */
const ensureDbReady = (): void => {
  if (!isUnlocked() || !getEncryptionKey()) {
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

  // Departments
  ipcMain.handle('departments:list', () => {
    ensureDbReady();
    return listDepartments();
  });

  ipcMain.handle(
    'departments:add',
    (_event, { name, note }: { name: string; note?: string | null }) => {
      ensureDbReady();
      return addDepartment(name, note);
    },
  );

  ipcMain.handle(
    'departments:update',
    (_event, { id, name, note }: { id: number; name: string; note?: string | null }) => {
      ensureDbReady();
      return updateDepartment(id, name, note);
    },
  );

  ipcMain.handle('departments:delete', (_event, { id }: { id: number }) => {
    ensureDbReady();
    return deleteDepartment(id);
  });

  ipcMain.handle('departments:reorder', (_event, { ids }: { ids: number[] }) => {
    ensureDbReady();
    return reorderDepartments(ids);
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

  ipcMain.handle('dashboard:departmentStats', (_event, { year }: { year: number }) => {
    ensureDbReady();
    return getDepartmentStats(year);
  });

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
};


