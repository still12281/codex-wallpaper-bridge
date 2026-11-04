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
  if($Filter -eq 'ProcessId = 37780' -or $env:CWB_FIXTURE_CASE -in @('occupied-free','stolen-before-launch')){return}
  $script:fixtureRead++
  if($script:fixtureRead -le 50 -or $env:CWB_FIXTURE_CASE -eq 'ordinary-preserved'){[pscustomobject]@{Name='ChatGPT.exe';ProcessId=22222;ParentProcessId=1;CreationDate=[datetime]'2026-01-01T00:00:00Z';SessionId=(Get-Process -Id $PID).SessionId;ExecutablePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe';CommandLine='fixture-client'}}
}
function Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) return $null}
function Get-DreamSkinPortListeners {param($Port) if($env:CWB_FIXTURE_CASE -ne 'shutdown' -and $Port -eq 9335){[pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=37780}}}
$script:portReads=0
function Test-DreamSkinPortAvailable {param($Port) if($env:CWB_FIXTURE_CASE -eq 'stolen-before-launch' -and $Port -eq 9336){$script:portReads++;return $script:portReads -eq 1};return ($env:CWB_FIXTURE_CASE -eq 'shutdown' -or $Port -ne 9335)}
function Start-Sleep {param($Milliseconds,$Seconds)}
function Start-DreamSkinCodex {param($Codex,$Arguments) [IO.File]::AppendAllText($env:CWB_FIXTURE_MARKER,(@{arguments=@($Arguments)}|ConvertTo-Json -Compress)+[char]10);throw 'Fixture activation recorded; no real client launched'}
'@
[IO.File]::WriteAllText((Join-Path $code 'vendor/codex-dynamic-skin/scripts/common-windows.ps1'),$common,[Text.UTF8Encoding]::new($false))
foreach($scenario in @('shutdown','occupied-free','stolen-before-launch','ordinary-preserved')){
$scenarioData=Join-Path $data $scenario;[void][IO.Directory]::CreateDirectory($scenarioData)
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path
$info.Arguments='-NoProfile -File "'+(Join-Path $code 'windows/Start-CodexWallpaper.ps1')+'"'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.Environment['CODEX_WALLPAPER_DATA_DIR']=$scenarioData
$info.Environment['CODEX_WALLPAPER_NODE']=(Get-Command node.exe -ErrorAction Stop).Source
$marker=Join-Path $fixture ($scenario+'-launch.txt');$info.Environment['CWB_FIXTURE_MARKER']=$marker
$info.Environment['CWB_FIXTURE_CASE']=$scenario
$child=[Diagnostics.Process]::Start($info)
try{
  $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
  if(-not $child.WaitForExit(30000)){$child.Kill();throw 'Fixture bootstrap timed out'}
  if($child.ExitCode -ne 1){throw ('Expected preserved-client failure; got '+$child.ExitCode+' '+$stdout.Result+$stderr.Result)}
  $status=Get-Content -LiteralPath (Join-Path $scenarioData 'launch-status.json') -Raw|ConvertFrom-Json
  if($scenario -in @('occupied-free','stolen-before-launch')){
    $expectedPort=if($scenario -eq 'occupied-free'){9336}else{9337}
    $requests=@(Get-Content -LiteralPath $marker|ForEach-Object {$_|ConvertFrom-Json})
    if($requests.Count -ne 1 -or $requests[0].arguments -notcontains "--remote-debugging-port=$expectedPort" -or $status.cdpPort -ne $expectedPort -or $status.recovery -ne 'no-client-started-before-failure'){throw 'Occupied-port fallback did not reach exactly one debug launch on the expected free port'}
  }else{
    if(Test-Path -LiteralPath $marker){throw 'The bootstrap activated a client despite the ordinary-client guard'}
    $expectedRecovery=if($scenario -eq 'shutdown'){'no-client-started-before-failure'}else{'existing-client-preserved'}
    if($status.shutdownDrain -ne 'client-still-running' -or $status.recovery -ne $expectedRecovery){throw ('Wrong recovery decision: '+($status|ConvertTo-Json -Depth 4))}
    if($scenario -eq 'ordinary-preserved' -and $status.cdpPort -ne 9336){throw 'Ordinary guard did not run with the fallback port selected'}
  }
  Write-Output ('PASS: real bootstrap fixture '+$scenario+'; only fake process/package/activation responses used.')
}finally{$child.Dispose()}
}
