$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
function Assert-Endpoint($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-endpoint-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory($root)
$recordPath=Join-Path $root 'cdp-endpoint.json'
$probeNone={param($Port,$Codex) return $null}
$choice=Select-WallpaperCdpEndpoint -Root $root -Probe $probeNone -Available {param($Port) $Port -ne 9335}
Assert-Endpoint ($choice.port -eq 9336 -and $choice.reason -eq 'occupied-port-preserved' -and -not $choice.identity) 'Occupied default port was not preserved and bypassed'
@{schemaVersion=1;address='127.0.0.1';port=9337;browserId='untrusted-saved-value';processId=999}|ConvertTo-Json|Set-Content -LiteralPath $recordPath
$identity=[pscustomobject]@{BrowserId='freshly-verified'}
$choice=Select-WallpaperCdpEndpoint -Root $root -Probe {param($Port) if($Port -eq 9337){$identity}} -Available {throw 'A verified endpoint must be reused before allocating'}
Assert-Endpoint ($choice.port -eq 9337 -and $choice.identity.BrowserId -eq 'freshly-verified') 'Saved endpoint hint was trusted without a fresh probe'
foreach($bad in @(@{schemaVersion=1;address='0.0.0.0';port=9337},@{schemaVersion=1;address='127.0.0.1';port=9999},@{schemaVersion=9;address='127.0.0.1';port=9337},@{schemaVersion=1;address='127.0.0.1';port='9337'})){
  $bad|ConvertTo-Json|Set-Content -LiteralPath $recordPath
  Assert-Endpoint (@(Get-WallpaperCdpProbePorts $root).Count -eq 1 -and @(Get-WallpaperCdpProbePorts $root)[0] -eq 9335) 'Unsafe record influenced endpoint candidates'
}
[IO.File]::WriteAllText($recordPath,'invalid json')
$choice=Select-WallpaperCdpEndpoint -Root $root -Probe $probeNone -Available {param($Port) $Port -eq 9338}
Assert-Endpoint ($choice.port -eq 9338) 'Corrupt record prevented free-port fallback'
$blocked=$false;try{Select-WallpaperCdpEndpoint -Root $root -Probe $probeNone -Available {$false}|Out-Null}catch{$blocked=$true}
Assert-Endpoint $blocked 'All occupied ports allowed a launch'
# Strict endpoint-owner verification, using only process/listener fixtures.
& {
  $fixtureSession=(Get-Process -Id $PID).SessionId;$fixturePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
  $codex=[pscustomobject]@{Executable=$fixturePath}
  $script:owners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=887})
  $script:process=[pscustomobject]@{ProcessId=887;SessionId=$fixtureSession;ExecutablePath=$fixturePath;CommandLine='fixture-main';CreationDate=[datetime]'2026-01-01T00:00:00Z'}
  $script:nativeStart=$script:process.CreationDate.AddTicks(4);$script:replaceOnRead=$false;$script:reads=0
  $script:listenerReads=0
  function Get-DreamSkinPortListeners {param($Port) $script:listenerReads++;$script:owners}
  function Test-DreamSkinPathEqual {param($Left,$Right) $Left -ieq $Right}
  $script:pagesReady=$true;$script:switchListener=$false
  function Get-DreamSkinCdpTargets {param($Port) if($script:pagesReady){[pscustomobject]@{id='fixture-target';url='app://-/index.html'}}}
  function Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) if($script:pagesReady){[pscustomobject]@{BrowserId='verified-browser';BrowserWebSocketDebuggerUrl='ws://127.0.0.1:9336/devtools/browser/verified-browser';Browser='fixture';TargetCount=1}}}
  function Get-DreamSkinCdpBrowserIdentity {param($Port) if($script:switchListener){$script:owners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=888})};[pscustomobject]@{BrowserId='verified-browser';WebSocketDebuggerUrl='ws://127.0.0.1:9336/devtools/browser/verified-browser';Browser='fixture'}}
  function Get-CimInstance {
    [CmdletBinding()]param([Parameter(Position=0)]$ClassName,$Filter)
    $script:reads++;if($script:replaceOnRead -and $script:reads -gt 1){$copy=$script:process.PSObject.Copy();$copy.CreationDate=$copy.CreationDate.AddSeconds(1);return $copy};$script:process
  }
  function Get-Process {
    [CmdletBinding()]param($Id)
    if($Id -eq $PID){return [pscustomobject]@{SessionId=$fixtureSession}}
    $value=[pscustomobject]@{HasExited=$false;SessionId=$fixtureSession;StartTime=$script:nativeStart;MainModule=[pscustomobject]@{FileName=$fixturePath}}
    $value|Add-Member -MemberType ScriptMethod -Name Dispose -Value {};return $value
  }
  $valid=Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex
  Assert-Endpoint ($valid.RootProcessId -eq 887 -and $valid.RootCreatedAtUtc -eq $script:nativeStart.ToUniversalTime().ToString('o')) 'CIM microsecond rounding rejected the native process identity'
  Assert-Endpoint ($script:listenerReads -eq 2 -and $script:reads -eq 2) 'Strict verification repeated listener/process scans instead of one before/after pair'
  $pending=Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex -AllowPendingPage
  Assert-Endpoint ($pending.RootProcessId -eq 887 -and $pending.TargetCount -eq 0) 'Verified browser could not prepare the host before app-page creation'
  $script:pagesReady=$false
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'Strict reuse accepted a browser without its app page'
  Assert-Endpoint ($null -ne (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex -AllowPendingPage)) 'Owned browser was gated by app-page readiness'
  $script:pagesReady=$true;$script:switchListener=$true
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex -AllowPendingPage)) 'Listener ownership changed during browser HTTP validation'
  $script:switchListener=$false;$script:owners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=887})
  Save-WallpaperCdpEndpoint -Root $root -Port 9336 -Identity $valid
  Assert-Endpoint ((Get-Content -LiteralPath $recordPath -Raw|ConvertFrom-Json).port -eq 9336) 'Verified endpoint was not saved'
  $script:process.SessionId=$fixtureSession+1
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'Another Windows session was accepted'
  $script:process.SessionId=$fixtureSession;$script:process.CommandLine='--type=renderer'
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'A helper process was accepted as the browser root'
  $script:process.CommandLine='fixture-main';$script:owners+=@([pscustomobject]@{LocalAddress='::1';OwningProcess=888})
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'Multiple listener owners were accepted'
  $script:owners=@([pscustomobject]@{LocalAddress='0.0.0.0';OwningProcess=887})
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'A public-address listener was accepted'
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex -AllowPendingPage)) 'Pending-page mode accepted a public listener'
  $script:owners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=887});$script:reads=0;$script:replaceOnRead=$true
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'PID replacement during endpoint validation was accepted'
  $script:reads=0
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex -AllowPendingPage)) 'Pending-page mode accepted a replaced process'
  $script:process=$null;$script:replaceOnRead=$false
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'A disappeared listener owner was accepted'
}
Write-Output 'PASS: occupied-port preservation, free fallback, saved endpoint revalidation, damaged/unsafe hints, all-busy refusal, unique same-session main ownership, PID replacement and native timestamp precision. No real client or listener changed.'
& {
  $errors=$null;$tokens=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../windows/Start-CodexWallpaper.ps1'),[ref]$tokens,[ref]$errors)
  if($errors){throw 'Bootstrap syntax error'}
  $function=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-TaskIdentity'},$true)
  . ([scriptblock]::Create($function.Extent.Text))
  $expected=[pscustomobject]@{Id=887;Created=([DateTimeOffset]::Parse('2026-01-01T00:00:00Z')).UtcTicks;Path='verified.exe'}
  $script:observed=[pscustomobject]@{RootProcessId=887;RootCreatedAtUtc='2026-01-01T00:00:00.0000004Z';RootExecutable='verified.exe'}
  function Get-WallpaperVerifiedEndpoint {param($Port,$Codex,[switch]$AllowPendingPage) if(-not $AllowPendingPage){throw 'Expected early browser verification'};$script:observed}
  if(-not (Wait-TaskIdentity -Port 9335 -ExpectedRoot $expected -Seconds 0)){throw 'Owned early browser was rejected'}
  foreach($field in @('RootProcessId','RootCreatedAtUtc','RootExecutable')){
    $script:observed=[pscustomobject]@{RootProcessId=887;RootCreatedAtUtc='2026-01-01T00:00:00Z';RootExecutable='verified.exe'}
    if($field -eq 'RootProcessId'){$script:observed.$field=888}elseif($field -eq 'RootCreatedAtUtc'){$script:observed.$field='2026-01-01T00:00:01Z'}else{$script:observed.$field='other.exe'}
    $blocked=$false;try{Wait-TaskIdentity -Port 9335 -ExpectedRoot $expected -Seconds 0|Out-Null}catch{$blocked=$true}
    if(-not $blocked){throw ('Early browser ownership mismatch accepted: '+$field)}
  }
  Write-Output 'PASS: early browser belongs to this exact launch; other PID, creation time or executable rejected.'
}
