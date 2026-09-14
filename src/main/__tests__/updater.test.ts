import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  send: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  readUpdateCredentials: vi.fn(() => null),
  resolveUpdateSource: vi.fn((): any => ({ kind: 'packaged' })),
  getPackagedUpdateConfig: vi.fn(),
  updater: { on: vi.fn(), setFeedURL: vi.fn(), checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(), autoDownload: true, autoInstallOnAppQuit: true, logger: null as any, requestHeaders: null as any },
}));
vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '1.7.2' } }));
vi.mock('electron-updater', () => ({ autoUpdater: mocks.updater }));
vi.mock('../diagnostics', () => ({ recordUpdateStatus: vi.fn() }));
vi.mock('../updatePreferences', () => ({ readUpdateCredentials: mocks.readUpdateCredentials }));
vi.mock('../updateSource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../updateSource')>();
  return {
    redactUpdateFeedUrl: actual.redactUpdateFeedUrl,
    getPackagedUpdateConfig: mocks.getPackagedUpdateConfig,
    resolveUpdateSource: mocks.resolveUpdateSource,
  };
});
const window = { isDestroyed: () => false, webContents: { send: mocks.send } } as unknown as BrowserWindow;
const emit = (name: string, value?: unknown) => mocks.handlers.get(name)?.(value);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.updater.logger = mocks.logger;
  mocks.readUpdateCredentials.mockReturnValue(null);
  mocks.resolveUpdateSource.mockReturnValue({ kind: 'packaged' });
  mocks.getPackagedUpdateConfig.mockReturnValue(undefined);
  mocks.updater.on.mockImplementation((name, handler) => { mocks.handlers.set(name, handler); return mocks.updater; });
  mocks.updater.checkForUpdates.mockResolvedValue({});
  mocks.updater.downloadUpdate.mockResolvedValue([]);
});

describe('update lifecycle', () => {
  it('waits for an explicit download click', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-available', { version: '1.9.0', releaseNotes: '- Neue Übersicht' });
    expect(mocks.updater.autoDownload).toBe(false);
    expect(mocks.updater.downloadUpdate).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenLastCalledWith('updates:status', expect.objectContaining({ state: 'available', releaseNotes: '- Neue Übersicht' }));
  });

  it('preserves a downloaded update when focus triggers another check', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-downloaded', { version: '1.9.0' });
    await updater.checkForUpdates(window);
    expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenLastCalledWith('updates:status', expect.objectContaining({ state: 'downloaded' }));
  });

  it('shows installation preparation and keeps native failures visible', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-downloaded', { version: '1.9.0' });
    expect(updater.installUpdate()).toBe(true);
    expect(mocks.send).toHaveBeenLastCalledWith('updates:status', expect.objectContaining({ state: 'installing' }));
    emit('error', new Error('Code signature invalid'));
    expect(mocks.send).toHaveBeenLastCalledWith('updates:status', expect.objectContaining({ state: 'error', retry: 'install', message: 'Code signature invalid' }));
    await updater.checkForUpdates(window);
    expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('does not attempt installation without a downloaded artifact', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    expect(updater.installUpdate()).toBe(false);
    expect(mocks.updater.quitAndInstall).not.toHaveBeenCalled();
  });
  it('downloads only once, reports ETA, and keeps notes through completion', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-available', { version: '1.9.0', releaseNotes: '- Neu' });
    let finish: (files: string[]) => void = () => undefined;
    mocks.updater.downloadUpdate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const downloading = updater.downloadUpdate();
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'downloading', progress: 0 });
    await updater.downloadUpdate();
    await updater.checkForUpdates(window);
    expect(mocks.updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled();
    emit('download-progress', { percent: 25.4, total: 1000, transferred: 250, bytesPerSecond: 100 });
    expect(updater.getUpdateStatus()).toMatchObject({ progress: 25, remainingSeconds: 8, releaseNotes: '- Neu' });
    emit('download-progress', { percent: NaN, total: 0, transferred: 0, bytesPerSecond: 0 });
    expect(updater.getUpdateStatus()).toMatchObject({ progress: undefined, remainingSeconds: undefined });
    emit('update-downloaded', { version: '1.9.0' });
    finish(['update.exe']);
    expect(await downloading).toBe(true);
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'downloaded', releaseNotes: '- Neu' });
    expect(mocks.updater.quitAndInstall).not.toHaveBeenCalled();
    updater.installUpdate();
    updater.installUpdate();
    expect(mocks.updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('keeps a rejected download actionable across background checks and retries', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-available', { version: '1.9.0' });
    mocks.updater.downloadUpdate.mockRejectedValueOnce(new Error('Connection lost'));
    expect(await updater.downloadUpdate()).toBe(false);
    await updater.checkForUpdates(window);
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', retry: 'download', message: 'Connection lost' });
    mocks.updater.downloadUpdate.mockImplementationOnce(async () => { emit('update-downloaded', { version: '1.9.0' }); return []; });
    expect(await updater.downloadUpdate()).toBe(true);
    expect(updater.getUpdateStatus().state).toBe('downloaded');
  });

  it('keeps a check failure until an explicit retry', async () => {
    const updater = await import('../updater');
    mocks.updater.checkForUpdates.mockRejectedValueOnce(new Error('Offline'));
    expect(await updater.checkForUpdates(window)).toBe(false);
    await updater.checkForUpdates(window);
    expect(mocks.updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', retry: 'check' });
    mocks.updater.checkForUpdates.mockImplementationOnce(async () => { emit('update-available', { version: '1.9.0' }); return {}; });
    await updater.checkForUpdates(window, true);
    expect(updater.getUpdateStatus().state).toBe('available');
  });

  it('shows every intermediate release since the installed version in semantic order', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-available', { version: '1.10.0', releaseNotes: [
      { version: '1.7.2', note: 'Already installed' },
      { version: '1.8.0', note: '- Eight' },
      { version: '2.0.0', note: 'Future' },
      { version: 'Unreleased', note: 'Not shipped' },
      { version: '1.10.0', note: '- Ten' },
      { version: '1.9.0', note: '- Nine' },
      { version: '1.7.3', note: '- Patch' },
    ] });
    expect(updater.getUpdateStatus().releaseNotes).toBe('Version 1.10.0\n- Ten\n\nVersion 1.9.0\n- Nine\n\nVersion 1.8.0\n- Eight\n\nVersion 1.7.3\n- Patch');
  });

  it.each([401, 403, 404])('retries an authenticated feed anonymously after HTTP %s', async (statusCode) => {
    const token = `ghp_${'a'.repeat(25)}`;
    mocks.resolveUpdateSource.mockReturnValue({
      kind: 'github',
      owner: 'Someone',
      repo: 'renamed-app',
      private: true,
      token,
    });
    mocks.updater.checkForUpdates
      .mockRejectedValueOnce(Object.assign(new Error(`HTTP ${statusCode}`), { statusCode }))
      .mockImplementationOnce(async () => {
        emit('update-available', { version: '2.2.1', releaseNotes: '- Neues Update' });
        return {};
      });
    const updater = await import('../updater');
    expect(await updater.checkForUpdates(window)).toBe(true);
    expect(mocks.updater.setFeedURL).toHaveBeenNthCalledWith(1, {
      provider: 'github', owner: 'Someone', repo: 'renamed-app', private: false, token,
    });
    expect(mocks.updater.setFeedURL).toHaveBeenNthCalledWith(2, {
      provider: 'github', owner: 'Someone', repo: 'renamed-app', private: false, requestHeaders: {},
    });
    expect(mocks.send).toHaveBeenLastCalledWith(
      'updates:status',
      expect.objectContaining({ state: 'available', releaseNotes: '- Neues Update' }),
    );
  });

  it('does not retry an anonymous access failure more than once', async () => {
    mocks.resolveUpdateSource.mockReturnValue({
      kind: 'github', owner: 'Someone', repo: 'renamed-app', private: true, token: 'local-token',
    });
    mocks.updater.checkForUpdates
      .mockRejectedValueOnce(Object.assign(new Error('HTTP 403'), { statusCode: 403 }))
      .mockRejectedValueOnce(Object.assign(new Error('HTTP 403'), { statusCode: 403 }));
    const updater = await import('../updater');
    expect(await updater.checkForUpdates(window)).toBe(false);
    expect(mocks.updater.setFeedURL).toHaveBeenCalledTimes(2);
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', message: 'HTTP 403' });
  });

  it('passes saved repository credentials to source resolution', async () => {
    const credentials = { owner: 'Someone', repo: 'renamed-app', token: 'local-token' };
    mocks.readUpdateCredentials.mockReturnValue(credentials);
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    expect(mocks.resolveUpdateSource).toHaveBeenCalledWith(expect.objectContaining({ runtimeCredentials: credentials }));
  });

  it('configures the packaged public feed without inherited environment credentials', async () => {
    const previousToken = process.env.GH_TOKEN;
    process.env.GH_TOKEN = 'stale-environment-token';
    mocks.getPackagedUpdateConfig.mockReturnValue({
      provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false,
    });
    try {
      const updater = await import('../updater');
      updater.initAutoUpdater(window);
      expect(mocks.updater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false, requestHeaders: {},
      });
    } finally {
      if (previousToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousToken;
    }
  });

  it('redacts generic feed credentials from the UI and updater logger', async () => {
    const feed = 'https://feed-user:feed-password@updates.example.com/latest.yml?access_token=query-secret&channel=stable';
    mocks.resolveUpdateSource.mockReturnValue({ kind: 'generic', url: feed });
    const updater = await import('../updater');
    updater.initAutoUpdater(window);

    mocks.updater.logger.error(`Unable to load ${feed}`);
    emit('error', new Error(`Unable to load ${feed}`));

    const loggerMessage = mocks.logger.error.mock.calls[mocks.logger.error.mock.calls.length - 1]?.[0] as string;
    const uiMessage = mocks.send.mock.calls[mocks.send.mock.calls.length - 1]?.[1]?.message as string;
    expect(loggerMessage).toBe('Unable to load https://updates.example.com/latest.yml');
    expect(uiMessage).toBe('Unable to load https://updates.example.com/latest.yml');
    expect(loggerMessage).not.toContain('feed-password');
    expect(loggerMessage).not.toContain('query-secret');
  });

  it('resets a source after an idle or available state and configures it on the next check', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-available', { version: '2.2.1', releaseNotes: '- Alt' });
    updater.resetUpdateSource();
    expect(updater.getUpdateStatus()).toEqual({ state: 'idle' });
    await updater.checkForUpdates(window);
    expect(mocks.resolveUpdateSource).toHaveBeenCalledTimes(2);
  });

  it('rejects source changes while an update is ready to install', async () => {
    const updater = await import('../updater');
    updater.initAutoUpdater(window);
    emit('update-downloaded', { version: '2.2.1' });
    expect(() => updater.resetUpdateSource()).toThrow(/bereitliegenden Updates/);
  });

  it('requires a fresh check after an authenticated download switches source', async () => {
    mocks.resolveUpdateSource.mockReturnValue({
      kind: 'github', owner: 'Someone', repo: 'renamed-app', private: true, token: 'local-token',
    });
    mocks.updater.checkForUpdates.mockImplementationOnce(async () => {
      emit('update-available', { version: '2.2.1', releaseNotes: '- Neues Update' });
      return {};
    });
    const updater = await import('../updater');
    expect(await updater.checkForUpdates(window)).toBe(true);
    mocks.updater.downloadUpdate.mockRejectedValueOnce(Object.assign(new Error('HTTP 403'), { statusCode: 403 }));
    mocks.updater.checkForUpdates.mockRejectedValueOnce(Object.assign(new Error('HTTP 403'), { statusCode: 403 }));

    expect(await updater.downloadUpdate()).toBe(false);
    expect(await updater.downloadUpdate()).toBe(false);
    expect(mocks.updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', retry: 'check' });
    expect(updater.getUpdateStatus()).toMatchObject({ message: expect.stringMatching(/zuerst nach Updates suchen/) });
  });

});
