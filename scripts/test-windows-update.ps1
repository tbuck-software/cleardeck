# Run only on a disposable GitHub-hosted Windows runner. Never on a user's machine.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'This test requires a disposable GitHub-hosted Windows runner.'
}

$downloadDir = Join-Path $env:RUNNER_TEMP 'cleardeck-update-installers'
New-Item -ItemType Directory -Path $downloadDir | Out-Null
foreach ($version in @('1.7.1', '1.8.0')) {
    gh release download "v$version" --repo $env:GITHUB_REPOSITORY --pattern '*.exe' --dir $downloadDir
    if ($LASTEXITCODE -ne 0) { throw "Cannot download installer $version" }
}

$installRoot = Join-Path $env:LOCALAPPDATA 'cleardeck'
$dataDir = Join-Path $env:APPDATA 'ClearDeck/data'
if ((Test-Path $installRoot) -or (Test-Path $dataDir)) { throw 'Test requires an empty runner profile.' }

function Wait-ForFile($file) {
    $deadline = (Get-Date).AddSeconds(120)
    while (!(Test-Path $file)) {
        if ((Get-Date) -gt $deadline) { throw "Timed out waiting for $file" }
        Start-Sleep -Seconds 2
    }
}

$oldInstaller = Get-ChildItem $downloadDir -Filter '*1.7.1*.exe' | Select-Object -First 1
$oldProcess = Start-Process $oldInstaller.FullName -ArgumentList '--silent' -PassThru
if (!$oldProcess.WaitForExit(120000)) { throw 'Old installer timed out.' }
if ($oldProcess.ExitCode -ne 0) { throw "Old installer failed: $($oldProcess.ExitCode)" }
$oldExe = Join-Path $installRoot 'app-1.7.1/cleardeck.exe'
Wait-ForFile $oldExe
Write-Output "Installed old executable: $((Get-Item $oldExe).VersionInfo.ProductVersion)"

Get-Process cleardeck -ErrorAction SilentlyContinue | Stop-Process -Force
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
# Synthetic locked data: neither version should open or modify it without a login.
[IO.File]::WriteAllText((Join-Path $dataDir 'config.json'), '{"configVersion":2,"salt":"test-salt","passwordHash":"test-hash","encryptedKey":"test-key","keyIv":"test-iv","keyTag":"test-tag"}')
[IO.File]::WriteAllText((Join-Path $dataDir 'employee.db.enc'), 'synthetic encrypted data for installer preservation test')
$before = @{}
Get-ChildItem $dataDir -File | ForEach-Object { $before[$_.Name] = (Get-FileHash $_.FullName).Hash }

# These are the exact arguments passed by electron-updater 6.6.2 NsisUpdater
# when ClearDeck 1.7.1 calls quitAndInstall() with the defaults.
$newInstaller = Get-ChildItem $downloadDir -Filter '*1.8.0*.exe' | Select-Object -First 1
$updateProcess = Start-Process $newInstaller.FullName -ArgumentList '--updated', '--force-run' -PassThru
if (!$updateProcess.WaitForExit(120000)) { throw 'Update installer timed out.' }
if ($updateProcess.ExitCode -ne 0) { throw "Update installer failed: $($updateProcess.ExitCode)" }
$newExe = Join-Path $installRoot 'app-1.8.0/cleardeck.exe'
Wait-ForFile $newExe
if ((Get-Item $newExe).VersionInfo.ProductVersion -notlike '1.8.0*') { throw 'Incorrect installed version.' }

$deadline = (Get-Date).AddSeconds(60)
do {
    $running = Get-Process cleardeck -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $newExe }
    if ($running) { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if (!$running) { throw 'The updated application did not restart.' }

foreach ($name in $before.Keys) {
    if ((Get-FileHash (Join-Path $dataDir $name)).Hash -ne $before[$name]) { throw "Local data changed: $name" }
}
$shortcut = Get-ChildItem (Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs') -Recurse -Filter '*ClearDeck*.lnk' | Select-Object -First 1
if (!$shortcut) { throw 'ClearDeck start menu shortcut missing.' }
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut.FullName)
if (!(Test-Path $link.TargetPath)) { throw 'Start menu shortcut target missing.' }
Write-Output 'PASS: 1.7.1 -> 1.8.0 with the legacy updater arguments; app restarted, shortcut exists, config and database unchanged.'
Get-Process cleardeck -ErrorAction SilentlyContinue | Stop-Process -Force
