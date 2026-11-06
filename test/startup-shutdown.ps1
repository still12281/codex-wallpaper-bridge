param([string[]]$Scenarios=@('attach-only','cold','manual-after-update','exit-path-pending','exit-path-after-read','shutdown','occupied-free','stolen-before-launch','ordinary-preserved'))
$ErrorActionPreference='Stop'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('cwb-exit-race-'+[guid]::NewGuid())
$code=Join-Path $fixture 'code';$data=Join-Path $fixture 'data'
foreach($folder in @((Join-Path $code 'windows'),(Join-Path $code 'vendor/codex-dynamic-skin/scripts'),$data)){[void][IO.Directory]::CreateDirectory($folder)}
foreach($file in @('Start-CodexWallpaper.ps1','LaunchPolicy.ps1','StartupHealth.ps1','Runtime.ps1','CleanProcess.ps1','CleanProcess.cs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot "../windows/$file") -Destination (Join-Path $code "windows/$file") -ErrorAction Stop}
# Fake listener responses below remain authoritative for this bootstrap fixture.
[IO.File]::WriteAllText((Join-Path $code 'windows/FastTcp.ps1'),'# fixture listener adapter')
# Real bootstrap, fixture process snapshots and no-op launches. The old root
# persists through the bounded drain, then vanishes just as catch runs.
$common=@'
$script:fixtureRead=0
function Get-DreamSkinRegisteredCodexInstalls {
  [IO.File]::AppendAllText(($env:CWB_FIXTURE_MARKER+'.packages'),'read'+[char]10)
  [pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';Version='26.1.1.1';PackageFullName='fixture';PackageRoot='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0';Executable='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe';AppUserModelId='fixture!App'}
}
function Get-CimInstance {
  [CmdletBinding()]param([Parameter(Position=0)][string]$ClassName,[string]$Filter)
  if($env:CWB_FIXTURE_CASE -in @('exit-path-pending','exit-path-after-read')){
    if($Filter -eq "Name = 'ChatGPT.exe'"){$script:fixtureRead++}
    if($script:fixtureRead -le 2 -and $Filter -in @("Name = 'ChatGPT.exe'",'ProcessId = 22222')){[pscustomobject]@{Name='ChatGPT.exe';ProcessId=22222;ParentProcessId=1;CreationDate=[datetime]'2026-01-01T00:00:00Z';SessionId=(Get-Process -Id $PID).SessionId;ExecutablePath=$(if($env:CWB_FIXTURE_CASE -eq 'exit-path-after-read' -and $script:fixtureRead -eq 1){'C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe'});CommandLine='--type=renderer'}}
    return
  }
  if($Filter -eq 'ProcessId = 37780' -or $env:CWB_FIXTURE_CASE -in @('attach-only','cold','manual-after-update','occupied-free','stolen-before-launch')){return}
  $script:fixtureRead++
  if($script:fixtureRead -le 50 -or $env:CWB_FIXTURE_CASE -eq 'ordinary-preserved'){[pscustomobject]@{Name='ChatGPT.exe';ProcessId=22222;ParentProcessId=1;CreationDate=[datetime]'2026-01-01T00:00:00Z';SessionId=(Get-Process -Id $PID).SessionId;ExecutablePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe';CommandLine='fixture-client'}}
}
function Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) return $null}
function Get-DreamSkinPortListeners {param($Port) if($env:CWB_FIXTURE_CASE -notin @('attach-only','cold','manual-after-update','exit-path-pending','exit-path-after-read','shutdown') -and $Port -eq 9335){[pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=37780}}}
$script:portReads=0
function Test-DreamSkinPortAvailable {param($Port) if($env:CWB_FIXTURE_CASE -eq 'stolen-before-launch' -and $Port -eq 9336){$script:portReads++;return $script:portReads -eq 1};return ($env:CWB_FIXTURE_CASE -in @('attach-only','cold','manual-after-update','exit-path-pending','exit-path-after-read','shutdown') -or $Port -ne 9335)}
function Start-Sleep {param($Milliseconds,$Seconds)}
function Start-DreamSkinCodex {throw 'Package activation must not precede direct debug launch'}
function Start-WallpaperCodexDirect {param($Codex,$Arguments) if(Test-Path -LiteralPath ($env:CWB_FIXTURE_MARKER+'.maintenance')){throw 'Shortcut maintenance blocked cold launch'};[IO.File]::AppendAllText($env:CWB_FIXTURE_MARKER,(@{arguments=@($Arguments);strategy='direct';executable=$Codex.Executable}|ConvertTo-Json -Compress)+[char]10);throw 'Fixture activation recorded; no real client launched'}
function Repair-WallpaperEntryShortcuts {[IO.File]::WriteAllText(($env:CWB_FIXTURE_MARKER+'.maintenance'),'called')}
'@
[IO.File]::WriteAllText((Join-Path $code 'vendor/codex-dynamic-skin/scripts/common-windows.ps1'),$common,[Text.UTF8Encoding]::new($false))
foreach($scenario in $Scenarios){
$scenarioData=Join-Path $data $scenario;[void][IO.Directory]::CreateDirectory($scenarioData)
if($scenario -eq 'manual-after-update'){
  [IO.File]::WriteAllText((Join-Path $scenarioData 'update-reconnect.json'),'{"phase":"failed-no-retry","observedVersion":"26.1.1.1"}')
  [IO.File]::WriteAllText((Join-Path $scenarioData 'entry-health.json'),'{"lastSuccess":{"version":"25.1.1.1"}}')
  [IO.File]::WriteAllText((Join-Path $scenarioData 'settings.json'),'{"selected":"saved-wallpaper","generatedFixture":true}')
  $manualHashes=@{};foreach($name in @('update-reconnect.json','settings.json')){$manualHashes[$name]=(Get-FileHash -LiteralPath (Join-Path $scenarioData $name)).Hash}
}
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path
$info.Arguments='-NoProfile -File "'+(Join-Path $code 'windows/Start-CodexWallpaper.ps1')+'"'
if($scenario -eq 'attach-only'){$info.Arguments+=' -AttachOnly'}
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
  if($scenario -in @('cold','manual-after-update','exit-path-pending','exit-path-after-read','occupied-free','stolen-before-launch')){
    $expectedPort=if($scenario -in @('cold','manual-after-update','exit-path-pending','exit-path-after-read')){9335}elseif($scenario -eq 'occupied-free'){9336}else{9337}
    $requests=@(Get-Content -LiteralPath $marker|ForEach-Object {$_|ConvertFrom-Json})
    if($requests.Count -ne 1 -or $requests[0].arguments -notcontains "--remote-debugging-port=$expectedPort" -or $status.cdpPort -ne $expectedPort -or $status.recovery -ne 'no-client-started-before-failure'){throw 'Occupied-port fallback did not reach exactly one debug launch on the expected free port'}
    $expectedPackageReads=if($scenario -eq 'exit-path-after-read'){2}else{1} # Refresh the registered version after observing an exit.
    if($requests[0].strategy -ne 'direct' -or @(Get-Content -LiteralPath ($marker+'.packages')).Count -ne $expectedPackageReads){throw 'Cold launch used unexpected package discovery or package activation'}
    if($scenario -eq 'manual-after-update'){
      if($requests[0].executable -notlike '*OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe' -or -not $status.startupCheck.versionChanged){throw 'Manual update recovery did not use the current registered package'}
      foreach($name in $manualHashes.Keys){if((Get-FileHash -LiteralPath (Join-Path $scenarioData $name)).Hash -cne $manualHashes[$name]){throw "Manual recovery changed $name"}}
    }
  }elseif($scenario -eq 'attach-only'){
    if((Test-Path -LiteralPath $marker) -or $status.recovery -ne 'no-client-started-before-failure'){throw 'Attach-only recovery activated a client without a verified endpoint'}
  }else{
    if(Test-Path -LiteralPath $marker){throw 'The bootstrap activated a client despite the ordinary-client guard'}
    $expectedRecovery=if($scenario -eq 'shutdown'){'no-client-started-before-failure'}else{'existing-client-preserved'}
    if($status.shutdownDrain -ne 'client-still-running' -or $status.recovery -ne $expectedRecovery){throw ('Wrong recovery decision: '+($status|ConvertTo-Json -Depth 4))}
    if($scenario -eq 'ordinary-preserved' -and $status.cdpPort -ne 9336){throw 'Ordinary guard did not run with the fallback port selected'}
  }
  Write-Output ('PASS: real bootstrap fixture '+$scenario+'; only fake process/package/activation responses used.')
}finally{$child.Dispose()}
}
