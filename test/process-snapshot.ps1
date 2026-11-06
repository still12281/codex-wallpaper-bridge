$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
. (Join-Path $PSScriptRoot '../windows/UpdateReconnectPolicy.ps1')
function Assert-Snapshot($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$self=Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction Stop
$masked=$self|Select-Object *;$masked.ExecutablePath=$null
$native=Get-WallpaperNativeProcessSnapshot $masked
$process=Get-Process -Id $PID
try{Assert-Snapshot ($native.path -ieq $process.MainModule.FileName -and $native.ticks -eq $process.StartTime.ToUniversalTime().Ticks) 'Missing CIM path did not recover the exact native identity'}finally{$process.Dispose()}
$nativeRecord=[pscustomobject]@{id=$PID;path=$native.path;ticks=$native.ticks;session=$native.session}
foreach($field in @('id','ticks','session','path')){
  $changed=$nativeRecord|Select-Object *
  if($field -eq 'path'){$masked.ExecutablePath='C:\different.exe'}else{$changed.$field+=100}
  $blocked=$false
  try{Get-WallpaperNativeProcessSnapshot $masked -ReadNative {$changed} -ReadCurrent {$self}|Out-Null}catch{$blocked=$true;Assert-Snapshot (-not $_.Exception.Data['WallpaperPathPending']) 'Explicit identity mismatch became a transient wait'}
  Assert-Snapshot $blocked "Live identity mismatch accepted: $field"
  $masked.ExecutablePath=$null
}
$blocked=$false
try{Get-WallpaperNativeProcessSnapshot $masked -ReadNative {throw 'Access denied'} -ReadCurrent {$self}|Out-Null}catch{$blocked=$true;Assert-Snapshot ($_.Exception.Message -match "PID=$PID") 'Missing diagnostic PID'}
Assert-Snapshot $blocked 'Live unreadable process was ignored'
$blocked=$false
try{Get-WallpaperNativeProcessSnapshot $masked -ReadNative {throw 'Exited'} -ReadCurrent {throw 'Query unavailable'}|Out-Null}catch{$blocked=$true}
Assert-Snapshot $blocked 'Failed exit confirmation allowed launch'
Assert-Snapshot ($null -eq (Get-WallpaperNativeProcessSnapshot $masked -ReadNative {throw 'Exited'} -ReadCurrent {})) 'Confirmed gone process blocked drain'
$pending=[InvalidOperationException]::new('Generated pathless process');$pending.Data['WallpaperPathPending']=$true
$script:scanReads=0
$scanned=@(Wait-WallpaperProcessScan -Pause {} -Read {$script:scanReads++;if($script:scanReads -lt 3){throw $pending}})
Assert-Snapshot (-not $scanned.Count -and $script:scanReads -eq 3) 'One entry could not wait for a pathless process to disappear'
$script:scanReads=0;$blocked=$false
try{Wait-WallpaperProcessScan -Checks 2 -Pause {} -Read {$script:scanReads++;throw $pending}|Out-Null}catch{$blocked=$true}
Assert-Snapshot ($blocked -and $script:scanReads -eq 3) 'Live unreadable process did not stop at the bound'
$script:scanReads=0;$blocked=$false
try{Wait-WallpaperProcessScan -Pause {throw 'Unexpected retry'} -Read {$script:scanReads++;throw 'Provider failed'}|Out-Null}catch{$blocked=$true}
Assert-Snapshot ($blocked -and $script:scanReads -eq 1) 'Unrelated provider failure was retried'

# A naturally exited real child remains in an older enumeration snapshot.
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path
$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
$info.ArgumentList.Add('-NoProfile');$info.ArgumentList.Add('-Command');$info.ArgumentList.Add('Start-Sleep -Seconds 2')
$child=[Diagnostics.Process]::Start($info)
try{
  $old=Get-CimInstance Win32_Process -Filter "ProcessId = $($child.Id)" -ErrorAction Stop
  Assert-Snapshot ($null -ne $old) 'Child snapshot fixture unavailable'
  Assert-Snapshot ($child.WaitForExit(10000)) 'Fixture child did not exit naturally'
  Assert-Snapshot ($null -eq (Get-WallpaperExactUpdateSnapshot $old)) 'Exited update root snapshot still threw'
}finally{$child.Dispose()}

# Reproduce the close-drain failure through the actual selection layer.
& {
  $path='C:\Program Files\WindowsApps\OpenAI.Codex_26.1.1.1_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
  Set-WallpaperTrustedPackageRoots @([pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';PackageRoot=(Split-Path -Parent (Split-Path -Parent $path))})
  $gone=[pscustomobject]@{Name='ChatGPT.exe';ProcessId=222;SessionId=1;ExecutablePath=$null;CreationDate=[datetime]::UtcNow;CommandLine='--type=renderer'}
  function Get-WallpaperNativeProcessSnapshot {param($Cim) return $null}
  $script:closeCount=0
  $result=Invoke-WallpaperUpdateCloseOnce -Close {$script:closeCount++;$true} -NewRoot {$false} -Remaining {@(Select-WallpaperCodexProcesses @($gone) 1).Count -gt 0}
  Assert-Snapshot ($result -eq 'ready-to-relaunch' -and $script:closeCount -eq 1) 'Exited pathless helper still broke close-once handoff'
  function Get-WallpaperNativeProcessSnapshot {param($Cim) [pscustomobject]@{path=$path}}
  Assert-Snapshot (@(Select-WallpaperCodexProcesses @($gone) 1).Count -eq 1) 'Verified native fallback was discarded'
}
Write-Output 'PASS: native path recovery, exact identity/session/PID reuse guards, unreadable-live blocking, confirmed exit, real exited-child snapshot and close-once drain.'
