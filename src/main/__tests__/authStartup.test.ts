/// <reference types="vitest/globals" />

import fs from 'fs';
import os from 'os';
import path from 'path';

const runtime = vi.hoisted(() => ({
  root: '',
  handlers: new Map<string, (...args: any[]) => any>(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => runtime.root },
  ipcMain: { handle: (name: string, handler: (...args: any[]) => any) => runtime.handlers.set(name, handler) },
  shell: {},
}));

// Keep filesystem/configuration handling real; no native SQLite is needed to decide startup state.
vi.mock('../database/connection', () => ({
  setEncryptionKey: vi.fn(), getEncryptionKey: vi.fn(),
  setStorageMode: vi.fn(), getStorageMode: vi.fn(),
  openDatabase: vi.fn(), persistEncryptedDb: vi.fn(), closeDb: vi.fn(),
  deleteEncryptedSnapshot: vi.fn(), ensureDataDir: vi.fn(), isDbOpen: vi.fn(),
}));

import { registerAuthHandlers, setUnlocked } from '../ipc/auth';
import { getConfigPath, getDataDir, getEncryptedDbPath, getWorkingDbPath } from '../appPaths';
import { openDatabase } from '../database/connection';
import { readConfig, writeConfig } from '../crypto';

const invoke = (name: string, ...args: unknown[]) => runtime.handlers.get(name)!(undefined, ...args);

describe('authentication startup with existing local data', () => {
  beforeEach(() => {
    runtime.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-startup-'));
    fs.mkdirSync(getDataDir());
    runtime.handlers.clear();
    vi.clearAllMocks();
    setUnlocked(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(runtime.root, { recursive: true, force: true });
  });

  it('allows setup only for a new data directory', () => {
    registerAuthHandlers();
    expect(invoke('app:state')).toEqual({ configured: false, unlocked: false, storageMode: 'encrypted' });
  });

  it.each(['', '{broken', '{}', 'null', '[]', '{"storageMode":"unknown"}'])('does not report first setup for an unreadable config: %j', (content) => {
    fs.writeFileSync(getConfigPath(), content);
    registerAuthHandlers();
    expect(invoke('app:state')).toMatchObject({ unlocked: false, startupError: expect.stringContaining('config.json') });
    expect(fs.readFileSync(getConfigPath(), 'utf8')).toBe(content);
    expect(() => invoke('auth:register', 'new password')).toThrow(/config.json/);
    expect(() => invoke('auth:registerPlain')).toThrow(/config.json/);
  });

  it.each(['encrypted', 'working'])('blocks setup when config is missing but the %s database exists', (kind) => {
    const dbPath = kind === 'encrypted' ? getEncryptedDbPath() : getWorkingDbPath();
    fs.writeFileSync(dbPath, 'existing data');
    registerAuthHandlers();
    expect(invoke('app:state')).toMatchObject({ unlocked: false, startupError: expect.any(String) });
    for (const channel of ['auth:register', 'auth:registerPlain']) {
      expect(() => invoke(channel, 'new password')).toThrow(/Konfiguration|Daten/);
    }
    expect(fs.existsSync(getConfigPath())).toBe(false);
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('existing data');
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('preserves login for a valid legacy encrypted config', () => {
    fs.writeFileSync(getConfigPath(), JSON.stringify({
      salt: 'salt', passwordHash: 'hash', encryptedKey: 'key', keyIv: 'iv', keyTag: 'tag', configVersion: 2,
    }));
    registerAuthHandlers();
    expect(invoke('app:state')).toEqual({ configured: true, unlocked: false, storageMode: 'encrypted' });
  });

  it('does not treat a permission failure as a missing config', () => {
    registerAuthHandlers();
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('Access denied'), { code: 'EACCES' });
    });
    expect(invoke('app:state')).toMatchObject({ startupError: expect.stringContaining('nicht gelesen') });
  });

  it('blocks setup if only a SQLite journal or unfinished config write remains', () => {
    for (const name of ['employee.db-wal', 'employee.db-journal', 'config.json.interrupted.tmp']) {
      const file = path.join(getDataDir(), name);
      fs.writeFileSync(file, 'remaining data');
      expect(() => readConfig()).toThrow(/lokale Daten/);
      fs.rmSync(file);
    }
  });

  it('allows starting without a password for a valid plain config', () => {
    writeConfig({ storageMode: 'plain', configVersion: 3 });
    registerAuthHandlers();
    expect(invoke('app:state')).toEqual({ configured: true, unlocked: true, storageMode: 'plain' });
  });

  it('keeps the old config intact when writing the replacement is interrupted', () => {
    const previous = '{"storageMode":"plain","configVersion":3}';
    fs.writeFileSync(getConfigPath(), previous);
    const write = fs.writeFileSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce((file) => {
      write(file, '');
      throw new Error('Simulated disk write failure');
    });
    expect(() => writeConfig({ storageMode: 'plain', configVersion: 4 })).toThrow('Simulated disk write failure');
    expect(fs.readFileSync(getConfigPath(), 'utf8')).toBe(previous);
    expect(fs.readdirSync(getDataDir())).toEqual(['config.json']);
  });

  it('keeps the old config intact when Windows refuses the rename', () => {
    writeConfig({ storageMode: 'plain', configVersion: 3 });
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('Access denied'); });
    expect(() => writeConfig({ storageMode: 'plain', configVersion: 4 })).toThrow('Access denied');
    expect(readConfig()).toEqual({ storageMode: 'plain', configVersion: 3 });
    expect(fs.readdirSync(getDataDir())).toEqual(['config.json']);
  });
});
