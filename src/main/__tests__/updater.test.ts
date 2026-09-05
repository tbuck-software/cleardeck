import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  send: vi.fn(),
  updater: { on: vi.fn(), setFeedURL: vi.fn(), checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(), autoDownload: true, autoInstallOnAppQuit: true },
}));
vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '1.7.2' } }));
vi.mock('electron-updater', () => ({ autoUpdater: mocks.updater }));
vi.mock('../diagnostics', () => ({ recordUpdateStatus: vi.fn() }));
vi.mock('../updateSource', () => ({ getPackagedUpdateConfig: vi.fn(), resolveUpdateSource: () => ({ kind: 'packaged' }) }));
const window = { isDestroyed: () => false, webContents: { send: mocks.send } } as unknown as BrowserWindow;
const emit = (name: string, value?: unknown) => mocks.handlers.get(name)?.(value);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.handlers.clear();
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

});
