/* eslint-disable @typescript-eslint/no-var-requires -- Release tooling. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { listFiles, verifyWindowsRecovery } = require('./verify-windows-recovery.cjs');
const version = require('../package.json').version;

const gh = (args) => execFileSync('gh', args, { stdio: 'pipe', encoding: 'utf8' });
const hashes = (root) => Object.fromEntries(listFiles(root)
  .map((file) => [path.basename(file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])
  .sort(([a], [b]) => a.localeCompare(b)));

async function main() {
  const tag = `v${version}`;
  if (version !== '2.2.1' || process.env.GITHUB_REF !== `refs/tags/${tag}`)
    throw Error('Windows recovery publishing requires the matching v2.2.1 tag.');
  if (process.env.NATIVE_WINDOWS_UPGRADES_VERIFIED !== '1')
    throw Error('The three native Windows upgrade jobs must pass before publishing.');
  if (!process.argv[2]) throw Error('Windows artifact directory required.');
  const root = path.resolve(process.argv[2]);
  await verifyWindowsRecovery(root, version);
  const files = listFiles(root);
  const names = files.map((file) => path.basename(file));
  const expected = ['latest.yml', 'RELEASES', `ClearDeck-${version}-Setup.exe`,
    `cleardeck-${version}-full.nupkg`, `ClearDeck-win32-x64-${version}.zip`].sort();
  if (JSON.stringify([...names].sort()) !== JSON.stringify(expected))
    throw Error('Recovery release must contain exactly the five verified Windows assets.');

  let existing;
  try {
    existing = JSON.parse(gh(['release', 'view', tag, '--json', 'isDraft']));
  } catch (error) {
    if (!String(error.stderr).includes('release not found')) throw error;
  }
  if (existing && !existing.isDraft) throw Error('Release already published; refusing mutation.');
  const notes = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'cleardeck-windows-recovery-notes.md');
  execFileSync(process.execPath, ['scripts/release-notes.js', notes]);
  fs.appendFileSync(notes, '\nNur Windows. Für die einmalige Umstellung ClearDeck schließen und den neuen Installer über die vorhandene Version installieren. Passwort und Daten bleiben erhalten. Bei einem privaten GitHub-Repository anschließend unter Einstellungen → Verbindungen → Update-Quelle ändern einen persönlichen Zugriffstoken mit Leserechten hinterlegen.\n');
  if (!existing)
    gh(['release', 'create', tag, '--verify-tag', '--draft', '--title', tag, '--notes-file', notes]);
  else gh(['release', 'edit', tag, '--notes-file', notes]);
  for (const file of files) gh(['release', 'upload', tag, file, '--clobber']);

  const downloaded = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'cleardeck-windows-upload-check-'));
  gh(['release', 'download', tag, '--dir', downloaded]);
  await verifyWindowsRecovery(downloaded, version);
  if (JSON.stringify(hashes(root)) !== JSON.stringify(hashes(downloaded)))
    throw Error('Draft contains unexpected or changed assets.');
  gh(['release', 'edit', tag, '--draft=false', '--latest']);
  process.stdout.write(gh(['release', 'view', tag, '--json', 'url,isDraft,assets']));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
