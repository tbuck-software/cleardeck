// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
const childProcess = createRequire(import.meta.url)('child_process');
const execFileSync = vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => Buffer.from(''));
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { signMacBundles } from '../sign-mac-bundles';
let root: string;
beforeEach(() => { vi.clearAllMocks(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-signing-')); fs.mkdirSync(path.join(root, 'ClearDeck.app')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
describe('Forge macOS signing contract', () => {
  it('signs the actual outputPaths payload and verifies the complete bundle', () => {
    signMacBundles({ platform: 'darwin', outputPaths: [root] });
    expect(execFileSync).toHaveBeenCalledWith('codesign', ['--force', '--deep', '--sign', '-', path.join(root, 'ClearDeck.app')], expect.anything());
    expect(execFileSync).toHaveBeenCalledWith('codesign', ['--verify', '--deep', '--strict', path.join(root, 'ClearDeck.app')], expect.anything());
  });
  it('fails instead of silently skipping signing for the old incorrect payload', () => {
    expect(() => signMacBundles({ platform: 'darwin', outputPaths: undefined })).toThrow('outputPaths');
  });
  it('refuses an ad-hoc release and preserves configured Developer ID signatures', () => {
    expect(() => signMacBundles({ platform: 'darwin', outputPaths: [root] }, { requireDeveloperId: true })).toThrow('Developer ID');
    signMacBundles({ platform: 'darwin', outputPaths: [root] }, { identity: 'Developer ID Application: Test', requireDeveloperId: true });
    expect(vi.mocked(execFileSync).mock.calls.every((call) => !call[1]?.includes('--sign'))).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith('codesign', expect.arrayContaining(['-R', '=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists']), expect.anything());
  });
});
