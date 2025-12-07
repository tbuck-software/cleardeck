/**
 * Updates IPC Handlers
 *
 * Handles auto-update related IPC calls.
 */

import { ipcMain, BrowserWindow } from 'electron';

import { checkForUpdates, installUpdate, initAutoUpdater } from '../updater';

/**
 * Register all update-related IPC handlers
 */
export const registerUpdateHandlers = (getMainWindow: () => BrowserWindow | null): void => {
  ipcMain.handle('updates:check', async () => {
    return checkForUpdates(getMainWindow());
  });

  ipcMain.handle('updates:install', async () => {
    return installUpdate();
  });
};

/**
 * Initialize auto-updater with the main window
 */
export { initAutoUpdater };

