$ErrorActionPreference='Stop'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('cwb-exit-race-'+[guid]::NewGuid())
$code=Join-Path $fixture 'code';$data=Join-Path $fixture 'data'
foreach($folder in @((Join-Path $code 'windows'),(Join-Path $code 'vendor/codex-dynamic-skin/scripts'),$data)){[void][IO.Directory]::CreateDirectory($folder)}
foreach($file in @('Start-CodexWallpaper.ps1','LaunchPolicy.ps1','StartupHealth.ps1','Runtime.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot "../windows/$file") -Destination (Join-Path $code "windows/$file") -ErrorAction Stop}
# Real bootstrap, fixture process snapshots and no-op launches. The old root
# persists through the bounded drain, then vanishes just as catch runs.
$common=@'
$script:fixtureRead=0
function Get-DreamSkinRegisteredCodexInstalls {
  [pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';Version='26.1.1.1';PackageFullName='fixture';PackageRoot='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0';Executable='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe';AppUserModelId='fixture!App'}
}
function Get-CimInstance {
  [CmdletBinding()]param([Parameter(Position=0)][string]$ClassName,[string]$Filter)
  $script:fixtureRead++
  if($script:fixtureRead -le 50){[pscustomobject]@{Name='ChatGPT.exe';ProcessId=22222;ParentProcessId=1;CreationDate=[datetime]'2026-01-01T00:00:00Z';SessionId=(Get-Process -Id $PID).SessionId;ExecutablePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe';CommandLine='fixture-client'}}
}
function Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) return $null}
function Test-DreamSkinPortAvailable {param($Port) return $true}
function Start-Sleep {param($Milliseconds,$Seconds)}
function Start-DreamSkinCodex {param($Codex,$Arguments) [IO.File]::WriteAllText($env:CWB_FIXTURE_MARKER,'unexpected activation');throw 'Fixture launch must not be called'}
'@
[IO.File]::WriteAllText((Join-Path $code 'vendor/codex-dynamic-skin/scripts/common-windows.ps1'),$common,[Text.UTF8Encoding]::new($false))
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path
$info.Arguments='-NoProfile -File "'+(Join-Path $code 'windows/Start-CodexWallpaper.ps1')+'"'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.Environment['CODEX_WALLPAPER_DATA_DIR']=$data
$info.Environment['CODEX_WALLPAPER_NODE']=(Get-Command node.exe -ErrorAction Stop).Source
$marker=Join-Path $fixture 'unexpected-launch.txt';$info.Environment['CWB_FIXTURE_MARKER']=$marker
$child=[Diagnostics.Process]::Start($info)
try{
  $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
  if(-not $child.WaitForExit(30000)){$child.Kill();throw 'Fixture bootstrap timed out'}
  if($child.ExitCode -ne 1){throw ('Expected preserved-client failure; got '+$child.ExitCode+' '+$stdout.Result+$stderr.Result)}
  if(Test-Path -LiteralPath $marker){throw 'The bootstrap activated an ordinary client after a prelaunch failure'}
  $status=Get-Content -LiteralPath (Join-Path $data 'launch-status.json') -Raw|ConvertFrom-Json
  if($status.shutdownDrain -ne 'client-still-running' -or $status.recovery -ne 'no-client-started-before-failure'){throw ('Wrong recovery decision: '+($status|ConvertTo-Json -Depth 4))}
  Write-Output 'PASS: real bootstrap preserves a running root, observes it disappear during failure handling, and does not reopen an ordinary client. All process/package responses and launches are isolated fixtures.'
}finally{$child.Dispose()}
