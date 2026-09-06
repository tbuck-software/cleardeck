/* eslint-disable @typescript-eslint/no-var-requires -- Standalone CommonJS Electron launcher. */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
if (app.isPackaged) throw Error('Demo launcher is development-only');
const container = path.join(root, '.cache', 'cleardeck-demo-profile');
const marker = path.join(container, 'demo-profile.json');
if (!fs.existsSync(marker) && fs.existsSync(container) && fs.readdirSync(container).length)
  throw Error('Refusing to seed an existing unmarked profile');
fs.mkdirSync(container, { recursive: true });
app.setPath('appData', container);
app.setPath('userData', container);
const paths = require('../src/main/appPaths.ts');
paths.configureUserDataPath();
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.env.CLEARDECK_DEMO_DEBUG === '1')
    app.commandLine.appendSwitch('remote-debugging-port', '19375');
  const conn = require('../src/main/database/connection.ts');
  const config = require('../src/main/crypto.ts');
  if (!fs.existsSync(marker)) {
    conn.setStorageMode('plain');
    conn.openDatabase({ create: true });
    require('./demo-data.cjs')(conn.getDb());
    config.writeConfig({ storageMode: 'plain', configVersion: 3 });
    const counts = Object.fromEntries(
      [
        'employees',
        'patients',
        'employment_periods',
        'employment_terms',
        'employee_instructions',
        'employee_competencies',
        'patient_visits',
        'audits',
      ].map((table) => [table, conn.getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]),
    );
    fs.writeFileSync(
      marker,
      JSON.stringify(
        { kind: 'cleardeck-synthetic-demo', createdAt: new Date().toISOString(), counts },
        null,
        2,
      ),
    );
    conn.persistEncryptedDb();
  } else if (JSON.parse(fs.readFileSync(marker, 'utf8')).kind !== 'cleardeck-synthetic-demo')
    throw Error('Invalid demo profile marker');
  global.MAIN_WINDOW_WEBPACK_ENTRY = `file://${path.join(root, '.cache', 'cleardeck-demo-runtime', 'index.html')}`;
  global.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = path.join(
    root,
    '.cache',
    'cleardeck-demo-runtime',
    'preload.js',
  );
  app.getVersion = () => require('../package.json').version;
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('did-finish-load', () => {
      window.show();
      window.focus();
      console.log('DEMO_READY', paths.getDataDir());
    });
  });
  app.on('second-instance', () => {
    const w = require('electron').BrowserWindow.getAllWindows()[0];
    if (w) {
      w.restore();
      w.show();
      w.focus();
    }
  });
  require('../src/index.ts');
  app.setName('ClearDeck Demo · synthetische Daten');
}
