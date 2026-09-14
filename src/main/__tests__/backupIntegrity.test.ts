// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import SqliteAdapter from './sqliteAdapter';

const runtime = vi.hoisted(() => ({
  root: '',
  handlers: new Map<string, (...args: any[]) => any>(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => runtime.root },
  dialog: {},
  ipcMain: {
    handle: (channel: string, callback: (...args: any[]) => any) =>
      runtime.handlers.set(channel, callback),
  },
}));
vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));

import {
  closeDb,
  openDatabase,
  getDb,
  setStorageMode,
  setEncryptionKey,
  flushDatabase,
  getWorkingDbPath,
  getEncryptedDbPath,
} from '../database/connection';
import { handleData } from '../ipc/persistentHandler';
import { listBackups, restoreBackup, runBackup } from '../backup';
import { decodeBackup, encodeBackup } from '../backupFormat';
import { setBackupSettings } from '../repositories/settings';

const marker = () =>
  (getDb().prepare("SELECT value FROM settings WHERE key='review'").get() as { value?: string })
    ?.value;
const mark = (value: string) =>
  getDb().prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('review',?)").run(value);

describe('backup integrity with real SQLite and filesystem', () => {
  let key: Buffer;
  beforeEach(() => {
    runtime.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-integrity-'));
    key = randomBytes(32);
    setEncryptionKey(key);
    setStorageMode('encrypted');
    openDatabase();
    mark('old');
    flushDatabase();
    setBackupSettings({ folder: path.join(runtime.root, 'backups'), keep: 5 });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    closeDb();
    setEncryptionKey(null);
    fs.rmSync(runtime.root, { recursive: true, force: true });
  });

  it('starts without demo persons and keeps encrypted sessions off plaintext storage', () => {
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM employees').get()).toMatchObject({ n: 0 });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM patients').get()).toMatchObject({ n: 0 });
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
    mark('saved');
    flushDatabase();
    closeDb();
    openDatabase();
    expect(marker()).toBe('saved');
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
  });

  it('never overwrites the source when restoring immediately after a backup', async () => {
    expect((await runBackup()).saved).toBe(true);
    const source = listBackups(path.join(runtime.root, 'backups'))[0].path;
    const original = fs.readFileSync(source);
    mark('changed');
    expect((await restoreBackup(source)).saved).toBe(true);
    expect(marker()).toBe('old');
    expect(fs.readFileSync(source)).toEqual(original);
  });

  it('does not prune the selected oldest backup or collide on same-minute writes', async () => {
    for (let i = 0; i < 5; i++) expect((await runBackup()).saved).toBe(true);
    const entries = listBackups(path.join(runtime.root, 'backups'));
    expect(entries).toHaveLength(5);
    const source = entries[entries.length - 1].path;
    mark('new');
    expect((await restoreBackup(source)).saved).toBe(true);
    expect(fs.existsSync(source)).toBe(true);
    expect(marker()).toBe('old');
  });

  it.each(['invalid', 'wrong-key', 'unrelated'])(
    'keeps live data and snapshot on rejected %s input',
    async (kind) => {
      let input: Buffer = Buffer.from('broken');
      if (kind === 'wrong-key') input = encodeBackup(getDb().serialize(), randomBytes(32));
      if (kind === 'unrelated') {
        const other = new SqliteAdapter(':memory:');
        other.exec('CREATE TABLE alien(id)');
        input = other.serialize();
        other.close();
      }
      const source = path.join(runtime.root, 'input.cdb');
      fs.writeFileSync(source, input);
      const before = fs.readFileSync(getEncryptedDbPath());
      expect((await restoreBackup(source)).saved).toBe(false);
      expect(marker()).toBe('old');
      expect(fs.readFileSync(getEncryptedDbPath())).toEqual(before);
    },
  );

  it('restores an old installation with its recovery key into the current encryption', async () => {
    const oldKey = randomBytes(32);
    const source = path.join(runtime.root, 'old.enc');
    fs.writeFileSync(source, encodeBackup(getDb().serialize(), oldKey));
    mark('current');
    expect((await restoreBackup(source, oldKey.toString('base64'))).saved).toBe(true);
    expect(marker()).toBe('old');
    expect(() => decodeBackup(fs.readFileSync(getEncryptedDbPath()), key)).not.toThrow();
  });

  it('keeps the current connection usable if installing the snapshot fails', async () => {
    const source = path.join(runtime.root, 'old.cdb');
    fs.writeFileSync(source, encodeBackup(getDb().serialize(), key));
    mark('current');
    flushDatabase();
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (to === getEncryptedDbPath()) throw new Error('Disk unavailable');
      return rename(from, to);
    });
    expect((await restoreBackup(source)).saved).toBe(false);
    expect(marker()).toBe('current');
  });
  it('rolls back memory and preserves disk when an acknowledged write cannot persist', async () => {
    const before = fs.readFileSync(getEncryptedDbPath());
    handleData('review:write', () => mark('unsaved'));
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('Disk full');
    });
    await expect(runtime.handlers.get('review:write')!({})).rejects.toThrow('Disk full');
    expect(marker()).toBe('old');
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(before);
  });

  it('refuses a future schema on ordinary startup without overwriting it', () => {
    getDb().prepare("UPDATE settings SET value='999' WHERE key='schema_version'").run();
    flushDatabase();
    closeDb();
    const before = fs.readFileSync(getEncryptedDbPath());
    expect(() => openDatabase()).toThrow('neuere App-Version');
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(before);
  });
});
