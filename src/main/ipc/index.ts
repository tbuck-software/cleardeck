/**
 * IPC Handlers Index
 *
 * Registers all IPC handlers for the main process.
 */

import type { BrowserWindow } from 'electron';

import { registerDiagnosticHandlers } from './diagnostics';
import { registerAuthHandlers } from './auth';
import { registerServerHandlers } from './server';
import { registerDataHandlers } from './data';
import { registerUpdateHandlers, initAutoUpdater } from './updates';

/**
 * Register all IPC handlers
 */
export const registerAllHandlers = (getMainWindow: () => BrowserWindow | null): void => {
  registerAuthHandlers();
  registerServerHandlers();
  registerDataHandlers();
  registerUpdateHandlers(getMainWindow);
  registerDiagnosticHandlers(getMainWindow);
};

export { initAutoUpdater };

