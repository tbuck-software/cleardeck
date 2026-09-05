// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), save: vi.fn(), read: vi.fn() }));
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: any[]) => any) => mocks.handlers.set(name, handler) }, dialog: { showSaveDialog: mocks.save } }));
vi.mock('../diagnostics', () => ({ readDiagnostics: mocks.read }));
import { registerDiagnosticHandlers } from '../ipc/diagnostics';
let root: string;
beforeEach(() => { vi.clearAllMocks(); mocks.handlers.clear(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-export-')); registerDiagnosticHandlers(() => null); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
it('writes no file until the user explicitly selects a destination', async () => {
  const target = path.join(root, 'diagnostics.txt');
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockResolvedValue({ canceled: true, filePath: target });
  expect(await mocks.handlers.get('diagnostics:export')!()).toBe(false);
  expect(fs.existsSync(target)).toBe(false);
  expect(mocks.read).not.toHaveBeenCalled();
  mocks.save.mockResolvedValue({ canceled: false, filePath: target });
  mocks.read.mockReturnValue({ entries: [{ at: '2026-09-05T18:24:14.060Z', level: 'error', source: 'Updates', message: 'Signaturprüfung fehlgeschlagen.' }] });
  expect(await mocks.handlers.get('diagnostics:export')!()).toBe(true);
  expect(fs.readFileSync(target, 'utf8')).toContain('[ERROR] Updates: Signaturprüfung fehlgeschlagen.');
});
