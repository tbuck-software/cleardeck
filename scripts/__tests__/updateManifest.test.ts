// @vitest-environment node
/// <reference types="vitest/globals" />

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const { PrivateGitHubProvider } = require('electron-updater/out/providers/PrivateGitHubProvider');
const resolveFiles = (info: unknown) => PrivateGitHubProvider.prototype.resolveFiles.call({}, info);

describe('published Windows update manifest', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-manifest-'));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'out/make'), { recursive: true });
    fs.copyFileSync(path.resolve('scripts/generate-update-yml.js'), path.join(root, 'scripts/generate-update-yml.js'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.8.0' }));
    fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'junction');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifact = (name: string) => {
    const file = path.join(root, 'out/make', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'test artifact');
  };
  const generate = () => execFileSync(process.execPath, [path.join(root, 'scripts/generate-update-yml.js')], { stdio: 'pipe' });

  it('rejects a filename that GitHub and the legacy updater normalize differently', () => {
    artifact('squirrel.windows/x64/ClearDeck-1.8.0 Setup.exe');
    expect(generate).toThrow();
    expect(fs.existsSync(path.join(root, 'out/make/latest.yml'))).toBe(false);
  });

  it('publishes only the installer and resolves it with the actual 1.7.1 provider', () => {
    artifact('squirrel.windows/x64/ClearDeck-1.8.0-Setup.exe');
    artifact('squirrel.windows/x64/cleardeck-1.8.0-full.nupkg');
    artifact('zip/win32/x64/ClearDeck-win32-x64-1.8.0.zip');
    artifact('old/ClearDeck-1.8.01-Setup.exe');
    generate();
    const info = parse(fs.readFileSync(path.join(root, 'out/make/latest.yml'), 'utf8'));
    expect(info.files).toHaveLength(1);
    expect(info.path).toBe('ClearDeck-1.8.0-Setup.exe');
    info.assets = [{ name: info.path, url: 'https://api.github.com/repos/test/test/releases/assets/1' }];
    expect(resolveFiles(info)).toHaveLength(1);
  });

  it('reproduces the reported mismatch and resolves the corrected published filename', () => {
    const info = {
      files: [{ url: 'ClearDeck-1.8.0 Setup.exe', sha512: 'test' }],
      assets: [{ name: 'ClearDeck-1.8.0.Setup.exe', url: 'https://api.github.com/repos/test/test/releases/assets/1' }],
    };
    expect(() => resolveFiles(info)).toThrow('Cannot find asset "ClearDeck-1.8.0-Setup.exe"');
    info.files[0].url = info.assets[0].name;
    expect(resolveFiles(info)).toHaveLength(1);
  });
});
