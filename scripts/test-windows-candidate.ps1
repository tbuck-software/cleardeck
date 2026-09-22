# Run only on a disposable GitHub-hosted Windows runner.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('2.1.0', '2.2.0', '2.2.1', '2.3.0')]
  [string]$OldVersion,
  [Parameter(Mandatory = $true)]
  [string]$OldInstaller,
  [Parameter(Mandatory = $true)]
  [string]$Artifacts,
  [ValidateSet('manual', 'update')]
  [string]$Mode = 'manual',
  [Parameter(Mandatory = $true)]
  [ValidateSet('2.3.0', '2.3.1')]
  [string]$TargetVersion
)

$ErrorActionPreference = 'Stop'

if (
  $env:GITHUB_ACTIONS -ne 'true' -or
  $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or
  $env:RUNNER_OS -ne 'Windows'
) {
  throw 'Disposable GitHub-hosted Windows runner required.'
}

if ([version]$TargetVersion -le [version]$OldVersion) {
  throw "Target version $TargetVersion must be newer than baseline $OldVersion."
}

$repoRoot = (Get-Location).Path
$oldInstallerPath = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $OldInstaller).Path)
$artifactRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Artifacts).Path)
$targetPattern = "^ClearDeck-$([regex]::Escape($TargetVersion))-Setup\.exe$"
$targetInstallers = @(
  Get-ChildItem -LiteralPath $artifactRoot -Recurse -File -Filter '*.exe' |
    Where-Object { $_.Name -match $targetPattern }
)
if ($targetInstallers.Count -ne 1) {
  throw "Expected one $TargetVersion setup executable in $artifactRoot, found $($targetInstallers.Count)."
}
$targetInstaller = $targetInstallers[0]

$env:OLD_VERSION = $OldVersion
$env:TARGET_VERSION = $TargetVersion
$env:TEST_MODE = $Mode

function Get-CandidateProcesses([string]$Executable) {
  $expected = [IO.Path]::GetFullPath($Executable)
  @(
    Get-Process -Name cleardeck -ErrorAction SilentlyContinue |
      Where-Object {
        try {
          $_.Path -and ([IO.Path]::GetFullPath($_.Path) -ieq $expected)
        } catch {
          $false
        }
      }
  )
}

function Wait-CandidateProcess([string]$Executable, [int]$TimeoutSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $processes = @(Get-CandidateProcesses $Executable)
    if ($processes.Count -gt 0) {
      return $processes[0]
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Close-CandidateWindow([string]$Executable) {
  $window = $null
  for ($i = 0; $i -lt 90; $i++) {
    $window = @(
      Get-CandidateProcesses $Executable |
        Where-Object { $_.MainWindowHandle -ne 0 } |
        Select-Object -First 1
    )[0]
    if ($window) {
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (!$window) {
    throw "Candidate process did not present a main window: $Executable"
  }
  Write-Output "Closing candidate window, process $($window.Id)."
  if (!$window.CloseMainWindow()) {
    throw 'Candidate main window rejected the close request.'
  }
  if (!$window.WaitForExit(30000)) {
    throw 'Candidate did not close cleanly.'
  }
  for ($i = 0; $i -lt 60; $i++) {
    if (@(Get-CandidateProcesses $Executable).Count -eq 0) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Candidate process did not exit after the main window closed: $Executable"
}

function Stop-CandidateProcesses([string]$Executable) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $processes = @(Get-CandidateProcesses $Executable)
    if ($processes.Count -eq 0) {
      return
    }
    $window = @($processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1)[0]
    if ($window) {
      Close-CandidateWindow $Executable
    } else {
      foreach ($process in $processes) {
        Stop-Process -Id $process.Id -ErrorAction Stop
      }
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Candidate processes did not stop: $Executable"
}

function Invoke-CandidateScript([string]$Stage) {
  node scripts/test-windows-candidate.cjs $Stage
  if ($LASTEXITCODE -ne 0) {
    throw "Windows candidate stage failed: $Stage"
  }
}

$installRoot = Join-Path $env:LOCALAPPDATA 'cleardeck'
$data = Join-Path $env:APPDATA 'ClearDeck/data'
if ((Test-Path -LiteralPath $installRoot) -or (Test-Path -LiteralPath $data)) {
  throw 'Empty runner profile required.'
}
if (!(Test-Path -LiteralPath $oldInstallerPath -PathType Leaf)) {
  throw "Baseline installer does not exist: $oldInstallerPath"
}

# A withdrawn or broken update feed must not affect password login for the
# direct installer path. The update path supplies its local feed below.
Remove-Item Env:UPDATE_FEED_URL -ErrorAction SilentlyContinue
Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:UPDATE_TOKEN -ErrorAction SilentlyContinue

$baselineInstall = Start-Process -FilePath $oldInstallerPath -ArgumentList @('--silent') -PassThru
if (!$baselineInstall.WaitForExit(180000) -or $baselineInstall.ExitCode -ne 0) {
  throw 'Baseline installation failed.'
}
$oldExe = Join-Path $installRoot "app-$OldVersion/cleardeck.exe"
if (!(Test-Path -LiteralPath $oldExe -PathType Leaf)) {
  throw "Baseline executable missing: $oldExe"
}
# Squirrel may start the installed app after a silent setup. It must be gone
# before the profile is prepared and the debugger is attached.
$baselineRunning = Wait-CandidateProcess $oldExe 30
if ($baselineRunning) {
  Stop-CandidateProcesses $oldExe
}

node scripts/test-windows-candidate.cjs prepare
if ($LASTEXITCODE -ne 0) {
  throw 'Synthetic baseline profile preparation failed.'
}

$env:UI_DRIVER_DIR = Join-Path $env:RUNNER_TEMP 'cleardeck-ui-driver'
npm install --prefix $env:UI_DRIVER_DIR --no-audit --no-fund --ignore-scripts playwright-core@1.56.1
if ($LASTEXITCODE -ne 0) {
  throw 'UI driver install failed.'
}

$server = $null
try {
  if ($Mode -eq 'update') {
    $env:UPDATE_FEED_URL = 'http://127.0.0.1:8135/'
    $server = Start-Process -FilePath node -ArgumentList @(
      'scripts/test-windows-candidate.cjs',
      'serve',
      $artifactRoot
    ) -WorkingDirectory $repoRoot -PassThru
    $ready = $false
    for ($i = 0; $i -lt 45; $i++) {
      if ($server.HasExited) {
        throw 'Candidate feed server exited before becoming ready.'
      }
      try {
        Invoke-WebRequest "${env:UPDATE_FEED_URL}latest.yml" -UseBasicParsing | Out-Null
        $ready = $true
        break
      } catch {
        Start-Sleep -Seconds 1
      }
    }
    if (!$ready) {
      throw 'Candidate feed did not start.'
    }
  }

  Start-Process -FilePath $oldExe -ArgumentList @('--remote-debugging-port=9222') | Out-Null
  Invoke-CandidateScript 'old-ui'

  if ($Mode -eq 'manual') {
    # The old UI was unlocked and its records, settings and preferences were
    # checked before the direct installer was allowed to run.
    Close-CandidateWindow $oldExe
    Invoke-CandidateScript 'verify-before'

    $candidateInstall = Start-Process -FilePath $targetInstaller.FullName -ArgumentList @('--silent') -PassThru
    if (!$candidateInstall.WaitForExit(180000) -or $candidateInstall.ExitCode -ne 0) {
      throw 'Corrected direct installer failed.'
    }
    Write-Output "Corrected direct installer completed for $TargetVersion."
  }

  $newExe = Join-Path $installRoot "app-$TargetVersion/cleardeck.exe"
  $targetWaitSeconds = 180
  if ($Mode -eq 'manual') {
    $targetWaitSeconds = 30
  }
  $running = Wait-CandidateProcess $newExe $targetWaitSeconds
  if (!$running) {
    if ($Mode -eq 'manual') {
      Start-Process -FilePath $newExe -ArgumentList @('--remote-debugging-port=9222') | Out-Null
    } else {
      throw "In-app update did not restart $TargetVersion."
    }
  }
  $running = Wait-CandidateProcess $newExe
  if (!$running) {
    throw "Target executable did not start: $newExe"
  }
  if ((Get-Item -LiteralPath $newExe).VersionInfo.ProductVersion -notlike "$TargetVersion*") {
    throw "Target executable has the wrong product version: $newExe"
  }
  Write-Output "Running target product version $TargetVersion."

  # The installer or updater may have launched the target without a debugger.
  # Close that process and start it under the disposable UI driver below.
  Close-CandidateWindow $newExe
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    Write-Output "Checking target unlock and preserved state, start $attempt of 2."
    Start-Process -FilePath $newExe -ArgumentList @('--remote-debugging-port=9222') | Out-Null
    Invoke-CandidateScript 'new-ui'
    Invoke-CandidateScript 'verify'
    Close-CandidateWindow $newExe
  }
  Write-Output "PASS: $OldVersion baseline -> $Mode -> $TargetVersion; password, encrypted configuration, database, settings and user preferences survived two target starts."
} finally {
  if ($server -and !$server.HasExited) {
    Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
  }
}
