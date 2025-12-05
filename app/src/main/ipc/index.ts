/**
 * IPC Handlers Index
 *
 * Registers all IPC handlers for the main process.
 */

import type { BrowserWindow } from 'electron';

import { registerAuthHandlers } from './auth';
import { registerDataHandlers } from './data';
import { registerUpdateHandlers, initAutoUpdater } from './updates';

/**
 * Register all IPC handlers
 */
export const registerAllHandlers = (getMainWindow: () => BrowserWindow | null): void => {
  registerAuthHandlers();
  registerDataHandlers();
  registerUpdateHandlers(getMainWindow);
};

export { initAutoUpdater };
