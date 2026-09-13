/**
 * Updates IPC Handlers
 *
 * Handles auto-update related IPC calls.
 */

import { ipcMain, BrowserWindow } from 'electron';

import { checkForUpdates, downloadUpdate, installUpdate, initAutoUpdater, assertUpdateSourceCanChange, resetUpdateSource } from '../updater';
import { getUpdatePreferences, saveUpdatePreferences } from '../updatePreferences';
import type { SaveUpdatePreferencesInput } from '../../shared/updatePreferences';

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

  ipcMain.handle('updates:getPreferences', () => getUpdatePreferences());

  ipcMain.handle(
    'updates:savePreferences',
    (_event, input: SaveUpdatePreferencesInput) => {
      // All three operations are synchronous: a failed validation or write
      // keeps both the saved source and the current update status intact.
      assertUpdateSourceCanChange();
      const preferences = saveUpdatePreferences(input);
      resetUpdateSource();
      return preferences;
    },
  );
};

/**
 * Initialize auto-updater with the main window
 */
export { initAutoUpdater };
