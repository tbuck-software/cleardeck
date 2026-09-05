import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const mocks = vi.hoisted(() => ({
  paths: {} as Record<string, string>,
  app: { isPackaged: false, setName: vi.fn(), getName: () => 'ClearDeck Dev', getPath: vi.fn(), setPath: vi.fn(), setAppUserModelId: vi.fn(), setAppLogsPath: vi.fn() },
  mkdir: vi.fn(),
}));
vi.mock('electron', () => ({ app: mocks.app }));
vi.mock('fs', () => ({ default: { mkdirSync: mocks.mkdir } }));
import { configureUserDataPath, getDataDir } from '../appPaths';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CLEARDECK_DEV_SCENARIO', '');
  mocks.app.isPackaged = false;
  mocks.paths = { appData: '/app-data', userData: '/app-data/ClearDeck' };
  mocks.app.getPath.mockImplementation((name: string) => mocks.paths[name]);
  mocks.app.setPath.mockImplementation((name: string, value: string) => { mocks.paths[name] = value; });
});
afterEach(() => vi.unstubAllEnvs());

describe('development identity and data isolation', () => {
  it('retains the existing development folder despite the distinct app name', () => {
    configureUserDataPath();
    expect(mocks.app.setName).toHaveBeenCalledWith('ClearDeck Dev');
    expect(getDataDir()).toBe(path.join('/app-data', 'dev-ClearDeck', 'data'));
    expect(mocks.paths.sessionData).toBe(path.join('/app-data', 'dev-ClearDeck'));
    expect(mocks.app.setAppLogsPath).toHaveBeenCalledWith(path.join('/app-data', 'dev-ClearDeck', 'logs'));
  });
  it('gives the update example a third, separate profile', () => {
    vi.stubEnv('CLEARDECK_DEV_SCENARIO', 'updates');
    configureUserDataPath();
    expect(getDataDir()).toBe(path.join('/app-data', 'dev-ClearDeck-updates', 'data'));
  });
  it('never redirects a packaged application, even with development environment variables', () => {
    mocks.app.isPackaged = true;
    vi.stubEnv('CLEARDECK_DEV_SCENARIO', 'updates');
    configureUserDataPath();
    expect(mocks.app.setName).not.toHaveBeenCalled();
    expect(mocks.app.setPath).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(getDataDir()).toBe(path.join('/app-data/ClearDeck', 'data'));
  });
});
