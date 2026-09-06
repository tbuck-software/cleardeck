/* eslint-disable @typescript-eslint/no-var-requires -- Disposable Windows release check. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
  process.platform !== 'win32'
)
  throw Error('Disposable GitHub-hosted Windows runner required.');
const data = path.join(process.env.APPDATA, 'ClearDeck/data');
const result = path.join(process.env.RUNNER_TEMP, 'cleardeck-candidate-result');
const password = 'Disposable-candidate-password-2026';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const { DatabaseSync } = require('node:sqlite');
const seal = (bytes, key) => {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), content };
};
const decrypt = (payload, key) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
};
function inspect(bytes) {
  const file = path.join(result, 'inspection.db');
  fs.writeFileSync(file, bytes);
  const db = new DatabaseSync(file);
  // Match the plain objects reloaded from before.json without changing values.
  const all = (sql) => db.prepare(sql).all().map((row) => ({ ...row }));
  const version = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get().value;
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
  if (process.env.OLD_VERSION === '1.8.0') {
    snapshot.competencies = all(
      'SELECT employeeId,competencyDefinitionId,level,approvedAt,approvedBy FROM employee_competencies ORDER BY employeeId,competencyDefinitionId',
    );
    snapshot.instructions = all(
      'SELECT id,employeeId,instructionDefinitionId,dueDate,completedAt FROM employee_instructions ORDER BY id',
    );
  }
  assert.equal(all('PRAGMA quick_check')[0].quick_check, 'ok');
  assert.equal(all('PRAGMA foreign_key_check').length, 0);
  db.close();
  fs.unlinkSync(file);
  return { version, snapshot };
}
async function run() {
  fs.mkdirSync(result, { recursive: true });
  const mode = process.argv[2];
  if (mode === 'serve') {
    const { listFiles } = require('./verify-release-artifacts.cjs');
    const files = new Map(listFiles(process.argv[3]).map((file) => [path.basename(file), file]));
    require('http')
      .createServer((req, res) => {
        const file = files.get(
          decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)),
        );
        if (!file) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.setHeader('Content-Length', fs.statSync(file).size);
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(file).pipe(res);
      })
      .listen(8135, '127.0.0.1');
    return;
  }
  if (mode === 'prepare') {
    fs.mkdirSync(data, { recursive: true });
    if (fs.existsSync(path.join(data, 'config.json'))) throw Error('Existing profile');
    const file = path.join(result, 'fixture.db');
    const db = new DatabaseSync(file);
    db.exec(fs.readFileSync(`src/main/__tests__/fixtures/v${process.env.OLD_VERSION}.sql`, 'utf8'));
    db.close();
    const bytes = fs.readFileSync(file);
    fs.unlinkSync(file);
    const salt = crypto.randomBytes(16).toString('hex'),
      key = crypto.randomBytes(32);
    const wrapped = seal(key, crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512'));
    const config = {
      salt,
      passwordHash: crypto.pbkdf2Sync(password, salt, 220000, 64, 'sha512').toString('hex'),
      encryptedKey: wrapped.content.toString('base64'),
      keyIv: wrapped.iv.toString('base64'),
      keyTag: wrapped.tag.toString('base64'),
      keyFingerprint: hash(key),
      configVersion: process.env.OLD_VERSION === '1.7.1' ? 2 : 3,
      ...(process.env.OLD_VERSION === '1.8.0' ? { storageMode: 'encrypted' } : {}),
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
      JSON.stringify({ configHash: hash(configBytes), ...inspect(bytes) }),
    );
    return;
  }
  if (mode === 'verify') {
    const configBytes = fs.readFileSync(path.join(data, 'config.json')),
      config = JSON.parse(configBytes);
    const before = JSON.parse(fs.readFileSync(path.join(result, 'before.json')));
    assert.equal(hash(configBytes), before.configHash);
    const key = decrypt(
      Buffer.concat([
        Buffer.from(config.keyIv, 'base64'),
        Buffer.from(config.keyTag, 'base64'),
        Buffer.from(config.encryptedKey, 'base64'),
      ]),
      crypto.pbkdf2Sync(password, config.salt, 200000, 32, 'sha512'),
    );
    const after = inspect(decrypt(fs.readFileSync(path.join(data, 'employee.db.enc')), key));
    assert.equal(after.version, '21');
    assert.deepEqual(after.snapshot, before.snapshot);
    const backups = fs
      .readdirSync(path.join(data, 'backups'))
      .filter((f) => f.startsWith('before-migration-'));
    assert.equal(backups.length, 1);
    fs.writeFileSync(
      path.join(result, 'result.json'),
      JSON.stringify(
        {
          from: process.env.OLD_VERSION,
          to: require('../package.json').version,
          configPreserved: true,
          dataPreserved: true,
          schema: after.version,
          automaticMigrationBackups: backups.length,
        },
        null,
        2,
      ),
    );
    console.log(
      'Original configuration, keys, records and histories preserved; schema21; exactly one automatic migration backup.',
    );
    return;
  }
  const { chromium } = require(
    path.join(process.env.UI_DRIVER_DIR, 'node_modules/playwright-core'),
  );
  let browser;
  for (let i = 0; i < 60; i++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!browser) throw Error('Cannot attach to installed app');
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(30000);
  try {
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByLabel('Passwort', { exact: true }).press('Enter');
    await page.getByLabel('Passwort', { exact: true }).waitFor({ state: 'hidden' });
    const info = await page.evaluate(async () => ({
      info: await window.api.getAppInfo(),
      data: await window.api.listEmployees(2026),
    }));
    assert.equal(
      info.info.version,
      mode === 'old-ui' ? process.env.OLD_VERSION : require('../package.json').version,
    );
    assert.equal(info.data.employees[0].name, 'Upgrade Test');
    console.log(`Unlocked installed ${info.info.version}; existing employee loaded.`);
    if (mode === 'old-ui') {
      const sidebar = page.locator('.sidebar-content');
      if ((await sidebar.count()) && !(await sidebar.isVisible()))
        await page.getByRole('button', { name: 'Menü umschalten', exact: true }).click();
      const install = page
        .locator('.sidebar')
        .getByRole('button', { name: 'Installieren', exact: true });
      await install.waitFor({ state: 'visible', timeout: 180000 });
      await page.screenshot({ path: path.join(result, 'before-install.png') });
      console.log('Candidate downloaded; clicking the original sidebar Installieren button.');
      try {
        await install.click();
      } catch (error) {
        if (!page.isClosed() && browser.isConnected()) throw error;
      }
      fs.writeFileSync(path.join(result, 'original-install-clicked'), 'Original installed sidebar');
    } else {
      const patients = await page.evaluate(() => window.api.listPatients());
      assert.equal(patients[0].name, 'Upgrade Pflege');
      await page.screenshot({ path: path.join(result, 'after-unlock.png') });
      await page.getByRole('button', { name: 'Sperren', exact: true }).click();
      await page.getByLabel('Passwort', { exact: true }).waitFor();
    }
  } catch (error) {
    if (!page.isClosed()) await page.screenshot({ path: path.join(result, 'failure.png') });
    throw error;
  }
  // Disconnect the driver without closing the application being tested.
  process.exit(0);
}
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
