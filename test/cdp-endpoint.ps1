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
  function Get-DreamSkinPortListeners {param($Port) $script:owners}
  function Test-DreamSkinPathEqual {param($Left,$Right) $Left -ieq $Right}
  function Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) [pscustomobject]@{BrowserId='verified-browser';BrowserWebSocketDebuggerUrl='ws://127.0.0.1:9336/devtools/browser/verified-browser';Browser='fixture';TargetCount=1}}
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
  $script:owners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=887});$script:reads=0;$script:replaceOnRead=$true
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'PID replacement during endpoint validation was accepted'
  $script:process=$null;$script:replaceOnRead=$false
  Assert-Endpoint (-not (Get-WallpaperVerifiedEndpoint -Port 9336 -Codex $codex)) 'A disappeared listener owner was accepted'
}
Write-Output 'PASS: occupied-port preservation, free fallback, saved endpoint revalidation, damaged/unsafe hints, all-busy refusal, unique same-session main ownership, PID replacement and native timestamp precision. No real client or listener changed.'
