const fs = require('fs');
const { valid, lte, rcompare } = require('semver');

function readReleaseHistory(changelogPath) {
  if (!fs.existsSync(changelogPath)) return [];
  return fs.readFileSync(changelogPath, 'utf8').split(/^## /m).slice(1).flatMap((section) => {
    const newline = section.indexOf('\n');
    const heading = section.slice(0, newline === -1 ? undefined : newline).trim();
    const match = heading.match(/^\[([^\]]+)\](?:\s|$)/);
    const version = match?.[1];
    const note = newline === -1 ? '' : section.slice(newline + 1).trim();
    return version && note ? [{ version, note }] : [];
  });
}

function getReleaseNotes(changelogPath, version) {
  return readReleaseHistory(changelogPath).find((entry) => entry.version === version)?.note;
}

// Ship the full released history. The client selects only versions newer than
// its installed version, so skipping several releases still shows every change.
function getReleaseHistory(changelogPath, version) {
  return readReleaseHistory(changelogPath).filter((entry) => valid(entry.version) && lte(entry.version, version))
    .sort((a, b) => rcompare(a.version, b.version));
}

function prepareReleaseNotes(changelogPath, version) {
  if (!valid(version)) throw new Error(`Invalid release version: ${version}`);
  if (getReleaseNotes(changelogPath, version)) return;
  if (!getReleaseNotes(changelogPath, 'Unreleased')) throw new Error('Add release changes to CHANGELOG.md [Unreleased] before releasing.');
  const text = fs.readFileSync(changelogPath, 'utf8');
  fs.writeFileSync(changelogPath, text.replace(/^## \[Unreleased\][^\n]*\n/m, `## [Unreleased]\n\n## [${version}]\n`));
}

module.exports = { getReleaseNotes, getReleaseHistory };

if (require.main === module) {
  const path = require('path');
  const version = require('../package.json').version;
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (process.argv[2] === '--prepare') {
    prepareReleaseNotes(changelogPath, version);
  } else {
    const notes = getReleaseNotes(changelogPath, version);
    if (!notes) throw new Error(`Missing CHANGELOG.md section for ${version}`);
    fs.writeFileSync(process.argv[2], notes + '\n');
  }
}
