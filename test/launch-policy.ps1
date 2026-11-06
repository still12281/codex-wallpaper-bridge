$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
function Assert-Policy($Condition,[string]$Message){if(-not $Condition){throw $Message}}
Set-WallpaperTrustedPackageRoots @([pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';PackageRoot='C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0'})
& {
  function Get-DreamSkinRegisteredCodexInstalls { @([pscustomobject]@{PackageFamilyName='OpenAI.Codex_other';SignatureKind='Store'},[pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store'}) }
  Assert-Policy ((Get-WallpaperRegisteredCodex).PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0') 'Another Store publisher could replace the official package'
}
function Client($Version,$Id,$Session=1,$Command=''){
  [pscustomobject]@{Name='ChatGPT.exe';ExecutablePath="C:\Program Files\WindowsApps\OpenAI.Codex_${Version}_x64__2p2nqsd0c76g0\app\ChatGPT.exe";ProcessId=$Id;SessionId=$Session;CommandLine=$Command}
}
$old=Client '26.1016.8622.0' 101
$new=Client '26.1021.3705.0' 102
$child=Client '26.1021.3705.0' 103 1 '--type=renderer'
$foreign=Client '26.1021.3705.0' 104 2
$untrusted=[pscustomobject]@{Name='ChatGPT.exe';ExecutablePath='C:\Downloads\ChatGPT.exe';ProcessId=105;SessionId=1;CommandLine=''}
$selected=@(Select-WallpaperCodexProcesses @($old,$new,$child,$foreign,$untrusted) 1)
Assert-Policy ($selected.Count -eq 3) 'Cross-version/session/path selection failed'
Assert-Policy ($selected.ProcessId -contains 101 -and $selected.ProcessId -contains 102) 'Old/new root omitted'
foreach($client in @($old,$new)){
  $blocked=$false;try{Assert-WallpaperClientAbsent @($client)}catch{$blocked=$true}
  Assert-Policy $blocked 'Existing main process was not blocked'
}
Assert-WallpaperClientAbsent @($child)
Assert-WallpaperClientAbsent @()
Assert-WallpaperClientAbsent @($old,$child) 101
$blocked=$false;try{Assert-WallpaperClientAbsent @($old,$new,$child) 101}catch{$blocked=$true}
Assert-Policy $blocked 'CDP owner reuse hid a second root'
$unknown=Client '26.1021.3705.0' 106
$unknown.ExecutablePath=$null
$blocked=$false;try{Select-WallpaperCodexProcesses @($unknown) 1}catch{$blocked=$true}
Assert-Policy $blocked 'Unreadable identity was ignored'
$arguments=@(Get-WallpaperDebugArguments 9335)
Assert-Policy ($arguments.Count -eq 2 -and -not ($arguments -match '--user-data-dir')) 'Independent profile reintroduced'
Assert-Policy (-not (Test-WallpaperOfficialCodexPath 'E:\user-project\WindowsApps\OpenAI.Codex_unrelatedpublisher\app\ChatGPT.exe')) 'Imitation package path was trusted'
Assert-Policy (-not (Test-WallpaperOfficialCodexPath 'E:\user-project\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe')) 'Imitation WindowsApps root was trusted'
Assert-Policy (-not (Test-WallpaperOfficialCodexPath 'C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__unrelatedpublisher\app\ChatGPT.exe')) 'Unknown publisher was trusted'
$ambiguous=Client '26.1.1.1' 107;$ambiguous.ExecutablePath='E:\OtherRoot\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
$blocked=$false;try{Select-WallpaperCodexProcesses @($ambiguous) 1|Out-Null}catch{$blocked=$true}
Assert-Policy $blocked 'An ambiguous old install root would permit a second client'
$data=Join-Path ([IO.Path]::GetTempPath()) 'cwb-policy-fixture';$code=Join-Path $data 'versions/release-aaaaaaaaaaaaaaaa';$node='C:\Runtime\node.exe';$now=[DateTimeOffset]::UtcNow
$oldHost=Join-Path $data 'versions/release-bbbbbbbbbbbbbbbb/src/video-cdp-host.mjs'
$process=[pscustomobject]@{ProcessId=123;ExecutablePath=$node;CommandLine=('"'+$node+'" --expose-gc "'+$oldHost+'" --cdp-port 9335')}
$status=[pscustomobject]@{pid=123;browserId='current-browser';updatedAt=$now.ToString('o')}
Assert-Policy ((Get-WallpaperHostDecision $process $status $data $code $node 'current-browser' $now) -eq 'reuse') 'Healthy previous-version host would be duplicated'
$status.updatedAt=$now.AddSeconds(-30).ToString('o')
Assert-Policy ((Get-WallpaperHostDecision $process $status $data $code $node 'current-browser' $now) -eq 'conflict') 'Stale previous-version host would be duplicated'
$status.updatedAt=$now.ToString('o');$process.ExecutablePath='C:\OldRuntime\node.exe'
Assert-Policy ((Get-WallpaperHostDecision $process $status $data $code $node 'current-browser' $now) -eq 'conflict') 'Old Node runtime host would be duplicated'
$unreported=[pscustomobject]@{Name='node.exe';CommandLine=$process.CommandLine}
Assert-Policy (@(Select-WallpaperOwnedHosts @($unreported) $data $code).Count -eq 1) 'Missing status would hide the old host'
foreach($bad in @(($data+'-foreign\versions\release-bbbbbbbbbbbbbbbb\src\video-cdp-host.mjs'),($oldHost+'.backup'),($data+'\versions\release-bbbbbbbbbbbbbbbb\..\src\video-cdp-host.mjs'))){
  Assert-Policy (-not (Test-WallpaperHostScript ('node.exe "'+$bad+'"') $data $code)) 'Host path boundary failed'
}
Write-Output 'PASS: old/new roots blocked; renderer allowed; foreign session/path excluded; official default profile retained.'

$snapshot=[pscustomobject]@{Id=201;Created=100;Path='verified-client';IsMain=$true}
$helper=[pscustomobject]@{Id=202;Created=101;Path='verified-client';IsMain=$false}
$script:drainRead=0
$drained=Wait-WallpaperStartupDrain -Initial @($snapshot,$helper) -Checks 4 -Pause {} -ReadSnapshot {
  $script:drainRead++
  if($script:drainRead -eq 1){$snapshot;$helper}elseif($script:drainRead -eq 2){$helper}
}
Assert-Policy ($drained.reason -eq 'exit-completed' -and -not $drained.remaining.Count) 'A closing client was not allowed to finish shutdown'
$replacement=[pscustomobject]@{Id=201;Created=200;Path='verified-client';IsMain=$true}
$drained=Wait-WallpaperStartupDrain -Initial @($snapshot) -Pause {throw 'Must not wait for another activation'} -ReadSnapshot {$replacement}
Assert-Policy ($drained.reason -eq 'new-client-preserved') 'PID reuse hid a new main process'
$drained=Wait-WallpaperStartupDrain -Initial @($helper) -Checks 1 -Pause {} -ReadSnapshot {$helper}
Assert-Policy ($drained.reason -eq 'helpers-only') 'A lingering renderer was classified as a live client root'
$drained=Wait-WallpaperStartupDrain -Initial @($snapshot) -Checks 1 -Pause {} -ReadSnapshot {$snapshot}
Assert-Policy ($drained.reason -eq 'client-still-running') 'An ordinary client was allowed to be replaced'
Assert-Policy ((Get-WallpaperFailureRecovery -CreatedVerifiedClient $false) -eq 'no-client-started-before-failure') 'Prelaunch failure reopened an ordinary client'
Assert-Policy ((Get-WallpaperFailureRecovery -CreatedVerifiedClient $true) -eq 'reopen-normal-client') 'Owned failed launch lost ordinary recovery'
Assert-Policy ((Get-WallpaperFailureRecovery -CreatedVerifiedClient $true -Remaining @($snapshot)) -eq 'existing-client-preserved') 'Failure replaced a remaining client'
Write-Output 'PASS: bounded shutdown drain, helper-only leftovers, new-main/PID-reuse preservation and recovery only after a verified owned launch.'
$script:slowReads=0
$drained=Wait-WallpaperStartupDrain -Initial @($snapshot) -TimeoutMilliseconds 1 -Pause {throw 'Deadline was ignored'} -ReadSnapshot {
  $script:slowReads++;Start-Sleep -Milliseconds 5;$snapshot
}
Assert-Policy ($drained.reason -eq 'client-still-running' -and $script:slowReads -eq 1) 'Slow snapshot costs were excluded from the shutdown deadline'
