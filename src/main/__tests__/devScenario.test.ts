import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ app: { isPackaged: false }, readConfig: vi.fn(), writeConfig: vi.fn(), open: vi.fn(), mkdir: vi.fn(), mode: vi.fn() }));
vi.mock('electron', () => ({ app: mocks.app }));
vi.mock('../crypto', () => ({ readConfig: mocks.readConfig, writeConfig: mocks.writeConfig }));
vi.mock('../database/connection', () => ({ ensureDataDir: mocks.mkdir, openDatabase: mocks.open, setStorageMode: mocks.mode }));
import { prepareDevelopmentScenario } from '../devScenario';
beforeEach(() => { vi.clearAllMocks(); mocks.app.isPackaged = false; mocks.readConfig.mockReturnValue(null); vi.stubEnv('CLEARDECK_DEV_SCENARIO', 'updates'); });
afterEach(() => vi.unstubAllEnvs());
describe('update development scenario', () => {
  it('sets up only a fresh scenario profile using the normal database seed', () => {
    prepareDevelopmentScenario();
    expect(mocks.writeConfig).toHaveBeenCalledWith({ storageMode: 'plain', configVersion: 3 });
    expect(mocks.mode).toHaveBeenCalledWith('plain');
    expect(mocks.open).toHaveBeenCalledOnce();
  });
  it('preserves existing configuration and encryption', () => {
    mocks.readConfig.mockReturnValue({ storageMode: 'encrypted' });
    prepareDevelopmentScenario();
    expect(mocks.writeConfig).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('never seeds or even reads packaged user data', () => {
    mocks.app.isPackaged = true;
    prepareDevelopmentScenario();
    expect(mocks.readConfig).not.toHaveBeenCalled();
    expect(mocks.writeConfig).not.toHaveBeenCalled();
  });
});
