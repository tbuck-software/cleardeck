/**
 * Auto-Updater
 *
 * Handles automatic application updates using electron-updater.
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

import type { UpdateStatus } from '../shared/types';

let updaterInitialized = false;
let updateFeedConfigured = false;
let latestUpdateVersion: string | undefined;

/**
 * Send update status to the renderer process
 */
export const sendUpdateStatus = (mainWindow: BrowserWindow | null, status: UpdateStatus): void => {
  if (mainWindow) {
    mainWindow.webContents.send('updates:status', status);
  }
};

/**
 * Initialize the auto-updater
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null): void => {
  if (updaterInitialized || !app.isPackaged) {
    return;
  }
  updaterInitialized = true;

  const feedUrl = process.env.UPDATE_FEED_URL;
  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel: 'latest' });
    updateFeedConfigured = true;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus(mainWindow, { state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    latestUpdateVersion = info.version;
    sendUpdateStatus(mainWindow, { state: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus(mainWindow, { state: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus(mainWindow, {
      state: 'downloading',
      version: latestUpdateVersion,
      progress: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    latestUpdateVersion = info.version;
    sendUpdateStatus(mainWindow, { state: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus(mainWindow, { state: 'error', message: err.message });
  });

  sendUpdateStatus(mainWindow, { state: 'idle' });
};

/**
 * Check for updates
 */
export const checkForUpdates = async (mainWindow: BrowserWindow | null): Promise<boolean> => {
  if (!app.isPackaged) {
    // Mock update for development
    if (process.env.MOCK_UPDATE_BANNER === '1') {
      sendUpdateStatus(mainWindow, { state: 'available', version: 'dev-demo' });
      setTimeout(
        () => sendUpdateStatus(mainWindow, { state: 'downloading', version: 'dev-demo', progress: 42 }),
        300,
      );
      setTimeout(
        () => sendUpdateStatus(mainWindow, { state: 'downloaded', version: 'dev-demo' }),
        1200,
      );
      return true;
    }
    sendUpdateStatus(mainWindow, { state: 'not-available' });
    return false;
  }

  if (!updaterInitialized) {
    initAutoUpdater(mainWindow);
  }

  if (!updateFeedConfigured) {
    const feedUrl = process.env.UPDATE_FEED_URL;
    if (!feedUrl) {
      sendUpdateStatus(mainWindow, { state: 'error', message: 'UPDATE_FEED_URL ist nicht konfiguriert.' });
      return false;
    }
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel: 'latest' });
    updateFeedConfigured = true;
  }

  await autoUpdater.checkForUpdates();
  return true;
};

/**
 * Install downloaded update
 */
export const installUpdate = (): boolean => {
  if (!app.isPackaged) return false;
  if (!updaterInitialized) return false;
  autoUpdater.quitAndInstall();
  return true;
};

/**
 * Check if updater is initialized
 */
export const isUpdaterInitialized = (): boolean => updaterInitialized;
