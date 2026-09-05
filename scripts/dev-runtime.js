const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Forge still watches and runs the real source. Only its macOS Electron host
// gets a separate bundle identity, so it has its own Dock entry beside ClearDeck.
function prepareDevRuntime(root) {
  if (process.platform !== 'darwin') return undefined;
  const runtime = path.join(root, '.dev-runtime');
  const bundle = path.join(runtime, 'Electron.app');
  const source = path.join(root, 'node_modules/electron/dist/Electron.app');
  const icon = path.join(root, 'assets/icon.icns');
  const version = require(path.join(root, 'node_modules/electron/package.json')).version;
  const stamp = crypto.createHash('sha256').update(version).update(fs.readFileSync(__filename)).update(fs.readFileSync(icon)).digest('hex');
  const stampPath = path.join(runtime, 'stamp');
  if (fs.existsSync(bundle) && fs.existsSync(stampPath) && fs.readFileSync(stampPath, 'utf8') === stamp) return runtime;
  fs.mkdirSync(runtime, { recursive: true });
  fs.rmSync(bundle, { recursive: true, force: true });
  fs.cpSync(source, bundle, { recursive: true, verbatimSymlinks: true });
  const plist = path.join(bundle, 'Contents/Info.plist');
  for (const [key, value] of Object.entries({ CFBundleIdentifier: 'com.electron.cleardeck.dev', CFBundleName: 'ClearDeck Dev', CFBundleDisplayName: 'ClearDeck Dev' })) {
    // Delete/add supports both present and absent keys in different Electron versions.
    try { execFileSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plist], { stdio: 'ignore' }); } catch { /* absent key */ }
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]);
  }
  fs.copyFileSync(icon, path.join(bundle, 'Contents/Resources/electron.icns'));
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'pipe' });
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'pipe' });
  fs.writeFileSync(stampPath, stamp);
  return runtime;
}

module.exports = { prepareDevRuntime };
