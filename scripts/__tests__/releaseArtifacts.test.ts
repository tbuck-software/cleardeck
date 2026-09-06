// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { stringify } from 'yaml';
const { verifyArtifacts, verifyFeeds } = createRequire(import.meta.url)(
  '../verify-release-artifacts.cjs',
);
let root: string;
const asset = (name: string) => {
  const bytes = Buffer.from(name);
  fs.writeFileSync(path.join(root, name), bytes);
  return {
    url: name,
    size: bytes.length,
    sha512: crypto.createHash('sha512').update(bytes).digest('base64'),
  };
};
const manifest = (name: string, version: string, files: ReturnType<typeof asset>[]) =>
  fs.writeFileSync(
    path.join(root, name),
    stringify({ version, files, path: files[0].url, sha512: files[0].sha512 }),
  );
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-release-'));
  manifest('latest.yml', '2.0.0', [asset('ClearDeck-2.0.0-Setup.exe')]);
  asset('cleardeck-2.0.0-full.nupkg');
  asset('RELEASES');
  manifest('latest-linux.yml', '2.0.0', [
    asset('cleardeck_2.0.0_amd64.deb'),
    asset('cleardeck-2.0.0-1.x86_64.rpm'),
  ]);
  manifest('latest-mac.yml', '1.8.0', [asset('ClearDeck-darwin-arm64-1.8.0.zip')]);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
it('validates complete platform artifacts and retains the actual old Mac provider behavior', async () => {
  expect(verifyArtifacts(root, '2.0.0', '1.8.0').assets).toHaveLength(9);
  const feeds = await verifyFeeds(root, '2.0.0', '1.8.0');
  expect(feeds).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: 'latest',
        installed: '1.7.1',
        offered: '2.0.0',
        updateAvailable: true,
      }),
      expect.objectContaining({
        channel: 'latest',
        installed: '1.8.0',
        offered: '2.0.0',
        updateAvailable: true,
      }),
      expect.objectContaining({
        channel: 'latest-mac',
        installed: '1.7.1',
        offered: '1.8.0',
        updateAvailable: true,
      }),
      expect.objectContaining({
        channel: 'latest-mac',
        installed: '1.8.0',
        offered: '1.8.0',
        updateAvailable: false,
      }),
    ]),
  );
});
it('rejects missing platform metadata before publishing', () => {
  fs.unlinkSync(path.join(root, 'latest-mac.yml'));
  expect(() => verifyArtifacts(root, '2.0.0', '1.8.0')).toThrow('Missing latest-mac.yml');
});
it('rejects changed installer bytes', () => {
  fs.appendFileSync(path.join(root, 'ClearDeck-2.0.0-Setup.exe'), 'corrupt');
  expect(() => verifyArtifacts(root, '2.0.0', '1.8.0')).toThrow('SHA-512 mismatch');
});
it('rejects metadata for the wrong target version', () => {
  expect(() => verifyArtifacts(root, '2.1.0', '1.8.0')).toThrow('Wrong version');
});
it('rejects duplicate basenames that would overwrite a release asset', () => {
  fs.mkdirSync(path.join(root, 'duplicate'));
  fs.copyFileSync(path.join(root, 'latest.yml'), path.join(root, 'duplicate/latest.yml'));
  expect(() => verifyArtifacts(root, '2.0.0', '1.8.0')).toThrow('Duplicate');
});
it('does not silently replace the retained Mac feed with a different release', () => {
  expect(() => verifyArtifacts(root, '2.0.0', '2.0.0')).toThrow('Wrong version in latest-mac.yml');
});
