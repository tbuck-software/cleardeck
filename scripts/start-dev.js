const path = require('path');
const { spawn } = require('child_process');
const { prepareDevRuntime } = require('./dev-runtime');

const root = path.resolve(__dirname, '..');
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
