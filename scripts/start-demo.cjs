/* eslint-disable @typescript-eslint/no-var-requires -- Standalone CommonJS Forge launcher. */
const fs = require('fs');
const path = require('path');
const net = require('net');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { prepareDevRuntime } = require('./dev-runtime');
const root = path.resolve(__dirname, '..');
const lock = path.join(root, '.cache', 'cleardeck-demo-runner.lock');

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(Error(`Port ${port} ist belegt. Bitte den anderen Entwicklungsstart zuerst beenden.`)),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function start() {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    if (!Number.isInteger(pid) || pid < 1)
      throw Error('Ungültige Demo-Startdatei. Kein vorhandener Prozess wurde beendet.');
    try {
      process.kill(pid, 0);
      console.log(
        'Die Demo-Entwicklung läuft bereits. Bitte das vorhandene Demo-Fenster verwenden.',
      );
      return;
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    fs.unlinkSync(lock);
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
  }
  const cleanup = () => {
    if (fs.existsSync(lock) && fs.readFileSync(lock, 'utf8') === String(process.pid))
      fs.unlinkSync(lock);
  };
  process.once('exit', cleanup);
  try {
    const normalLock = path.join(root, '.cache', 'cleardeck-normal-runner.lock');
    if (fs.existsSync(normalLock)) {
      const pid = Number(fs.readFileSync(normalLock, 'utf8'));
      if (!Number.isInteger(pid) || pid < 1)
        throw Error('Ungültige Entwicklungs-Startdatei. Bitte den normalen Start prüfen.');
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
        alive = false;
      }
      if (alive) throw Error('Die normale Entwicklung läuft. Bitte zuerst beenden.');
    }
    // Forge shares .webpack with the normal start. Reject a concurrent normal
    // server before Forge touches that output directory; profiles are separate.
    for (const port of [3000, 9000, 3137, 9137]) await requireFreePort(port);
    const env = {
      ...process.env,
      CLEARDECK_DEV_SCENARIO: 'demo',
      CLEARDECK_DEMO_ROOT: root,
      CLEARDECK_DEMO_TOKEN: randomUUID(),
    };
    const runtime = prepareDevRuntime(root);
    if (runtime) env.ELECTRON_OVERRIDE_DIST_PATH = runtime;
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.MOCK_UPDATE_BANNER;
    const cli = path.join(
      path.dirname(require.resolve('@electron-forge/cli/package.json')),
      'dist/electron-forge-start.js',
    );
    const child = spawn(process.execPath, [cli], {
      cwd: root,
      env,
      // The wrapper handles terminal signals and asks Electron to save first.
      // Keep Unix terminal signals from reaching Forge/Electron concurrently.
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
    });
    let appPid;
    let stopping = false;
    let restarting = false;
    let pending = false;
    let timer;
    const restart = () => {
      clearTimeout(timer);
      if (stopping || restarting || !appPid || !pending) return;
      timer = setTimeout(() => {
        if (stopping || restarting || !pending) return;
        pending = false;
        restarting = true;
        console.log('Demo: Main/Preload aktualisiert; geordneter Neustart.');
        child.stdin.write('rs\n');
      }, 500);
    };
    const stop = () => {
      if (stopping) return;
      stopping = true;
      clearTimeout(timer);
      if (appPid) child.send({ type: 'demo-stop' });
      else child.kill('SIGINT');
    };
    child.on('message', (message) => {
      if (message.type === 'demo-started') {
        appPid = message.pid;
        restarting = false;
        if (stopping) child.send({ type: 'demo-stop' });
        else restart();
      } else if (message.type === 'demo-build') {
        pending = true;
        restart();
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      console.error(error.message);
      process.exitCode = 1;
      cleanup();
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      cleanup();
      process.exitCode = code ?? 0;
      process.stdin.pause();
    });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    process.once('SIGHUP', stop);
    console.log(
      'ClearDeck Demo · Forge-Entwicklung · Renderer automatisch, Main/Preload mit Neustart · Beenden mit Strg+C',
    );
  } catch (error) {
    cleanup();
    throw error;
  }
}
start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
