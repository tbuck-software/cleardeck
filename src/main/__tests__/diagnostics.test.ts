// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { formatDiagnostics } from '../../shared/diagnostics';
const mock = vi.hoisted(() => ({ root: '' }));
vi.mock('electron', () => ({ app: { getPath: () => mock.root, getVersion: () => '1.8.0' } }));
beforeEach(() => { vi.resetModules(); mock.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-diagnostics-')); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(mock.root, { force: true, recursive: true }); });
const logFile = () => path.join(mock.root, 'logs', 'diagnostics.json');

describe('local diagnostics privacy and persistence', () => {
  it('records useful signature failures without retaining raw errors or credentials', async () => {
    const log = await import('../diagnostics');
    log.recordAppStart();
    log.recordUpdateStatus({ state: 'error', version: '1.9.0', message: 'code has no resources (-67056) https://alice:password@example.com?token=ghp_secret /Users/alice/private.db' });
    const snapshot = log.readDiagnostics();
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({ level: 'error', source: 'Updates', message: expect.stringContaining('-67056') });
    expect(snapshot.entries[1].at).toMatch(/^\d{4}-.*Z$/);
    for (const text of [fs.readFileSync(logFile(), 'utf8'), formatDiagnostics(snapshot)]) {
      expect(text).not.toMatch(/alice|password|example.com|ghp_secret|private.db/);
    }
    vi.resetModules();
    expect((await import('../diagnostics')).readDiagnostics().entries).toEqual(snapshot.entries);
  });
  it('discards forged text, properties, versions and event names on read and export', async () => {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    fs.writeFileSync(logFile(), JSON.stringify([
      { at: '2026-09-05T18:24:14.060Z', event: 'error', code: 'signature', message: 'secret', version: 'secret', token: 'secret' },
      { at: '2026-09-05T18:24:14.060Z', event: 'update', state: 'secret' },
      { at: 'secret', event: 'start' },
    ]));
    const snapshot = (await import('../diagnostics')).readDiagnostics();
    expect(snapshot.entries).toHaveLength(1);
    expect(formatDiagnostics(snapshot)).not.toContain('secret');
  });
  it('bounds retention and samples download progress without losing completion', async () => {
    const log = await import('../diagnostics');
    for (let i = 0; i < 260; i++) log.recordUpdateStatus({ state: 'available', version: `1.9.${i}` });
    for (let i = 0; i < 100; i++) log.recordUpdateStatus({ state: 'downloading', progress: i });
    log.recordUpdateStatus({ state: 'downloaded', version: '1.9.259' });
    const entries = log.readDiagnostics().entries;
    expect(entries).toHaveLength(250);
    expect(entries[0].message).toContain('Download abgeschlossen');
    expect(entries.filter(entry => entry.message.includes('heruntergeladen.'))).toHaveLength(4);
    expect(fs.statSync(logFile()).size).toBeLessThan(256 * 1024);
  });
  it('reports storage errors without breaking updater actions or exposing paths', async () => {
    const log = await import('../diagnostics');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('/Users/secret ENOSPC'); });
    expect(() => log.recordUpdateStatus({ state: 'installing' })).not.toThrow();
    expect(log.readDiagnostics().storageError).toBe('Diagnoseeinträge konnten nicht gespeichert werden.');
    expect(formatDiagnostics(log.readDiagnostics())).not.toContain('secret');
  });
});
