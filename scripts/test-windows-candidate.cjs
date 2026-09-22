/* eslint-disable @typescript-eslint/no-var-requires -- Disposable Windows release check. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { parse } = require('yaml');

if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
  process.platform !== 'win32'
)
  throw Error('Disposable GitHub-hosted Windows runner required.');

const data = path.join(process.env.APPDATA, 'ClearDeck/data');
const result = path.join(process.env.RUNNER_TEMP, 'cleardeck-candidate-result');
const password = 'Disposable-candidate-password-2026';
const oldVersion = process.env.OLD_VERSION;
const targetVersion = process.env.TARGET_VERSION || require('../package.json').version;
const fullSnapshotVersions = new Set(['2.0.0', '2.1.0', '2.2.0', '2.2.1', '2.3.0']);
const fixtureVersion = ['2.2.1', '2.3.0'].includes(oldVersion) ? '2.2.0' : oldVersion;
const updateRepositoryUrl = 'https://github.com/tbuck-software/cleardeck';
const updateFixtureToken = 'fixture-private-runtime-token';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const quote = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const { DatabaseSync } = require('node:sqlite');

const seal = (bytes, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), content };
};

const decrypt = (payload, key) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
};

const redact = (value) => String(value).replace(/(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+/g, '<REDACTED>');

const tableNames = (all) =>
  all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map((row) => row.name);

const tableColumns = (all, table) =>
  all(`PRAGMA table_info(${quote(table)})`).map((row) => row.name);

const tableRows = (all, table, columns) => {
  if (!columns.length) return [];
  const names = columns.map(quote).join(',');
  const order = columns.map(quote).join(',');
  return all(`SELECT ${names} FROM ${quote(table)} ORDER BY ${order}`);
};

// Pin each pre-upgrade table to its original columns. Migrations may add
// columns or seeded tables, but existing rows must remain equal.
function inspect(bytes, pinnedColumns = {}) {
  const file = path.join(result, 'inspection.db');
  fs.writeFileSync(file, bytes);
  const db = new DatabaseSync(file);
  const all = (sql) => db.prepare(sql).all().map((row) => ({ ...row }));
  const versionRow = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get();
  if (!versionRow) throw Error('Database has no schema version.');
  const version = String(versionRow.value);
  const snapshot = {
    employees: all('SELECT id,name,note,weeklyHours,fte,birthDate FROM employees ORDER BY id'),
    periods: all(
      'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods ORDER BY id',
    ),
    events: all(
      'SELECT id,employeeId,eventDate,type,title,details FROM employee_events ORDER BY id',
    ),
    patients: all(
      `SELECT id,name,birthDate,diagnosis,note,${Number(version) >= 14 ? 'legacyQprStatus' : 'qprStatus'} AS oldStatus FROM patients ORDER BY id`,
    ),
    visits: all(
      `SELECT id,patientId,visitDate,comment,${Number(version) >= 14 ? 'legacyQprRating' : 'qprRating'} AS oldRating FROM patient_visits ORDER BY id`,
    ),
  };
  if (oldVersion !== '1.7.1') {
    snapshot.competencies = all(
      'SELECT employeeId,competencyDefinitionId,level,approvedAt,approvedBy FROM employee_competencies ORDER BY employeeId,competencyDefinitionId',
    );
    snapshot.instructions = all(
      'SELECT id,employeeId,instructionDefinitionId,dueDate,completedAt FROM employee_instructions ORDER BY id',
    );
  }

  const recorded = {};
  if (fullSnapshotVersions.has(oldVersion)) {
    snapshot.tables = {};
    const tables = Object.keys(pinnedColumns).length
      ? Object.keys(pinnedColumns)
      : tableNames(all);
    for (const table of tables) {
      const columns = pinnedColumns[table] || tableColumns(all, table);
      if (pinnedColumns[table] && !columns.length) {
        throw Error(`Pre-upgrade table is missing after upgrade: ${table}`);
      }
      if (!columns.length) continue;
      recorded[table] = columns;
      let rows = tableRows(all, table, columns);
      // schema_version is migration metadata. User settings are compared
      // separately so a successful upgrade may advance that one value.
      if (table === 'settings') rows = rows.filter((row) => row.key !== 'schema_version');
      snapshot.tables[table] = rows;
    }
    snapshot.settings = snapshot.tables.settings || [];
  }

  assert.equal(all('PRAGMA quick_check')[0].quick_check, 'ok');
  assert.equal(all('PRAGMA foreign_key_check').length, 0);
  db.close();
  fs.unlinkSync(file);
  return { version, snapshot, columns: recorded };
}

const readBefore = () => JSON.parse(fs.readFileSync(path.join(result, 'before.json'), 'utf8'));

const writeBeforePreferences = (preferences) => {
  const before = readBefore();
  before.userPreferences = preferences;
  fs.writeFileSync(path.join(result, 'before.json'), JSON.stringify(before));
};

const preferencesMatch = (expected, actual) => {
  for (const [key, value] of Object.entries(expected || {})) {
    assert.equal(actual[key], value, `User preference changed: ${key}`);
  }
};

const versionAtLeast = (version, minimum) => {
  const current = String(version).split('.').map((part) => Number(part) || 0);
  const required = minimum.split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== required[index]) return current[index] > required[index];
  }
  return true;
};

const updateSourceFile = path.join(path.dirname(data), 'update-source.json');

const verifyUpdateSourceFile = () => {
  assert(fs.existsSync(updateSourceFile), 'The update-source.json file is missing.');
  const contents = fs.readFileSync(updateSourceFile, 'utf8');
  assert(!contents.includes(updateFixtureToken), 'The update-source.json file contains the token in plaintext.');
  assert.doesNotThrow(() => JSON.parse(contents), 'The update-source.json file is not readable JSON.');
};

const saveNativeUpdatePreferences = (page, input) => page.evaluate(async (values) => {
  // Startup checks can still be running when the password has been entered.
  // The app intentionally blocks source changes until that check finishes.
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const saved = await window.api.saveUpdatePreferences(values);
      if (Object.prototype.hasOwnProperty.call(saved, 'token')) {
        throw Error('The save API exposed a token.');
      }
      return window.api.getUpdatePreferences();
    } catch (error) {
      if (!String(error.message).includes('laufenden oder bereitliegenden Updates')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw Error('The startup update check did not release the settings form.');
}, input);

const verifyNativeUpdatePreferences = async (page) => {
  if (!versionAtLeast(targetVersion, '2.2.1')) return false;

  const available = await page.evaluate(() => Boolean(
    window.api
      && typeof window.api.getUpdatePreferences === 'function'
      && typeof window.api.saveUpdatePreferences === 'function',
  ));
  assert(available, 'The corrected app is missing its update preference API.');

  const marker = path.join(result, 'update-preferences-saved');
  if (!fs.existsSync(marker)) {
    const preferences = await saveNativeUpdatePreferences(page, {
      repositoryUrl: updateRepositoryUrl, token: updateFixtureToken,
    });
    assert.equal(preferences.repositoryUrl, updateRepositoryUrl);
    assert.equal(preferences.hasToken, true);
    assert.equal(Object.prototype.hasOwnProperty.call(preferences, 'token'), false);
    verifyUpdateSourceFile();
    fs.writeFileSync(marker, 'saved');
    return true;
  }

  const persisted = await page.evaluate(() => window.api.getUpdatePreferences());
  assert.equal(persisted.repositoryUrl, updateRepositoryUrl);
  assert.equal(persisted.hasToken, true, 'The saved update token did not survive the app restart.');
  assert.equal(Object.prototype.hasOwnProperty.call(persisted, 'token'), false);
  verifyUpdateSourceFile();

  const cleared = await saveNativeUpdatePreferences(page, {
    repositoryUrl: updateRepositoryUrl, token: '',
  });
  assert.equal(cleared.repositoryUrl, updateRepositoryUrl);
  assert.equal(cleared.hasToken, false, 'The synthetic update token could not be removed.');
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, 'token'), false);
  verifyUpdateSourceFile();
  fs.writeFileSync(path.join(result, 'update-preferences-cleared'), 'cleared');
  return true;
};

const targetSchema = () => {
  const registry = fs.readFileSync('src/main/database/migrations/index.ts', 'utf8')
    .match(/export const migrations[^=]*=\s*\[([\s\S]*?)\]/)?.[1];
  const registered = [...(registry || '').matchAll(/v(\d+)_/g)];
  if (!registered.length) throw Error('Cannot determine registered target schema.');
  return Number(registered.at(-1)[1]);
};

function verifyDisk(stage) {
  const configBytes = fs.readFileSync(path.join(data, 'config.json'));
  const config = JSON.parse(configBytes);
  const before = readBefore();
  assert.equal(hash(configBytes), before.configHash, 'Encrypted configuration changed.');
  const key = decrypt(
    Buffer.concat([
      Buffer.from(config.keyIv, 'base64'),
      Buffer.from(config.keyTag, 'base64'),
      Buffer.from(config.encryptedKey, 'base64'),
    ]),
    crypto.pbkdf2Sync(password, config.salt, 200000, 32, 'sha512'),
  );
  assert.equal(hash(key), config.keyFingerprint, 'Encrypted data key changed.');
  const after = inspect(
    decrypt(fs.readFileSync(path.join(data, 'employee.db.enc')), key),
    before.columns,
  );
  if (stage === 'before') {
    assert.equal(Number(after.version), Number(before.version));
  } else {
    assert.equal(Number(after.version), targetSchema());
  }
  assert.deepEqual(after.snapshot, before.snapshot, 'Database records or settings changed.');
  const backupDir = path.join(data, 'backups');
  const backups = (fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [])
    .filter((file) => file.startsWith('before-migration-'));
  const expectedBackups = stage === 'before'
    ? 0
    : Number(before.version) < targetSchema() ? 1 : 0;
  assert.equal(backups.length, expectedBackups, 'Unexpected automatic migration backup count.');
  return { after, backups };
}

const listFiles = (root) => {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
};

const artifactMap = (root) => {
  const files = new Map();
  for (const file of listFiles(root)) {
    const name = path.basename(file);
    if (files.has(name)) throw Error(`Duplicate candidate artifact basename: ${name}`);
    files.set(name, file);
  }
  return files;
};

const manifestInfo = (root, files) => {
  const manifestFile = files.get('latest.yml');
  if (!manifestFile) throw Error('Candidate feed is missing latest.yml.');
  const info = parse(fs.readFileSync(manifestFile, 'utf8'));
  if (info.version !== targetVersion) {
    throw Error(`Candidate feed targets ${info.version}, expected ${targetVersion}.`);
  }
  if (!info.path || !info.files?.length || info.path !== info.files[0].url) {
    throw Error('Candidate feed has no consistent primary installer.');
  }
  for (const item of info.files) {
    const name = path.basename(decodeURIComponent(item.url));
    if (!files.has(name)) throw Error(`Candidate feed references missing file: ${name}`);
  }
  const installer = files.get(path.basename(decodeURIComponent(info.path)));
  if (!installer || !installer.toLowerCase().endsWith('.exe')) {
    throw Error('Candidate feed primary file is not a Windows installer.');
  }
  return { info, installer };
};

async function run() {
  fs.mkdirSync(result, { recursive: true });
  const mode = process.argv[2];
  if (mode === 'serve') {
    const root = path.resolve(process.argv[3] || '');
    if (!fs.existsSync(root)) throw Error(`Candidate artifact directory does not exist: ${root}`);
    const files = artifactMap(root);
    const { info } = manifestInfo(root, files);
    const http = require('http');
    http.createServer((request, response) => {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice(1));
      const file = files.get(path.basename(name));
      if (!file) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.setHeader('Content-Length', fs.statSync(file).size);
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).pipe(response);
    }).listen(8135, '127.0.0.1');
    console.log(`Serving candidate ${info.version} feed on 127.0.0.1:8135.`);
    return;
  }

  if (mode === 'prepare') {
    fs.mkdirSync(data, { recursive: true });
    if (fs.existsSync(path.join(data, 'config.json'))) throw Error('Existing profile');
    const file = path.join(result, 'fixture.db');
    const db = new DatabaseSync(file);
    db.exec(fs.readFileSync(`src/main/__tests__/fixtures/v${fixtureVersion}.sql`, 'utf8'));
    if (oldVersion === '2.3.0') {
      db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('annualFteMethod','year-average')").run();
    }
    db.close();
    const bytes = fs.readFileSync(file);
    fs.unlinkSync(file);
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.randomBytes(32);
    const wrapped = seal(key, crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512'));
    const config = {
      salt,
      passwordHash: crypto.pbkdf2Sync(password, salt, 220000, 64, 'sha512').toString('hex'),
      encryptedKey: wrapped.content.toString('base64'),
      keyIv: wrapped.iv.toString('base64'),
      keyTag: wrapped.tag.toString('base64'),
      keyFingerprint: hash(key),
      configVersion: 3,
      storageMode: 'encrypted',
    };
    const configBytes = Buffer.from(JSON.stringify(config));
    fs.writeFileSync(path.join(data, 'config.json'), configBytes);
    const encrypted = seal(bytes, key);
    fs.writeFileSync(
      path.join(data, 'employee.db.enc'),
      Buffer.concat([encrypted.iv, encrypted.tag, encrypted.content]),
    );
    fs.writeFileSync(
      path.join(result, 'before.json'),
      JSON.stringify({ fixtureVersion, configHash: hash(configBytes), ...inspect(bytes) }),
    );
    return;
  }

  if (mode === 'verify-before') {
    const state = verifyDisk('before');
    fs.writeFileSync(
      path.join(result, 'baseline.json'),
      JSON.stringify({ version: oldVersion, schema: state.after.version, backups: state.backups.length }, null, 2),
    );
    console.log(`Baseline ${oldVersion} login preserved the encrypted configuration, database and settings.`);
    return;
  }

  if (mode === 'verify') {
    const before = readBefore();
    const uiState = JSON.parse(fs.readFileSync(path.join(result, 'last-ui.json'), 'utf8'));
    preferencesMatch(before.userPreferences, uiState.userPreferences);
    const state = verifyDisk('after');
    fs.writeFileSync(
      path.join(result, 'result.json'),
      JSON.stringify(
        {
          from: oldVersion,
          to: targetVersion,
          configPreserved: true,
          dataPreserved: true,
          settingsPreserved: true,
          userPreferencesPreserved: true,
          schema: state.after.version,
          automaticMigrationBackups: state.backups.length,
        },
        null,
        2,
      ),
    );
    console.log(
      `Encrypted configuration, keys, records, settings and preferences preserved; schema ${state.after.version}; ${state.backups.length} automatic migration backups.`,
    );
    return;
  }

  if (mode !== 'old-ui' && mode !== 'new-ui') {
    throw Error(`Unknown Windows candidate stage: ${mode}`);
  }

  const { chromium } = require(
    path.join(process.env.UI_DRIVER_DIR, 'node_modules/playwright-core'),
  );
  let browser;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!browser) throw Error('Cannot attach to the installed app.');
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(30000);
  const expectedVersion = mode === 'old-ui' ? oldVersion : targetVersion;
  try {
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByLabel('Passwort', { exact: true }).press('Enter');
    await page.getByLabel('Passwort', { exact: true }).waitFor({ state: 'hidden' });
    const info = await page.evaluate(async () => ({
      info: await window.api.getAppInfo(),
      data: await window.api.listEmployees(2026),
    }));
    assert.equal(info.info.version, expectedVersion);
    assert.equal(info.data.employees[0].name, 'Upgrade Test');

    const userPreferences = await page.evaluate((isBaseline) => {
      // calendarView is the app's persisted renderer preference. The value is
      // valid in every baseline covered by this check.
      if (isBaseline) localStorage.setItem('calendarView', 'week');
      return Object.fromEntries(
        Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
      );
    }, mode === 'old-ui');

    if (mode === 'old-ui') {
      writeBeforePreferences(userPreferences);
      verifyDisk('before');
      await page.screenshot({ path: path.join(result, 'before-install.png') });
      if (process.env.TEST_MODE === 'update') {
        const update = page.locator('.app-sidebar .cd-nav-update');
        await update.waitFor({ state: 'visible', timeout: 180000 });
        await update.click();
        await page.getByRole('button', { name: 'Herunterladen', exact: true }).click();
        const install = page.getByRole('button', { name: 'Installieren & neu starten', exact: true });
        await install.waitFor({ state: 'visible', timeout: 180000 });
        await page.screenshot({ path: path.join(result, 'before-update-install.png') });
        console.log('Candidate downloaded; clicking the original visible install control.');
        try {
          await install.click();
        } catch (error) {
          if (!page.isClosed() && browser.isConnected()) throw error;
        }
        fs.writeFileSync(path.join(result, 'original-install-clicked'), 'Original installed sidebar');
      }
    } else {
      const patients = await page.evaluate(() => window.api.listPatients());
      assert.equal(patients[0].name, 'Upgrade Pflege');
      await verifyNativeUpdatePreferences(page);
      fs.writeFileSync(
        path.join(result, 'last-ui.json'),
        JSON.stringify({ version: info.info.version, userPreferences }),
      );
      const annualMethod = oldVersion === '2.3.0' ? 'year-average' : 'month-end-average';
      assert.equal(info.data.annualSummary.method, annualMethod);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.screenshot({ path: path.join(result, 'after-unlock.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Team', exact: true }).click();
      await page.getByRole('heading', { name: 'Team', exact: true }).waitFor();
      await page.screenshot({ path: path.join(result, 'team.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
      const annualSelect = page.getByLabel('Berechnung der Jahres-VZÄ', { exact: true });
      await annualSelect.waitFor();
      assert.equal(await annualSelect.inputValue(), annualMethod);
      await page.screenshot({ path: path.join(result, 'einstellungen.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Sperren', exact: true }).click();
      await page.getByLabel('Passwort', { exact: true }).waitFor();
    }
  } catch (error) {
    if (!page.isClosed()) {
      try {
        await page.screenshot({ path: path.join(result, 'failure.png') });
      } catch {
        // The application may have closed while the installer was starting.
      }
    }
    throw Error(redact(error instanceof Error ? error.message : error));
  }
  // Disconnect the driver without closing the application being tested.
  process.exit(0);
}

run().catch((error) => {
  console.error(redact(error.message || error));
  process.exit(1);
});
