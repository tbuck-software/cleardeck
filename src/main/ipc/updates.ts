/**
 * Updates IPC Handlers
 *
 * Handles auto-update related IPC calls.
 */

import { ipcMain, BrowserWindow } from 'electron';

import { checkForUpdates, downloadUpdate, installUpdate, initAutoUpdater } from '../updater';

/**
 * Register all update-related IPC handlers
 */
export const registerUpdateHandlers = (getMainWindow: () => BrowserWindow | null): void => {
  ipcMain.handle('updates:check', async (_event, manual = false) => {
    return checkForUpdates(getMainWindow(), manual === true);
  });

  ipcMain.handle('updates:download', () => downloadUpdate());

  ipcMain.handle('updates:install', async () => {
    return installUpdate();
  });
};

/**
 * Initialize auto-updater with the main window
 */
export { initAutoUpdater };


