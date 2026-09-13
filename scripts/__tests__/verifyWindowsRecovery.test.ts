// @vitest-environment node
/// <reference types="vitest/globals" />

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { stringify } from 'yaml';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const { createClient } = require('electron-updater/out/providerFactory');
const { PrivateGitHubProvider } = require('electron-updater/out/providers/PrivateGitHubProvider');
const {
  verifyPackagedBundle,
  verifyPrivateGitHubFeed,
  verifyPublicGitHubFeed,
  verifyWindowsArtifacts,
  verifyWindowsRecovery,
} = require('../verify-windows-recovery.cjs');

const version = '2.2.1';
let root: string;
let artifactRoot: string;
let appSource: string;
let packageRoot: string;
let nupkgRoot: string;

const setupName = `ClearDeck-${version}-Setup.exe`;
const packageName = `cleardeck-${version}-full.nupkg`;
const setupBytes = Buffer.from('Windows setup fixture');
const setupSha512 = crypto.createHash('sha512').update(setupBytes).digest('base64');
const appUpdate = 'provider: github\nowner: Rasalas\nrepo: employee-db\nprivate: false\n';

const zip = (source: string, output: string) =>
  execFileSync('zip', ['-qr', output, '.'], { cwd: source, stdio: 'ignore' });

const manifest = () => ({
  version,
  files: [{ url: setupName, size: setupBytes.length, sha512: setupSha512 }],
  path: setupName,
  sha512: setupSha512,
  releaseNotes: [{ version, note: '- Windows feed fixture' }],
});

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-windows-recovery-test-'));
  artifactRoot = path.join(root, 'artifacts');
  appSource = path.join(root, 'app-source');
  packageRoot = path.join(root, `ClearDeck-win32-x64-${version}`);
  nupkgRoot = path.join(root, 'nupkg');
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.mkdirSync(appSource, { recursive: true });
  fs.writeFileSync(path.join(appSource, 'main.js'), 'module.exports = { ready: true };\n');

  const appAsar = path.join(root, 'app.asar');
  await asar.createPackage(appSource, appAsar);
  fs.mkdirSync(path.join(packageRoot, 'resources'), { recursive: true });
  fs.copyFileSync(appAsar, path.join(packageRoot, 'resources/app.asar'));
  fs.writeFileSync(path.join(packageRoot, 'resources/app-update.yml'), appUpdate);

  const nupkgResources = path.join(nupkgRoot, 'lib/net45/resources');
  fs.mkdirSync(nupkgResources, { recursive: true });
  fs.copyFileSync(appAsar, path.join(nupkgResources, 'app.asar'));
  fs.writeFileSync(path.join(nupkgResources, 'app-update.yml'), appUpdate);

  fs.writeFileSync(path.join(artifactRoot, setupName), setupBytes);
  fs.writeFileSync(path.join(artifactRoot, 'latest.yml'), stringify(manifest()));
  const nupkg = path.join(artifactRoot, packageName);
  zip(nupkgRoot, nupkg);
  const nupkgBytes = fs.readFileSync(nupkg);
  fs.writeFileSync(
    path.join(artifactRoot, 'RELEASES'),
    `${crypto.createHash('sha1').update(nupkgBytes).digest('hex')} ${packageName} ${nupkgBytes.length}\n`,
  );
  const portableZip = path.join(artifactRoot, `ClearDeck-win32-x64-${version}.zip`);
  zip(packageRoot, portableZip);
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it('checks the Windows manifest and Squirrel hashes', () => {
  const report = verifyWindowsArtifacts(artifactRoot, version);
  expect(report.manifest.path).toBe(setupName);
  expect(report.artifacts.package.name).toBe(packageName);
  expect(report.artifacts.releases.entries).toHaveLength(1);
});

it('uses the actual public GitHub provider with both runtime token variables present', async () => {
  const result = await verifyPublicGitHubFeed({
    version,
    manifestText: fs.readFileSync(path.join(artifactRoot, 'latest.yml'), 'utf8'),
  });
  expect(result.provider).toBe('github');
  expect(result.artifactUrl).toContain(`/releases/download/v${version}/${setupName}`);
  expect(result.releaseNotes).toEqual(manifest().releaseNotes);
  expect(result.requests.every((request: { authorization: boolean }) => !request.authorization)).toBe(true);
});

it('uses the actual private GitHub provider against a local fixture', async () => {
  const result = await verifyPrivateGitHubFeed({
    version,
    manifestText: fs.readFileSync(path.join(artifactRoot, 'latest.yml'), 'utf8'),
  });

  expect(result.provider).toBe('github');
  expect(result.private).toBe(true);
  expect(result.artifactUrl).toContain(`/api/v3/repos/Rasalas/employee-db/releases/assets/${setupName}`);
  expect(result.releaseNotes).toEqual(manifest().releaseNotes);
  expect(result.requests).toHaveLength(3);
  expect(result.requests.every((request: { authorization: boolean }) => request.authorization)).toBe(true);
});

it('lets an explicit saved token win when the environment has unrelated credentials', () => {
  const previous = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  process.env.GH_TOKEN = 'unrelated-environment-token';
  process.env.GITHUB_TOKEN = 'another-environment-token';
  const updater = {
    allowPrerelease: false,
    channel: null,
    currentVersion: require('semver').parse('2.1.0'),
    fullChangelog: false,
  };
  const runtimeOptions = {
    isUseMultipleRangeRequests: false,
    platform: 'win32',
    executor: { request: () => Promise.reject(new Error('not called')) },
  };
  try {
    const provider = createClient({
      provider: 'github',
      owner: 'Someone',
      repo: 'renamed-app',
      private: false,
      token: 'saved-installation-token',
    }, updater, runtimeOptions);
    expect(provider).toBeInstanceOf(PrivateGitHubProvider);
    expect((provider as { token: string }).token).toBe('saved-installation-token');
  } finally {
    if (previous.GH_TOKEN === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = previous.GH_TOKEN;
    if (previous.GITHUB_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN;
  }
});

it('verifies the portable ZIP and Squirrel package app.asar payloads', async () => {
  const result = await verifyWindowsRecovery(artifactRoot, version);
  expect(result.bundle.portable.updateConfig).toEqual({
    provider: 'github',
    owner: 'Rasalas',
    repo: 'employee-db',
    private: false,
  });
  expect(result.bundle.portable.appAsar.sha256).toBe(result.bundle.squirrel.appAsar.sha256);
  expect(result.feed.version).toBe(version);
  expect(result.privateFeed.version).toBe(version);
  expect(result.privateFeed.private).toBe(true);
});

it('rejects a token hidden in an extracted app.asar entry', async () => {
  fs.writeFileSync(path.join(appSource, 'main.js'), `const token = "ghp_${'a'.repeat(25)}";`);
  const taintedAsar = path.join(root, 'tainted.asar');
  await asar.createPackage(appSource, taintedAsar);
  const taintedRoot = path.join(root, 'tainted-package/resources');
  fs.mkdirSync(taintedRoot, { recursive: true });
  fs.copyFileSync(taintedAsar, path.join(taintedRoot, 'app.asar'));
  fs.writeFileSync(path.join(taintedRoot, 'app-update.yml'), appUpdate);
  expect(() => verifyPackagedBundle(path.join(root, 'tainted-package'), version)).toThrow(/token pattern/i);
});

it('rejects a private packaged source in a candidate bundle', () => {
  fs.writeFileSync(path.join(packageRoot, 'resources/app-update.yml'), appUpdate.replace('private: false', 'private: true'));
  expect(() => verifyPackagedBundle(packageRoot, version)).toThrow(/private: false/);
});

it('accepts an explicit version that differs from package.json', async () => {
  const output = execFileSync(
    process.execPath,
    [path.resolve('scripts/verify-windows-recovery.cjs'), artifactRoot, version, packageRoot],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(output).version).toBe(version);
  await expect(verifyWindowsRecovery(artifactRoot, '2.2.2')).rejects.toThrow(/Missing Windows release asset/);
});
