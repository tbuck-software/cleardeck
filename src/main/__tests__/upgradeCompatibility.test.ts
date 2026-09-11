// @vitest-environment node
import { CURRENT_SCHEMA_VERSION } from '../database/migrations';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import SqliteAdapter from './sqliteAdapter';
const runtime = vi.hoisted(() => ({ root: '' }));
vi.mock('electron', () => ({ app: { getPath: () => runtime.root }, dialog: {} }));
vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));
import {
  openDatabase,
  closeDb,
  getDb,
  setStorageMode,
  setEncryptionKey,
  getDataDir,
  getEncryptedDbPath,
  getWorkingDbPath,
} from '../database/connection';
import { encryptBuffer } from '../crypto';
import { migrations } from '../database/migrations';
import { listPatients, listVisits } from '../repositories/patients';

for (const [tag, mode] of [
  ['v1.7.1', 'encrypted'],
  ['v1.8.0', 'encrypted'],
  ['v1.8.0', 'plain'],
] as const) {
  describe(`automatic upgrade ${tag} ${mode}`, () => {
    let file: string;
    let before: Buffer;
    beforeEach(() => {
      runtime.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-upgrade-test-'));
      const key = mode === 'encrypted' ? randomBytes(32) : null;
      setStorageMode(mode);
      setEncryptionKey(key);
      fs.mkdirSync(getDataDir(), { recursive: true });
      const old = new SqliteAdapter(':memory:');
      old.exec(fs.readFileSync(path.join(__dirname, 'fixtures', `${tag}.sql`), 'utf8'));
      const bytes = old.serialize();
      old.close();
      if (key) {
        const enc = encryptBuffer(bytes, key);
        before = Buffer.concat([enc.iv, enc.tag, enc.content]);
      } else before = bytes;
      file = mode === 'plain' ? getWorkingDbPath() : getEncryptedDbPath();
      fs.writeFileSync(file, before);
      fs.writeFileSync(path.join(getDataDir(), 'config.json'), '{}');
    });
    afterEach(() => {
      vi.restoreAllMocks();
      closeDb();
      setEncryptionKey(null);
      fs.rmSync(runtime.root, { recursive: true, force: true });
    });
    it('opens existing data automatically, backs up once and preserves historical records', () => {
      openDatabase();
      expect(getDb().prepare('SELECT name, weeklyHours, fte FROM employees').get()).toMatchObject({
        name: 'Upgrade Test',
        weeklyHours: 27,
        fte: 0.75,
      });
      expect(getDb().prepare('SELECT COUNT(*) AS n FROM employment_periods').get()).toMatchObject({
        n: 2,
      });
      expect(listPatients()[0].legacyQprStatus).toBe('C');
      expect(listPatients()[0].serviceScopeSource).toBe('services');
      expect(listVisits(1)[0]).toMatchObject({
        legacyQprRating: 'D',
        comment: 'Historische Visite',
      });
      const backups = () =>
        fs
          .readdirSync(path.join(getDataDir(), 'backups'))
          .filter((f) => f.startsWith('before-migration-'));
      expect(backups()).toHaveLength(1);
      if (mode === 'encrypted') expect(fs.existsSync(getWorkingDbPath())).toBe(false);
      closeDb();
      openDatabase();
      expect(backups()).toHaveLength(1);
      expect(
        getDb().prepare("SELECT value FROM settings WHERE key='schema_version'").get(),
      ).toMatchObject({ value: String(CURRENT_SCHEMA_VERSION) });
    });
    it('leaves original file and old schema untouched after a migration failure, then retries', () => {
      const migration = migrations.find((m) => m.version === 20)!;
      const spy = vi.spyOn(migration, 'up').mockImplementation((db) => {
        db.exec("UPDATE employees SET name='Must be rolled back'");
        throw new Error('Synthetic migration failure');
      });
      expect(() => openDatabase()).toThrow('Synthetic migration failure');
      expect(fs.readFileSync(file)).toEqual(before);
      spy.mockRestore();
      openDatabase();
      expect(getDb().prepare('SELECT name FROM employees').get()).toMatchObject({
        name: 'Upgrade Test',
      });
    });
    it('does not create an empty replacement if a configured profile is missing its database', () => {
      fs.rmSync(file);
      expect(() => openDatabase()).toThrow('kein neuer Bestand');
      expect(fs.existsSync(file)).toBe(false);
    });
  });
}

it('upgrades the 2.0.0 schema once, keeps every record and marks undecided people as service-derived', () => {
  runtime.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-v200-upgrade-'));
  setStorageMode('plain');
  setEncryptionKey(null);
  fs.mkdirSync(getDataDir(), { recursive: true });
  const old = new SqliteAdapter(':memory:');
  old.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'v2.0.0.sql'), 'utf8'));
  const tables = ['employees', 'employment_periods', 'employee_competencies', 'competency_history',
    'employment_terms', 'employment_term_history', 'employee_instructions', 'patients', 'patient_visits'];
  // v022 adds serviceScopeSource; every column that existed before must survive unchanged.
  const snapshot = (db: Pick<SqliteAdapter, 'prepare'>) => tables.map(table =>
    (db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Array<Record<string, unknown>>).map((row) => {
      const copy = { ...row };
      delete copy.serviceScopeSource;
      return copy;
    }));
  const before = snapshot(old);
  fs.writeFileSync(getWorkingDbPath(), old.serialize());
  fs.writeFileSync(path.join(getDataDir(), 'config.json'), '{}');
  old.close();
  try {
    for (let start = 0; start < 2; start++) {
      openDatabase();
      expect(snapshot(getDb() as unknown as SqliteAdapter)).toEqual(before);
      expect(
        getDb().prepare('SELECT serviceScope, serviceScopeSource FROM patients ORDER BY id').all(),
      ).toEqual([{ serviceScope: 'unknown', serviceScopeSource: 'services' }]);
      const backupDir = path.join(getDataDir(), 'backups');
      expect(fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(name => name.startsWith('before-migration-')) : []).toHaveLength(1);
      closeDb();
    }
  } finally {
    closeDb();
    fs.rmSync(runtime.root, { recursive: true, force: true });
  }
});
