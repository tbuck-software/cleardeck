/* eslint-disable @typescript-eslint/no-var-requires -- Release tooling. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { verifyArtifacts, listFiles } = require('./verify-release-artifacts.cjs');
const version = require('../package.json').version;
const tag = `v${version}`;
if (process.env.GITHUB_REF !== `refs/tags/${tag}`)
  throw Error('Publishing requires the matching version tag.');
const dir = path.resolve(process.argv[2]);
verifyArtifacts(dir, version, '1.8.0');
const notes = path.resolve('release-notes.md');
execFileSync(process.execPath, ['scripts/release-notes.js', notes]);
fs.appendFileSync(
  notes,
  '\nPlattformen: Version 2.0.0 erscheint für Windows und Linux. Für macOS enthält dieser Release ausschließlich den unveränderten bisherigen Updatefeed und das ZIP der Version 1.8.0, damit bestehende Mac-Clients weiterhin denselben Feed auflösen können. Es gibt hier keine neue Mac-Version; der bekannte Signaturfehler älterer Mac-Installationen ist damit nicht behoben.\n',
);
const gh = (args) => execFileSync('gh', args, { stdio: 'pipe', encoding: 'utf8' });
// Never overwrite an existing published release or expose a partially uploaded one.
let existing;
try {
  existing = JSON.parse(gh(['release', 'view', tag, '--json', 'isDraft']));
} catch (error) {
  if (!String(error.stderr).includes('release not found')) throw error;
}
if (existing && !existing.isDraft) throw Error('Release already published; refusing mutation.');
if (!existing)
  gh(['release', 'create', tag, '--verify-tag', '--draft', '--title', tag, '--notes-file', notes]);
else gh(['release', 'edit', tag, '--notes-file', notes]);
for (const file of listFiles(dir)) gh(['release', 'upload', tag, file, '--clobber']);
// Re-download the draft and verify uploaded bytes before making it discoverable.
const downloaded = fs.mkdtempSync(
  path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), 'cleardeck-upload-check-'),
);
gh(['release', 'download', tag, '--dir', downloaded]);
verifyArtifacts(downloaded, version, '1.8.0');
const expected = verifyArtifacts(dir, version, '1.8.0').hashes;
if (
  JSON.stringify(expected) !== JSON.stringify(verifyArtifacts(downloaded, version, '1.8.0').hashes)
)
  throw Error('Draft contains unexpected or changed assets');
gh(['release', 'edit', tag, '--draft=false', '--latest']);
console.log(gh(['release', 'view', tag, '--json', 'url,isDraft,assets']));
