/// <reference types="vitest/globals" />
// @vitest-environment node

import { isAutoBackupDue } from '../backup';

const NOW = new Date('2026-09-05T10:00:00Z');
const base = { folder: '/Volumes/NAS/ClearDeck', auto: 'daily' as const, lastBackupAt: null as string | null };

describe('isAutoBackupDue', () => {
  it('macht nichts ohne Backup-Ordner', () => {
    expect(isAutoBackupDue({ ...base, folder: null }, NOW)).toBe(false);
  });

  it('macht nichts, wenn abgeschaltet', () => {
    expect(isAutoBackupDue({ ...base, auto: 'off' }, NOW)).toBe(false);
  });

  it('sichert beim Schließen immer', () => {
    expect(isAutoBackupDue({ ...base, auto: 'close', lastBackupAt: NOW.toISOString() }, NOW)).toBe(true);
  });

  it('sichert ohne bisherige Sicherung sofort', () => {
    expect(isAutoBackupDue({ ...base, auto: 'weekly' }, NOW)).toBe(true);
  });

  it('wartet täglich einen Tag ab', () => {
    const gestern = new Date(NOW.getTime() - 25 * 3600 * 1000).toISOString();
    const vorhin = new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString();

    expect(isAutoBackupDue({ ...base, lastBackupAt: gestern }, NOW)).toBe(true);
    expect(isAutoBackupDue({ ...base, lastBackupAt: vorhin }, NOW)).toBe(false);
  });

  it('wartet wöchentlich eine Woche ab', () => {
    const achtTage = new Date(NOW.getTime() - 8 * 86400 * 1000).toISOString();
    const dreiTage = new Date(NOW.getTime() - 3 * 86400 * 1000).toISOString();

    expect(isAutoBackupDue({ ...base, auto: 'weekly', lastBackupAt: achtTage }, NOW)).toBe(true);
    expect(isAutoBackupDue({ ...base, auto: 'weekly', lastBackupAt: dreiTage }, NOW)).toBe(false);
  });
});
