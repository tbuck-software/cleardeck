# Run only on a disposable GitHub-hosted Windows runner, never on user data.
param([ValidateSet('1.7.1', '1.7.2')][string]$OldVersion = '1.7.1')
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable GitHub-hosted Windows runner required.' }
$env:OLD_VERSION = $OldVersion
$downloadDir = Join-Path $env:RUNNER_TEMP 'cleardeck-ui-installers'
$resultDir = Join-Path $env:RUNNER_TEMP 'cleardeck-update-ui-result'
$installRoot = Join-Path $env:LOCALAPPDATA 'cleardeck'
$dataDir = Join-Path $env:APPDATA 'ClearDeck/data'
if ((Test-Path $installRoot) -or (Test-Path $dataDir)) { throw 'Empty runner profile required.' }
New-Item -ItemType Directory -Path $downloadDir | Out-Null
# The new installer is deliberately not downloaded or launched by this test.
gh release download "v$OldVersion" --repo $env:GITHUB_REPOSITORY --pattern '*.exe' --dir $downloadDir
if ($LASTEXITCODE -ne 0) { throw 'Old installer download failed.' }
$installer = Get-ChildItem $downloadDir -Filter '*.exe' | Select-Object -First 1
$process = Start-Process $installer.FullName -ArgumentList '--silent' -PassThru
if (!$process.WaitForExit(120000) -or $process.ExitCode -ne 0) { throw 'Old installation failed.' }
$oldExe = Join-Path $installRoot "app-$OldVersion/cleardeck.exe"
if (!(Test-Path $oldExe)) { throw 'Old installed executable missing.' }
Get-Process cleardeck -ErrorAction SilentlyContinue | Stop-Process -Force
$env:UI_DRIVER_DIR = Join-Path $env:RUNNER_TEMP 'cleardeck-ui-driver'
npm install --prefix $env:UI_DRIVER_DIR --no-audit --no-fund --ignore-scripts playwright-core@1.56.1
if ($LASTEXITCODE -ne 0) { throw 'UI driver installation failed.' }
Start-Process $oldExe -ArgumentList '--remote-debugging-port=9222' -RedirectStandardOutput (Join-Path $env:RUNNER_TEMP 'cleardeck-app.stdout.log') -RedirectStandardError (Join-Path $env:RUNNER_TEMP 'cleardeck-app.stderr.log')
node ./scripts/test-windows-update-ui.cjs
if ($LASTEXITCODE -ne 0) { throw 'Original application UI update failed.' }
$newExe = Join-Path $installRoot 'app-1.8.0/cleardeck.exe'
$deadline = (Get-Date).AddSeconds(180)
do {
    $running = Get-Process cleardeck -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $newExe }
    if ($running) { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if (!$running) { throw 'UI click did not produce a restarted 1.8.0 process.' }
if ((Get-Item $newExe).VersionInfo.ProductVersion -notlike '1.8.0*') { throw 'Restarted executable has incorrect version.' }
$env:UI_RESULT_DIR = $resultDir
@'
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.env.UI_RESULT_DIR, data = path.join(process.env.APPDATA, 'ClearDeck/data');
const before = JSON.parse(fs.readFileSync(path.join(dir, 'before.json')));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (hash(fs.readFileSync(path.join(data, 'config.json'))) !== before.configHash) throw new Error('Config changed');
const bytes = fs.readFileSync(path.join(data, 'employee.db.enc'));
const decipher = crypto.createDecipheriv('aes-256-gcm', fs.readFileSync(path.join(dir, 'db-key')), bytes.subarray(0,12));
decipher.setAuthTag(bytes.subarray(12,28));
const plain = Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]);
if (hash(plain) !== before.databaseHash) throw new Error('Database content changed');
fs.unlinkSync(path.join(dir,'db-key'));
fs.writeFileSync(path.join(dir,'result.json'), JSON.stringify({from:before.version,to:'1.8.0',originalSidebarClicked:true,restarted:true,configPreserved:true,databasePreserved:true}));
'@ | node
if ($LASTEXITCODE -ne 0) { throw 'Data preservation check failed.' }
Write-Output "PASS: original $OldVersion UI -> published feed -> download -> sidebar Installieren -> restarted 1.8.0; configuration and decrypted database unchanged."
Get-Process cleardeck -ErrorAction SilentlyContinue | Stop-Process -Force
