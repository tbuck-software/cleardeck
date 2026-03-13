/// <reference types="vitest/globals" />

import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'employee-db-archive-'));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'appData') {
        return tempRoot;
      }
      if (name === 'userData') {
        return path.join(tempRoot, 'ClearDeck');
      }
      return tempRoot;
    },
    isPackaged: true,
    getName: () => 'ClearDeck',
  },
}));

import { archiveAppData } from '../dataArchive';
import { getConfigPath, getEncryptedDbPath, getWorkingDbPath } from '../appPaths';

describe('archiveAppData', () => {
  afterEach(() => {
    fs.rmSync(path.join(tempRoot, 'ClearDeck'), { recursive: true, force: true });
  });

  it('verschiebt vorhandene Konfiguration und Datenbankdateien in ein Archiv', () => {
    const dataDir = path.dirname(getConfigPath());
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(getConfigPath(), '{"configVersion":3}');
    fs.writeFileSync(getEncryptedDbPath(), 'encrypted');
    fs.writeFileSync(getWorkingDbPath(), 'plain');

    const archiveDir = archiveAppData();

    expect(archiveDir).toBeTruthy();
    expect(fs.existsSync(getConfigPath())).toBe(false);
    expect(fs.existsSync(getEncryptedDbPath())).toBe(false);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
    expect(fs.readFileSync(path.join(archiveDir!, 'config.json'), 'utf8')).toBe('{"configVersion":3}');
    expect(fs.readFileSync(path.join(archiveDir!, 'employee.db.enc'), 'utf8')).toBe('encrypted');
    expect(fs.readFileSync(path.join(archiveDir!, 'employee.db'), 'utf8')).toBe('plain');
  });

  it('liefert null, wenn nichts archiviert werden muss', () => {
    expect(archiveAppData()).toBeNull();
  });
});
