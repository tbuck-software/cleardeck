/* eslint-disable @typescript-eslint/no-var-requires -- Standalone CommonJS dev launcher. */
// Demo app plus a local ClearDeck server (Postgres in Docker) for trying the server flows.
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const CONTAINER = 'cleardeck-dev-postgres';
const PG_PORT = 55432;
const SERVER_PORT = 8787;
const DATABASE_URL = `postgresql://cleardeck:cleardeck-dev@127.0.0.1:${PG_PORT}/cleardeck`;
const PASSWORD = 'cleardeck-dev-passwort';
const ACCOUNTS = [
  ['dev-editor', 'editor'],
  ['dev-reader', 'reader'],
];

const docker = (args, options = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', ...options });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startPostgres(reset) {
  if (docker(['info']).status !== 0) throw Error('Docker läuft nicht. Bitte Docker starten.');
  if (reset) {
    docker(['rm', '-f', CONTAINER]);
    docker(['volume', 'rm', CONTAINER]);
  }
  const exists = docker(['container', 'inspect', CONTAINER]).status === 0;
  const result = exists
    ? docker(['start', CONTAINER])
    : docker([
        'run', '-d', '--name', CONTAINER,
        '-e', 'POSTGRES_DB=cleardeck', '-e', 'POSTGRES_USER=cleardeck',
        '-e', 'POSTGRES_PASSWORD=cleardeck-dev',
        '-p', `127.0.0.1:${PG_PORT}:5432`,
        '-v', `${CONTAINER}:/var/lib/postgresql/data`,
        'postgres:16-alpine',
      ]);
  if (result.status !== 0) throw Error(result.stderr.trim() || 'Postgres-Container startet nicht.');

  // The image restarts Postgres once after initialising, so retry the first real query.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (setAccount(...ACCOUNTS[0]).status === 0) return;
    await wait(1000);
  }
  throw Error('Postgres ist nach 60 Sekunden nicht erreichbar.');
}

const setAccount = (username, role) =>
  spawnSync(process.execPath, ['src/account.mjs', 'set', username, role], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, DATABASE_URL },
    input: PASSWORD,
    encoding: 'utf8',
  });

async function main() {
  const reset = process.argv.includes('--reset');
  console.log(reset ? 'Setze Dev-Server zurück …' : 'Starte Dev-Server …');
  await startPostgres(reset);
  for (const [username, role] of ACCOUNTS.slice(1)) {
    const result = setAccount(username, role);
    if (result.status !== 0) throw Error(result.stderr.trim() || `Konto ${username} fehlt.`);
  }

  const server = spawn(process.execPath, ['src/main.mjs'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, DATABASE_URL, HOST: '127.0.0.1', PORT: String(SERVER_PORT) },
    stdio: 'inherit',
  });

  console.log(`
ClearDeck-Dev-Server
  Serveradresse  http://127.0.0.1:${SERVER_PORT}
  Konten         dev-editor (bearbeiten), dev-reader (nur lesen)
  Passwort       ${PASSWORD}
  Leerer Server  make dev-server-reset
`);

  const app = spawn(process.execPath, [path.join(root, 'scripts/start-demo.cjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  // Ctrl+C reaches the demo launcher directly; shut the server down once the app is gone.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => undefined);
  app.once('exit', (code) => {
    server.kill('SIGTERM');
    docker(['stop', CONTAINER]);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
