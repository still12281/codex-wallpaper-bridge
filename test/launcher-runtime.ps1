[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BuildDirectory)
$ErrorActionPreference='Stop'
$testRoot=[IO.Path]::GetFullPath($BuildDirectory)
$testConfig=Get-Content -LiteralPath (Join-Path $testRoot 'launcher-runtime.json') -Raw -ErrorAction Stop | ConvertFrom-Json
function Get-RootIdentities {
  @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction Stop |
    Where-Object {$_.CommandLine -notmatch '--type=|--monitor-self'} |
    ForEach-Object {"$($_.ProcessId):$($_.CreationDate.ToUniversalTime().Ticks)"})
}
$before=@(Get-RootIdentities)
$launchPath=Join-Path $testRoot 'launch-status.json'
$launchBefore=if(Test-Path -LiteralPath $launchPath){[IO.File]::ReadAllText($launchPath)}else{$null}
$testStarted=[DateTimeOffset]::UtcNow
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=Join-Path $testRoot 'CodexEntry.exe'
$info.Arguments='--check-runtime'
$info.WorkingDirectory=$testRoot
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
$info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$info.EnvironmentVariables['PATH']=''
[void]$info.EnvironmentVariables.Remove('CODEX_WALLPAPER_PWSH')
[void]$info.EnvironmentVariables.Remove('CODEX_WALLPAPER_NODE')
$testEntry=[Diagnostics.Process]::Start($info)
try {
  if(-not $testEntry.WaitForExit(55000)){$testEntry.Kill();throw 'Owned diagnostic entry timed out'}
  if($testEntry.ExitCode -ne 0){throw 'Native diagnostic failed; inspect entry-error.log and entry-runtime-check.log in the test build'}
}finally{$testEntry.Dispose()}
$result=Get-Content -LiteralPath (Join-Path $testRoot 'entry-runtime-check.json') -Raw -ErrorAction Stop | ConvertFrom-Json
if(([DateTimeOffset]$result.checkedAt) -lt $testStarted){throw 'Diagnostic result is stale'}
if($result.powerShell -ine $testConfig.powerShell -or $result.node -ine $testConfig.node -or $result.exitCode -ne 0 -or -not $result.inspectOnly){throw 'Recorded runtime was not used'}
$phase=Get-Content -LiteralPath (Join-Path $testRoot 'entry-inspect-status.json') -Raw -ErrorAction Stop | ConvertFrom-Json
if($phase.phase -ne 'inspect-only'){throw 'Unexpected bootstrap action'}
$launchAfter=if(Test-Path -LiteralPath $launchPath){[IO.File]::ReadAllText($launchPath)}else{$null}
if($launchBefore -cne $launchAfter){throw 'Inspection overwrote active launch identity'}
$after=@(Get-RootIdentities)
if((@($before | Sort-Object) -join ';') -cne (@($after | Sort-Object) -join ';')){throw 'User client identity changed during inspection'}
Write-Output 'PASS: native entry invokes the recorded runtime with empty PATH; bootstrap remains inspect-only; user clients unchanged.'
