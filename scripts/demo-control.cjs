/* eslint-disable @typescript-eslint/no-var-requires -- Development-only process control. */
const fs = require('fs');
const path = require('path');
const net = require('net');
const controlPath = () =>
  path.join(process.env.CLEARDECK_DEMO_ROOT, '.cache', 'cleardeck-demo-control.json');

function serve(app, shutdown) {
  const token = process.env.CLEARDECK_DEMO_TOKEN;
  if (!token) throw Error('Demo must be started through npm run demo');
  let stopping = false;
  const server = net.createServer((socket) => {
    socket.setTimeout(2000, () => socket.destroy());
    let data = '';
    socket.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024) return socket.destroy();
      if (!data.includes('\n')) return;
      if (data.trim() !== token || stopping) return socket.destroy();
      stopping = true;
      void shutdown()
        .then(() => {
          console.log('DEMO_STOPPED: Daten gespeichert, Datenbank geschlossen.');
          socket.end('ok\n');
          server.close();
          fs.rmSync(controlPath(), { force: true });
          setImmediate(() => app.exit(0));
        })
        .catch((error) => {
          stopping = false;
          socket.end('error\n');
          console.error('Demo konnte nicht sauber beendet werden:', error);
        });
    });
    socket.on('error', () => {
      /* Caller may exit while the app is stopping. */
    });
  });
  server.listen(0, '127.0.0.1', () => {
    fs.writeFileSync(
      controlPath(),
      JSON.stringify({ pid: process.pid, port: server.address().port }),
    );
  });
  app.once('will-quit', () => {
    server.close();
    fs.rmSync(controlPath(), { force: true });
  });
}

async function stop(pid) {
  let info;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      info = JSON.parse(fs.readFileSync(controlPath(), 'utf8'));
    } catch {
      /* app still starting */
    }
    if (info?.pid === pid) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (info?.pid !== pid) throw Error('Demo ist noch nicht bereit; Neustart nicht erzwungen.');
  await new Promise((resolve, reject) => {
    let answered = false;
    const socket = net.connect(info.port, '127.0.0.1', () =>
      socket.write(`${process.env.CLEARDECK_DEMO_TOKEN}\n`),
    );
    socket.setTimeout(10000, () =>
      socket.destroy(Error('Demo-Speicherung hat noch nicht geantwortet.')),
    );
    socket.once('data', (data) => {
      answered = true;
      if (data.toString().trim() === 'ok') resolve();
      else reject(Error('Demo-Speicherung fehlgeschlagen.'));
      socket.end();
    });
    socket.once('error', reject);
    socket.once('close', () => {
      if (!answered) reject(Error('Demo-Steuerverbindung wurde ohne Bestätigung geschlossen.'));
    });
  });
}
module.exports = { serve, stop };
