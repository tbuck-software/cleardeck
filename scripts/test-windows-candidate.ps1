# Never run against an existing user's profile.
param([ValidateSet('1.7.1','1.8.0','2.0.0','2.1.0')][string]$OldVersion, [string]$Artifacts)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable GitHub-hosted Windows runner required.' }
$env:OLD_VERSION = $OldVersion
$version = (Get-Content package.json | ConvertFrom-Json).version
function Close-CandidateWindow([string]$Executable) {
  $window = $null
  for ($i=0; $i -lt 60; $i++) {
    $window = Get-Process cleardeck -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -eq $Executable -and $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    if ($window) { break }
    Start-Sleep -Milliseconds 500
  }
  if (!$window) { throw 'Candidate process did not present a main window.' }
  Write-Output "Closing ready candidate window, process $($window.Id)."
  if (!$window.CloseMainWindow()) { throw 'Candidate main window rejected the close request.' }
  if (!$window.WaitForExit(30000)) { throw 'Candidate did not close cleanly.' }
  for ($i=0; $i -lt 60; $i++) {
    if (!(Get-Process cleardeck -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 500
  }
  throw 'Candidate child processes did not exit after the main window closed.'
}
$root = Join-Path $env:LOCALAPPDATA 'cleardeck'
$data = Join-Path $env:APPDATA 'ClearDeck/data'
if ((Test-Path $root) -or (Test-Path $data)) { throw 'Empty runner profile required.' }
$download = Join-Path $env:RUNNER_TEMP 'cleardeck-original-installer'
New-Item -ItemType Directory -Path $download | Out-Null
gh release download "v$OldVersion" --pattern '*.exe' --dir $download
if ($LASTEXITCODE -ne 0) { throw 'Original installer download failed.' }
$oldInstaller = Get-ChildItem $download -Filter '*.exe' | Select-Object -First 1
$p = Start-Process $oldInstaller.FullName -ArgumentList '--silent' -PassThru
if (!$p.WaitForExit(120000) -or $p.ExitCode -ne 0) { throw 'Original installation failed.' }
Get-Process cleardeck -ErrorAction SilentlyContinue | Stop-Process -Force
node scripts/test-windows-candidate.cjs prepare
if ($LASTEXITCODE -ne 0) { throw 'Synthetic original profile preparation failed.' }
$env:UI_DRIVER_DIR = Join-Path $env:RUNNER_TEMP 'cleardeck-ui-driver'
npm install --prefix $env:UI_DRIVER_DIR --no-audit --no-fund --ignore-scripts playwright-core@1.56.1
if ($LASTEXITCODE -ne 0) { throw 'UI driver install failed.' }
$env:UPDATE_FEED_URL = 'http://127.0.0.1:8135/'
$server = Start-Process node -ArgumentList 'scripts/test-windows-candidate.cjs','serve', $Artifacts -PassThru
try {
  $ready = $false
  for ($i=0; $i -lt 30; $i++) {
    try { Invoke-WebRequest "${env:UPDATE_FEED_URL}latest.yml" -UseBasicParsing | Out-Null; $ready=$true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (!$ready) { throw 'Candidate feed did not start.' }
  $oldExe = Join-Path $root "app-$OldVersion/cleardeck.exe"
  Start-Process $oldExe -ArgumentList '--remote-debugging-port=9222'
  node scripts/test-windows-candidate.cjs old-ui
  if ($LASTEXITCODE -ne 0) { throw 'Original UI download/install failed.' }
  $newExe = Join-Path $root "app-$version/cleardeck.exe"
  $running = $null
  for ($i=0; $i -lt 90; $i++) {
    $running = Get-Process cleardeck -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $newExe }
    if ($running) { break }
    Start-Sleep -Seconds 2
  }
  if (!$running) { throw 'Installer did not automatically restart the new version.' }
  if ((Get-Item $newExe).VersionInfo.ProductVersion -notlike "$version*") { throw 'Wrong installed product version.' }
  Write-Output "Installer automatically restarted installed version $version."
  # Automatic restart is established above. Relaunch solely to attach the test
  # driver; no configuration/database conversion is performed by the harness.
  Close-CandidateWindow $newExe
  for ($attempt=0; $attempt -lt 2; $attempt++) {
    Write-Output "Checking installed candidate unlock and preserved data, start $($attempt + 1) of 2."
    $p = Start-Process $newExe -ArgumentList '--remote-debugging-port=9222' -PassThru
    node scripts/test-windows-candidate.cjs new-ui
    if ($LASTEXITCODE -ne 0) { throw 'Installed candidate unlock failed.' }
    node scripts/test-windows-candidate.cjs verify
    if ($LASTEXITCODE -ne 0) { throw 'Installed candidate data migration/preservation failed.' }
    Close-CandidateWindow $newExe
  }
  Write-Output "PASS: original $OldVersion UI -> candidate feed -> installer -> automatic restart $version; existing password unlock, preserved data and the expected migration backup count across two starts."
} finally {
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
}
