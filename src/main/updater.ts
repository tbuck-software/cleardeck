/**
 * Auto-Updater
 *
 * Handles automatic application updates using electron-updater.
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { gt, lte, valid, rcompare } from 'semver';

import type { UpdateStatus } from '../shared/types';
import { getPackagedUpdateConfig, resolveUpdateSource } from './updateSource';

let updaterInitialized = false;
let updateFeedConfigured = false;
let updateSetupError: string | null = null;
let updateWindow: BrowserWindow | null = null;
let currentStatus: UpdateStatus = { state: 'idle' };
let release: { version?: string; releaseNotes?: string } = {};
let downloaded = false;
let retryAction: 'check' | 'download' | 'install' = 'check';

export const getUpdateStatus = (): UpdateStatus => currentStatus;

export const sendUpdateStatus = (mainWindow: BrowserWindow | null, status: UpdateStatus): void => {
  currentStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', status);
  }
};
const publish = (status: UpdateStatus) => sendUpdateStatus(updateWindow, status);
const fail = (error: unknown) => publish({
  ...release,
  state: 'error',
  message: error instanceof Error ? error.message : String(error),
  retry: retryAction,
});
const rememberRelease = (info: { version: string; releaseNotes?: string | { version: string; note: string | null }[] }) => {
  const installedVersion = app.getVersion();
  const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : info.releaseNotes
    ?.filter((entry) => valid(entry.version) && valid(installedVersion) && valid(info.version)
      && gt(entry.version, installedVersion) && lte(entry.version, info.version))
    .sort((a, b) => rcompare(a.version, b.version))
    .map((entry) => `Version ${entry.version}\n${entry.note ?? ''}`).join('\n\n');
  release = { version: info.version, releaseNotes: notes || (release.version === info.version ? release.releaseNotes : undefined) };
};

const configureUpdateSource = (): void => {
  if (updateFeedConfigured || updateSetupError) {
    return;
  }

  const source = resolveUpdateSource({
    updateFeedUrl: process.env.UPDATE_FEED_URL,
    ghToken: process.env.GH_TOKEN,
    packagedConfig: getPackagedUpdateConfig(process.resourcesPath),
  });

  if (source.kind === 'generic') {
    autoUpdater.setFeedURL({ provider: 'generic', url: source.url, channel: 'latest' });
    updateFeedConfigured = true;
    return;
  }

  if (source.kind === 'github') {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: source.owner,
      repo: source.repo,
      private: source.private,
      token: source.token,
    });
    updateFeedConfigured = true;
    return;
  }

  if (source.kind === 'packaged') {
    updateFeedConfigured = true;
    return;
  }

  updateSetupError = source.reason;
};

/**
 * Initialize the auto-updater
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null): void => {
  updateWindow = mainWindow;
  if (updaterInitialized || !app.isPackaged) return;
  updaterInitialized = true;
  configureUpdateSource();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    rememberRelease(info);
    publish({ ...release, state: 'available' });
  });
  autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => {
    const remaining = (progress.total - progress.transferred) / progress.bytesPerSecond;
    publish({
      ...release,
      state: 'downloading',
      progress: Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, Math.round(progress.percent))) : undefined,
      remainingSeconds: progress.bytesPerSecond > 0 && Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining)) : undefined,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true;
    rememberRelease(info);
    publish({ ...release, state: 'downloaded' });
  });
  autoUpdater.on('error', fail);
  publish({ state: 'idle' });
};

export const checkForUpdates = async (mainWindow: BrowserWindow | null, manual = false): Promise<boolean> => {
  updateWindow = mainWindow;
  // Focus and interval checks must never replace an active download, staged
  // installer or its error. Republish the snapshot for a reloaded renderer.
  if (downloaded || ['checking', 'downloading', 'installing'].includes(currentStatus.state)
    || (!manual && ['available', 'error'].includes(currentStatus.state))) {
    publish(currentStatus);
    return true;
  }
  if (!app.isPackaged) {
    if (process.env.MOCK_UPDATE_BANNER === '1') {
      release = { version: 'dev-demo', releaseNotes: '- Updates mit Fortschritt herunterladen.\n- Installation und Neustart selbst starten.' };
      publish({ ...release, state: 'available' });
      return true;
    }
    publish({ state: 'not-available' });
    return false;
  }
  initAutoUpdater(mainWindow);
  retryAction = 'check';
  if (updateSetupError) {
    fail(new Error(updateSetupError));
    return false;
  }
  publish({ state: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
    return getUpdateStatus().state !== 'error';
  } catch (error) {
    fail(error);
    return false;
  }
};

export const downloadUpdate = async (): Promise<boolean> => {
  if (currentStatus.state === 'downloading') return true;
  if (currentStatus.state !== 'available' && !(currentStatus.state === 'error' && currentStatus.retry === 'download')) return false;
  retryAction = 'download';
  publish({ ...release, state: 'downloading', progress: 0 });
  if (!app.isPackaged && process.env.MOCK_UPDATE_BANNER === '1') {
    let progress = 0;
    const timer = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        clearInterval(timer);
        downloaded = true;
        publish({ ...release, state: 'downloaded' });
      } else {
        publish({ ...release, state: 'downloading', progress, remainingSeconds: (100 - progress) / 20 });
      }
    }, 1000);
    return true;
  }
  try {
    await autoUpdater.downloadUpdate();
    return getUpdateStatus().state !== 'error';
  } catch (error) {
    fail(error);
    return false;
  }
};

export const installUpdate = (): boolean => {
  if (currentStatus.state === 'installing') return false;
  if (!downloaded) {
    retryAction = release.version ? 'download' : 'check';
    fail(new Error('Es liegt noch kein vollständiger Download zur Installation bereit.'));
    return false;
  }
  retryAction = 'install';
  publish({ ...release, state: 'installing' });
  if (!app.isPackaged) {
    fail(new Error('Die Entwicklungsvorschau kann keinen Installer starten.'));
    return false;
  }
  try {
    // On macOS this also stages the ZIP in Squirrel before the app can quit.
    // Keep the preparing state visible until quit or a native error arrives.
    autoUpdater.quitAndInstall();
    return getUpdateStatus().state !== 'error';
  } catch (error) {
    fail(error);
    return false;
  }
};

export const isUpdaterInitialized = (): boolean => updaterInitialized;
