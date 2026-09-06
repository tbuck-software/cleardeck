const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { prepareDevRuntime } = require('./dev-runtime');

const root = path.resolve(__dirname, '..');
const normalLock = path.join(root, '.cache', 'cleardeck-normal-runner.lock');
fs.mkdirSync(path.dirname(normalLock), { recursive: true });
try {
  fs.writeFileSync(normalLock, String(process.pid), { flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const pid = Number(fs.readFileSync(normalLock, 'utf8'));
  if (!Number.isInteger(pid) || pid < 1) throw Error('Ungültige Entwicklungs-Startdatei.');
  try {
    process.kill(pid, 0);
    console.error('Die normale Entwicklung läuft bereits. Bitte zuerst beenden.');
    process.exit(1);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  fs.unlinkSync(normalLock);
  fs.writeFileSync(normalLock, String(process.pid), { flag: 'wx' });
}
process.once('exit', () => {
  if (fs.existsSync(normalLock) && fs.readFileSync(normalLock, 'utf8') === String(process.pid))
    fs.unlinkSync(normalLock);
});
// Both Forge configurations write .webpack. Reject concurrent starts before
// Forge removes that directory, while keeping the profiles independent.
const demoLock = path.join(root, '.cache', 'cleardeck-demo-runner.lock');
if (fs.existsSync(demoLock)) {
  const pid = Number(fs.readFileSync(demoLock, 'utf8'));
  if (!Number.isInteger(pid) || pid < 1) {
    console.error('Ungültige Demo-Startdatei. Bitte den Demo-Start prüfen.');
    process.exit(1);
  }
  try {
    process.kill(pid, 0);
    console.error('Die Demo-Entwicklung läuft. Bitte zuerst im Demo-Terminal mit Strg+C beenden.');
    process.exit(1);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
const updates = process.argv.includes('--updates');
const runtime = prepareDevRuntime(root);
const env = { ...process.env };
if (runtime) env.ELECTRON_OVERRIDE_DIST_PATH = runtime;
// Ohne Update-Server gaebe es in der Entwicklung nie ein Banner zu sehen, also
// wird es immer simuliert. Nur --updates wechselt zusaetzlich auf ein eigenes
// Datenprofil, damit Update-Tests die eigenen Entwicklungsdaten nicht anfassen.
env.MOCK_UPDATE_BANNER = '1';
if (updates) {
  env.CLEARDECK_DEV_SCENARIO = 'updates';
}
const cli = path.join(path.dirname(require.resolve('@electron-forge/cli/package.json')), 'dist/electron-forge.js');
console.log(`ClearDeck Dev · ${updates ? 'Update-Beispiel mit eigenem Testprofil' : 'eigenes Entwicklungsprofil'}`);
const child = spawn(process.execPath, [cli, 'start', ...process.argv.slice(2).filter((arg) => arg !== '--updates')], { cwd: root, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code ?? 0; });
