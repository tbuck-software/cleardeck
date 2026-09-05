// Runs against the original installed Windows app via its renderer debugger.
// Only visible UI controls are used; no direct update IPC or installer calls.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.join(process.env.UI_DRIVER_DIR, 'node_modules/playwright-core'));
const resultDir = path.join(process.env.RUNNER_TEMP, 'cleardeck-update-ui-result');
const dataDir = path.join(process.env.APPDATA, 'ClearDeck/data');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const password = 'Disposable-runner-test-password-2026';

async function run() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted' || process.platform !== 'win32') throw new Error('Disposable GitHub Windows runner required.');
  fs.mkdirSync(resultDir, { recursive: true });
  let browser;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222'); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  if (!browser) throw new Error('Could not attach to the original installed app.');
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(30000);
  try {
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByLabel('Passwort wiederholen', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Passwort setzen', exact: true }).click();
    await page.getByRole('button', { name: 'Schließen', exact: true }).click();
    await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
    const install = page.locator('.sidebar').getByRole('button', { name: 'Installieren', exact: true });
    await install.waitFor({ state: 'visible', timeout: 180000 });
    const configBytes = fs.readFileSync(path.join(dataDir, 'config.json'));
    const config = JSON.parse(configBytes);
    const passwordKey = crypto.pbkdf2Sync(password, config.salt, 200000, 32, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-gcm', passwordKey, Buffer.from(config.keyIv, 'base64'));
    decipher.setAuthTag(Buffer.from(config.keyTag, 'base64'));
    const dbKey = Buffer.concat([decipher.update(Buffer.from(config.encryptedKey, 'base64')), decipher.final()]);
    const before = { version: process.env.OLD_VERSION, configHash: hash(configBytes), databaseHash: hash(fs.readFileSync(path.join(dataDir, 'employee.db'))) };
    // Key is kept only in the disposable runner for post-install verification.
    fs.writeFileSync(path.join(resultDir, 'db-key'), dbKey);
    fs.writeFileSync(path.join(resultDir, 'before.json'), JSON.stringify(before));
    await page.screenshot({ path: path.join(resultDir, 'before-install.png') });
    console.log(`Original ${process.env.OLD_VERSION}: setup complete; published update downloaded; clicking sidebar Installieren.`);
    try { await install.click(); }
    catch (error) { if (!page.isClosed() && browser.isConnected()) throw error; }
    fs.writeFileSync(path.join(resultDir, 'clicked'), 'Sidebar Installieren');
  } catch (error) {
    if (!page.isClosed()) {
      await page.screenshot({ path: path.join(resultDir, 'failure.png') });
      const status = await page.locator('body').innerText();
      const updateError = status.match(/Update-Fehler:[\s\S]{0,1000}/)?.[0];
      if (updateError) console.error(updateError.replace(/gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+/g, '<REDACTED>'));
    }
    throw error;
  }
  // Let PowerShell observe the actual restart; do not close the native app.
}
run().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
