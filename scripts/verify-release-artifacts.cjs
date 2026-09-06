/* eslint-disable @typescript-eslint/no-var-requires -- Release tooling. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('yaml');

function listFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}
function verifyArtifacts(root, version, macVersion = version) {
  const files = listFiles(root);
  const assets = new Map();
  for (const file of files) {
    const name = path.basename(file);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) throw Error(`Unsafe asset name: ${name}`);
    if (assets.has(name)) throw Error(`Duplicate release asset: ${name}`);
    assets.set(name, file);
  }
  const manifests = [];
  for (const [name, expected] of [
    ['latest.yml', version],
    ['latest-linux.yml', version],
    ['latest-mac.yml', macVersion],
  ]) {
    if (!assets.has(name)) throw Error(`Missing ${name}`);
    const info = parse(fs.readFileSync(assets.get(name), 'utf8'));
    if (info.version !== expected) throw Error(`Wrong version in ${name}`);
    if (
      !info.files?.length ||
      info.path !== info.files[0].url ||
      info.sha512 !== info.files[0].sha512
    )
      throw Error(`Inconsistent primary file in ${name}`);
    for (const item of info.files) {
      const file = assets.get(item.url);
      if (!file) throw Error(`Missing referenced asset: ${item.url}`);
      const bytes = fs.readFileSync(file);
      if (
        bytes.length !== item.size ||
        crypto.createHash('sha512').update(bytes).digest('base64') !== item.sha512
      )
        throw Error(`Size or SHA-512 mismatch: ${item.url}`);
    }
    manifests.push({ name, version: info.version, files: info.files.map((item) => item.url) });
  }
  if (
    !assets.has(`ClearDeck-${version}-Setup.exe`) ||
    !assets.has(`cleardeck-${version}-full.nupkg`) ||
    !assets.has('RELEASES')
  )
    throw Error('Windows installer or Squirrel artifacts missing');
  if (!files.some((f) => f.endsWith('.deb')) || !files.some((f) => f.endsWith('.rpm')))
    throw Error('Linux packages missing');
  const names = [...assets.keys()].sort();
  return {
    version,
    manifests,
    assets: names,
    hashes: Object.fromEntries(
      names.map((name) => [
        name,
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(assets.get(name)))
          .digest('hex'),
      ]),
    ),
  };
}
async function verifyFeeds(root, version, macVersion) {
  const { PrivateGitHubProvider } = require('electron-updater/out/providers/PrivateGitHubProvider');
  const { gt } = require('semver');
  const assets = listFiles(root).map((file) => ({
    name: path.basename(file),
    url: `https://api.github.com/repos/test/test/releases/assets/${encodeURIComponent(path.basename(file))}`,
  }));
  const checks = [];
  for (const [channel, expected] of [
    ['latest', version],
    ['latest-mac', macVersion],
  ]) {
    const file = listFiles(root).find((file) => path.basename(file) === `${channel}.yml`);
    const info = await PrivateGitHubProvider.prototype.getLatestVersion.call({
      getDefaultChannelName: () => channel,
      getLatestVersionInfo: async () => ({ tag_name: `v${version}`, assets }),
      configureHeaders: () => ({}),
      httpRequest: async () => fs.readFileSync(file, 'utf8'),
    });
    if (info.version !== expected) throw Error('Wrong version selected by actual private provider');
    const resolved = PrivateGitHubProvider.prototype.resolveFiles.call({}, info);
    for (const installed of ['1.7.1', '1.8.0'])
      checks.push({
        channel,
        installed,
        offered: info.version,
        updateAvailable: gt(info.version, installed),
        resolved: resolved.map((file) => file.info.url),
      });
  }
  return checks;
}
module.exports = { listFiles, verifyArtifacts, verifyFeeds };
if (require.main === module) {
  const version = require('../package.json').version,
    macVersion = process.argv[3] || version;
  const artifacts = verifyArtifacts(process.argv[2], version, macVersion);
  verifyFeeds(process.argv[2], version, macVersion)
    .then((feeds) => console.log(JSON.stringify({ artifacts, feeds }, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
