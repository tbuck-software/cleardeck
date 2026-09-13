// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
  assertCanChange: vi.fn(),
  getPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  ipcMain: {
    handle: (name: string, handler: (...args: any[]) => any) => mocks.handlers.set(name, handler),
  },
}));
vi.mock('../updater', () => ({
  checkForUpdates: mocks.check,
  downloadUpdate: mocks.download,
  installUpdate: mocks.install,
  initAutoUpdater: mocks.init,
  resetUpdateSource: mocks.reset,
  assertUpdateSourceCanChange: mocks.assertCanChange,
}));
vi.mock('../updatePreferences', () => ({
  getUpdatePreferences: mocks.getPreferences,
  saveUpdatePreferences: mocks.savePreferences,
}));

import { registerUpdateHandlers } from '../ipc/updates';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  registerUpdateHandlers(() => null);
});

describe('update preference IPC', () => {
  it('returns only the renderer-safe preference view', async () => {
    const preferences = { repositoryUrl: 'https://github.com/Someone/app', hasToken: true };
    mocks.getPreferences.mockReturnValue(preferences);

    expect(await mocks.handlers.get('updates:getPreferences')!()).toEqual(preferences);
    expect(mocks.handlers.get('updates:getPreferences')).toBeDefined();
  });

  it('checks availability and resets only after persisting a new source', async () => {
    const preferences = { repositoryUrl: 'https://github.com/Someone/app', hasToken: false };
    mocks.savePreferences.mockReturnValue(preferences);

    expect(
      await mocks.handlers.get('updates:savePreferences')!(null, {
        repositoryUrl: preferences.repositoryUrl,
      }),
    ).toEqual(preferences);
    expect(mocks.reset).toHaveBeenCalledOnce();
    expect(mocks.savePreferences).toHaveBeenCalledWith({ repositoryUrl: preferences.repositoryUrl });
    expect(mocks.assertCanChange.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.savePreferences.mock.invocationCallOrder[0],
    );
    expect(mocks.savePreferences.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reset.mock.invocationCallOrder[0],
    );
  });

  it('keeps the current updater state when saving fails', () => {
    mocks.savePreferences.mockImplementationOnce(() => {
      throw new Error('Speichern fehlgeschlagen.');
    });
    expect(() => mocks.handlers.get('updates:savePreferences')!(null, {
      repositoryUrl: 'invalid',
    })).toThrow('Speichern fehlgeschlagen.');
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('does not save when the updater rejects a source change', () => {
    mocks.assertCanChange.mockImplementationOnce(() => {
      throw new Error('Update läuft noch.');
    });

    expect(() =>
      mocks.handlers.get('updates:savePreferences')!(null, {
        repositoryUrl: 'https://github.com/Someone/app',
        token: 'synthetic-token',
      }),
    ).toThrow('Update läuft noch.');
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });
});
