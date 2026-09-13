/**
 * Auto-Updater
 *
 * Handles automatic application updates using electron-updater.
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { gt, lte, valid, rcompare } from 'semver';

import { appVersion } from './appVersion';
import { recordUpdateStatus } from './diagnostics';
import type { UpdateStatus } from '../shared/types';
import { readUpdateCredentials } from './updatePreferences';
import { getPackagedUpdateConfig, redactUpdateFeedUrl, resolveUpdateSource } from './updateSource';

let updaterInitialized = false;
let updateFeedConfigured = false;
let updateSetupError: string | null = null;
let updateWindow: BrowserWindow | null = null;
let currentStatus: UpdateStatus = { state: 'idle' };
let release: { version?: string; releaseNotes?: string } = {};
let downloaded = false;
let retryAction: 'check' | 'download' | 'install' = 'check';
let authenticatedSource: { owner: string; repo: string; token: string } | null = null;
let anonymousFallbackAttempted = false;
let redactionTokens: string[] = [];
let updateCheckFresh = false;
let redactingLoggerInstalled = false;

const redactUpdateMessage = (message: string): string => {
  const redactedTokens = redactionTokens
    .reduce(
      (redacted, token) => redacted.replaceAll(token, '[redacted token]'),
      message.replace(/(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}/g, '[redacted token]'),
    );
  return redactedTokens.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, redactUpdateFeedUrl);
};

const installRedactingLogger = (): void => {
  if (redactingLoggerInstalled || !autoUpdater.logger) return;
  const logger = autoUpdater.logger;
  const redactLogValue = (value: unknown): unknown => {
    if (value instanceof Error) return redactUpdateMessage(value.stack || value.message);
    return typeof value === 'string' ? redactUpdateMessage(value) : value;
  };
  const safeLogger: typeof logger = {
    info: (message?: unknown) => logger.info(redactLogValue(message)),
    warn: (message?: unknown) => logger.warn(redactLogValue(message)),
    error: (message?: unknown) => logger.error(redactLogValue(message)),
  };
  if (logger.debug) safeLogger.debug = (message: string) => logger.debug?.(redactUpdateMessage(message));
  autoUpdater.logger = safeLogger;
  redactingLoggerInstalled = true;
};

export const getUpdateStatus = (): UpdateStatus => currentStatus;

export const sendUpdateStatus = (mainWindow: BrowserWindow | null, status: UpdateStatus): void => {
  currentStatus = status;
  recordUpdateStatus(status);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', status);
  }
};
const publish = (status: UpdateStatus) => sendUpdateStatus(updateWindow, status);
const fail = (error: unknown) => publish({
  ...release,
  state: 'error',
  message: redactUpdateMessage(error instanceof Error ? error.message : String(error)),
  retry: retryAction,
});
const rememberRelease = (info: { version: string; releaseNotes?: string | { version: string; note: string | null }[] }) => {
  const installedVersion = appVersion();
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

  // AppUpdater keeps requestHeaders on the singleton. Clear headers before
  // each source selection so a prior authenticated source cannot bleed into
  // a public feed after reset or anonymous fallback.
  autoUpdater.requestHeaders = null;
  updateCheckFresh = false;
  const packagedConfig = getPackagedUpdateConfig(process.resourcesPath);
  const source = resolveUpdateSource({
    updateFeedUrl: process.env.UPDATE_FEED_URL,
    ghToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    runtimeCredentials: readUpdateCredentials(),
    packagedConfig,
  });

  if (source.kind === 'generic') {
    autoUpdater.setFeedURL({ provider: 'generic', url: source.url, channel: 'latest' });
    authenticatedSource = null;
    updateFeedConfigured = true;
    return;
  }

  if (source.kind === 'github') {
    const config = {
      provider: 'github' as const,
      owner: source.owner,
      repo: source.repo,
      // electron-updater gives process.env.GH_TOKEN precedence whenever
      // private is true. Passing the saved token explicitly with private
      // false makes the token selection deterministic for this installation.
      private: source.private && source.token ? false : source.private,
      ...(source.private && source.token ? { token: source.token } : {}),
      ...(!source.private ? { requestHeaders: {} } : {}),
    };
    autoUpdater.setFeedURL(config);
    authenticatedSource = source.private && source.token
      ? { owner: source.owner, repo: source.repo, token: source.token }
      : null;
    if (source.private && source.token && !redactionTokens.includes(source.token)) redactionTokens.push(source.token);
    anonymousFallbackAttempted = false;
    updateFeedConfigured = true;
    return;
  }

  if (source.kind === 'packaged') {
    authenticatedSource = null;
    if (packagedConfig?.provider === 'github') {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: packagedConfig.owner || 'Rasalas',
        repo: packagedConfig.repo || 'employee-db',
        private: false,
        requestHeaders: {},
      });
    }
    updateFeedConfigured = true;
    return;
  }

  updateSetupError = source.reason;
};

const isAuthOrAccessFailure = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const value = error as { statusCode?: unknown; status?: unknown; response?: { statusCode?: unknown } };
    const status = Number(value.statusCode ?? value.status ?? value.response?.statusCode);
    if ([401, 403, 404].includes(status)) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:401|403|404)\b|unauthori[sz]ed|forbidden|bad credentials|authentication required/i.test(message);
};

const retryWithAnonymousSource = (error: unknown): boolean => {
  if (!authenticatedSource || anonymousFallbackAttempted || !isAuthOrAccessFailure(error)) return false;
  anonymousFallbackAttempted = true;
  updateCheckFresh = false;
  autoUpdater.requestHeaders = null;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: authenticatedSource.owner,
    repo: authenticatedSource.repo,
    private: false,
    requestHeaders: {},
  });
  authenticatedSource = null;
  return true;
};

/**
 * Initialize the auto-updater
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null): void => {
  updateWindow = mainWindow;
  if (updaterInitialized || !app.isPackaged) return;
  updaterInitialized = true;
  installRedactingLogger();
  configureUpdateSource();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    updateCheckFresh = true;
    rememberRelease(info);
    publish({ ...release, state: 'available' });
  });
  autoUpdater.on('update-not-available', () => {
    updateCheckFresh = true;
    publish({ state: 'not-available' });
  });
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
      updateCheckFresh = true;
      publish({ ...release, state: 'available' });
      return true;
    }
    publish({ state: 'not-available' });
    return false;
  }
  initAutoUpdater(mainWindow);
  if (!updateFeedConfigured && !updateSetupError) configureUpdateSource();
  retryAction = 'check';
  if (updateSetupError) {
    fail(new Error(updateSetupError));
    return false;
  }
  updateCheckFresh = false;
  publish({ state: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
    updateCheckFresh = getUpdateStatus().state !== 'error';
    return getUpdateStatus().state !== 'error';
  } catch (error) {
    updateCheckFresh = false;
    if (retryWithAnonymousSource(error)) {
      publish({ state: 'checking' });
      try {
        await autoUpdater.checkForUpdates();
        updateCheckFresh = getUpdateStatus().state !== 'error';
        return getUpdateStatus().state !== 'error';
      } catch (anonymousError) {
        updateCheckFresh = false;
        fail(anonymousError);
        return false;
      }
    }
    fail(error);
    return false;
  }
};

export const downloadUpdate = async (): Promise<boolean> => {
  if (currentStatus.state === 'downloading') return true;
  if (currentStatus.state !== 'available' && !(currentStatus.state === 'error' && currentStatus.retry === 'download')) return false;
  if (!updateCheckFresh) {
    retryAction = 'check';
    fail(new Error('Bitte zuerst nach Updates suchen, bevor das Update heruntergeladen wird.'));
    return false;
  }
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
    if (retryWithAnonymousSource(error)) {
      try {
        await autoUpdater.checkForUpdates();
        // A source switch invalidates the old candidate. Only an available
        // result may make downloadUpdate eligible again.
        updateCheckFresh = getUpdateStatus().state === 'available';
        if (getUpdateStatus().state === 'available') return downloadUpdate();
      } catch (anonymousError) {
        updateCheckFresh = false;
        fail(anonymousError);
        return false;
      }
    }
    fail(error);
    return false;
  }
};

export const assertUpdateSourceCanChange = (): void => {
  if (downloaded || ['checking', 'downloading', 'downloaded', 'installing'].includes(currentStatus.state)) {
    throw new Error('Die Updatequelle kann während eines laufenden oder bereitliegenden Updates nicht geändert werden.');
  }
};

export const resetUpdateSource = (): void => {
  assertUpdateSourceCanChange();
  updateFeedConfigured = false;
  updateSetupError = null;
  authenticatedSource = null;
  anonymousFallbackAttempted = false;
  redactionTokens = [];
  release = {};
  downloaded = false;
  updateCheckFresh = false;
  retryAction = 'check';
  publish({ state: 'idle' });
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
