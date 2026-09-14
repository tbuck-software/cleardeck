/**
 * Electron Main Process Entry Point
 *
 * This file handles only:
 * - Window creation and management
 * - App lifecycle events
 * - IPC handler registration
 *
 * Business logic is organized in:
 * - main/database/     - Database connection & migrations
 * - main/repositories/ - Data access layer
 * - main/ipc/          - IPC handlers
 * - main/export.ts     - Export/import functions
 * - main/updater.ts    - Auto-update handling
 * - main/crypto.ts     - Encryption utilities
 */

import { app, BrowserWindow } from 'electron';

import { recordAppStart } from './main/diagnostics';
import { prepareDevelopmentScenario } from './main/devScenario';
import { configureUserDataPath } from './main/appPaths';
import { persistEncryptedDb } from './main/database/connection';
import { runAutoBackupIfDue } from './main/backup';
import { isServerMode, lockServer, withConnectionLock } from './main/serverConnection';
import { configureExternalLinkHandling } from './main/externalLinks';
import { registerAllHandlers, initAutoUpdater } from './main/ipc';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require('electron-squirrel-startup')) {
  app.quit();
}

configureUserDataPath();
recordAppStart();
prepareDevelopmentScenario();

// =============================================================================
// WINDOW MANAGEMENT
// =============================================================================

let mainWindow: BrowserWindow | null = null;

const getMainWindow = (): BrowserWindow | null => mainWindow;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    title: app.getName(),
    height: 900,
    width: 1400,
    // Below 1100 the sidebar collapses to icons, below 960 wide tables stack
    // (see useViewport). A 1200 minimum locked both breakpoints out entirely
    // and did not fit a 1366x768 laptop once dock and title bar are counted.
    minHeight: 560,
    minWidth: 820,
    backgroundColor: '#f3f5f8',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  configureExternalLinkHandling(mainWindow, MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.on('page-title-updated', (event) => {
      event.preventDefault();
      mainWindow?.setTitle(app.getName());
    });
    if (process.env.CLEARDECK_DEVTOOLS === '1') mainWindow.webContents.openDevTools();
  }
};

// =============================================================================
// APP LIFECYCLE
// =============================================================================

// Register all IPC handlers before app is ready
registerAllHandlers(getMainWindow);

app.on('ready', () => {
  createWindow();
  initAutoUpdater(mainWindow);
});

/**
 * Shutdown order matters: an automatic backup reads the open database, so it
 * has to run before the database is closed and encrypted to disk.
 */
let shuttingDown = false;

export const shutdown = async (): Promise<void> => {
  await withConnectionLock(async () => {
    if (isServerMode()) {
      await lockServer();
      return;
    }
    try {
      await runAutoBackupIfDue();
    } finally {
      persistEncryptedDb();
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit(); // before-quit does the work
    return;
  }
  void shutdown();
});

app.on('before-quit', (event) => {
  if (shuttingDown) return;
  shuttingDown = true;
  event.preventDefault();
  void shutdown().finally(() => app.quit());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
