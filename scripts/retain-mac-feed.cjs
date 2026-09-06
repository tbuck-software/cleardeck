/* eslint-disable @typescript-eslint/no-var-requires -- Release tooling. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { parse } = require('yaml');
if (require('../package.json').version !== '2.1.0')
  throw Error('Review the platform plan before a later release.');
const dir = path.resolve(process.argv[2]);
fs.mkdirSync(dir, { recursive: true });
const download = (name) =>
  execFileSync('gh', ['release', 'download', 'v1.8.0', '--pattern', name, '--dir', dir], {
    stdio: 'inherit',
  });
download('latest-mac.yml');
const info = parse(fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8'));
if (info.version !== '1.8.0' || !info.files?.length) throw Error('Unexpected old Mac feed');
for (const item of info.files) {
  if (!/^[A-Za-z0-9._-]+\.zip$/.test(item.url)) throw Error('Unsafe Mac asset name');
  download(item.url);
  const bytes = fs.readFileSync(path.join(dir, item.url));
  if (
    bytes.length !== item.size ||
    crypto.createHash('sha512').update(bytes).digest('base64') !== item.sha512
  )
    throw Error('Legacy Mac asset does not match its original manifest');
}
console.log('Retained original Mac 1.8.0 manifest and matching ZIP bytes. No new Mac version.');
