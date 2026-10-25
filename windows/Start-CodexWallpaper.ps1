[CmdletBinding()]
param([switch]$RestartCurrent,[switch]$WaitForClientExit,[switch]$InspectOnly,[string]$TaskName)

$ErrorActionPreference = 'Stop'
$taskCodeRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Runtime.ps1')
. (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')
$taskRoot = Get-WallpaperDataRoot
$taskNode = Get-WallpaperNode
. (Join-Path $taskCodeRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
$taskStatusPath = Join-Path $taskRoot 'launch-status.json'
$taskStatus = [ordered]@{launchId=[guid]::NewGuid().ToString();startedAt=[DateTimeOffset]::Now.ToString('o');phase='preparing';helperPid=$PID;sessionId=(Get-Process -Id $PID).SessionId;appFilesModified=$false;configModified=$false}
$taskStatus.helperStartedAtUtc=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o')
$taskStatus.lifecycle='one-shot-no-supervisor'
$taskOwnedRoot = $null
$taskBootstrapLock=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridgeBootstrap')
$taskLockOwned=$false
try{$taskLockOwned=$taskBootstrapLock.WaitOne(0)}catch [Threading.AbandonedMutexException]{$taskLockOwned=$true}
if(-not $taskLockOwned){$taskBootstrapLock.Dispose();exit 0}
$taskCodex = Get-DreamSkinCodexInstall
$taskStatus.codexVersion="$($taskCodex.Version)"
$taskStatus.packageFullName="$($taskCodex.PackageFullName)"
$taskStatus.profileMode='official-default'

function Save-TaskPhase([string]$Phase) {
  $taskStatus.phase = $Phase
  $taskStatus.updatedAt = [DateTimeOffset]::Now.ToString('o')
  $taskTemp=$taskStatusPath+'.next'
  $taskStatus | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $taskTemp -Encoding utf8 -ErrorAction Stop
  # PowerShell can marshal $null to an empty backup path for File.Replace.
  # A same-directory overwrite move also handles both first and repeated starts.
  [IO.File]::Move($taskTemp,$taskStatusPath,$true)
}
function Get-TaskSnapshot {
  @(Get-WallpaperCodexProcesses | ForEach-Object {
    [pscustomobject]@{Id=[int]$_.ProcessId;Parent=[int]$_.ParentProcessId;Created=$_.CreationDate.ToUniversalTime().Ticks;Path="$($_.ExecutablePath)";IsMain=("$($_.CommandLine)" -notmatch '--type=|--monitor-self')}
  })
}
function Get-TaskMatchingProcess($Snapshot) {
  try {
    $taskCandidate = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$Snapshot.Id)" -ErrorAction Stop
    if ($taskCandidate -and $taskCandidate.CreationDate.ToUniversalTime().Ticks -eq $Snapshot.Created -and
      (Test-WallpaperOfficialCodexPath "$($taskCandidate.ExecutablePath)") -and
      (Test-DreamSkinPathEqual -Left "$($taskCandidate.ExecutablePath)" -Right "$($Snapshot.Path)")) {
      return Get-Process -Id $Snapshot.Id -ErrorAction Stop
    }
  } catch {}
  return $null
}
function Close-TaskSnapshot([object[]]$Snapshots) {
  foreach($taskSnapshot in @($Snapshots | Where-Object IsMain)) {
    $taskProcess = Get-TaskMatchingProcess $taskSnapshot
    if($null -ne $taskProcess) { try { [void]$taskProcess.CloseMainWindow() } finally { $taskProcess.Dispose() } }
  }
  $taskDeadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
  do {
    $taskRemaining = @($Snapshots | Where-Object { $taskProcess=Get-TaskMatchingProcess $_; if($null -ne $taskProcess){$taskProcess.Dispose();$true}else{$false} })
    if($taskRemaining.Count -eq 0) { return }
    Start-Sleep -Milliseconds 250
  } while([DateTimeOffset]::UtcNow -lt $taskDeadline)
  throw 'Codex 未能优雅退出，已停止接入；没有强制终止进程。'
}
function Get-TaskLaunchedRoot([int]$ProcessId,[long]$NotBefore=0) {
  $taskSnapshot=@(Get-TaskSnapshot | Where-Object Id -eq $ProcessId)
  if($taskSnapshot.Count -ne 1){throw '无法确认本轮启动的 Codex 实例身份。'}
  if(-not $taskSnapshot[0].IsMain -or $taskSnapshot[0].Created -lt $NotBefore){throw '启动请求转交给了已有实例，已保留它，不将其当成本轮创建的进程。'}
  return $taskSnapshot[0]
}
function Wait-TaskIdentity([int]$Port,[int]$Seconds=25) {
  $taskDeadline=[DateTimeOffset]::UtcNow.AddSeconds($Seconds)
  do {
    $taskIdentity=Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $taskCodex
    if($null -ne $taskIdentity){return $taskIdentity}
    Start-Sleep -Milliseconds 500
  }while([DateTimeOffset]::UtcNow -lt $taskDeadline)
  return $null
}

try {
  $taskPort=9335
  $taskInitial=@(Get-TaskSnapshot)
  $taskStatus.initialProcessIds=@($taskInitial.Id)
  if($InspectOnly){Save-TaskPhase 'inspect-only';$taskStatus | ConvertTo-Json -Depth 8;exit 0}
  $taskIdentity=Get-DreamSkinVerifiedCdpIdentity -Port $taskPort -Codex $taskCodex
  if($null -eq $taskIdentity) {
    if(-not (Test-DreamSkinPortAvailable -Port $taskPort)){throw '9335 已被其他进程占用，未更改该进程。'}
    if($taskInitial.Count -gt 0 -and $WaitForClientExit) {
      $taskInitialIds=@($taskInitial.Id)
      $taskRoots=@($taskInitial | Where-Object {$_.Parent -notin $taskInitialIds})
      if($taskRoots.Count -eq 0){throw '无法确认应等待的 Codex 主实例，未启动等待。'}
      $taskRootHandles=@()
      foreach($taskRootSnapshot in $taskRoots){
        $taskHandle=Get-TaskMatchingProcess $taskRootSnapshot
        if($null -ne $taskHandle){$taskRootHandles += $taskHandle}
      }
      $taskStatus.waitRootProcessIds=@($taskRoots.Id)
      $taskStatus.waitExpiresAt=$null
      Save-TaskPhase 'waiting-for-user-to-exit-client'
      try {
        $taskHeartbeat=[DateTimeOffset]::UtcNow
        while(@($taskRootHandles | Where-Object {-not $_.HasExited}).Count -gt 0){
          foreach($taskHandle in $taskRootHandles){if(-not $taskHandle.HasExited){[void]$taskHandle.WaitForExit(1000)}}
          if(([DateTimeOffset]::UtcNow-$taskHeartbeat).TotalSeconds -ge 10){
            Save-TaskPhase 'waiting-for-user-to-exit-client'
            $taskHeartbeat=[DateTimeOffset]::UtcNow
          }
        }
      } finally {foreach($taskHandle in $taskRootHandles){$taskHandle.Dispose()}}
      Save-TaskPhase 'observed-current-root-exit'
      $taskDrainDeadline=[DateTimeOffset]::UtcNow.AddSeconds(20)
      do {
        $taskRemainingAfterExit=@(Get-TaskSnapshot)
        if($taskRemainingAfterExit.Count -eq 0){break}
        $taskRemainingIds=@($taskRemainingAfterExit.Id)
        $taskProcessTypes=@(Get-WallpaperCodexProcesses)
        $taskNewMainIds=@($taskProcessTypes | Where-Object {$_.CommandLine -notmatch '--type=' -and $_.CommandLine -notmatch '--monitor-self'} | ForEach-Object {[int]$_.ProcessId})
        $taskNewRoots=@($taskRemainingAfterExit | Where-Object {$_.Id -in $taskNewMainIds -and $_.Id -notin $taskInitialIds})
        if($taskNewRoots.Count -gt 0){throw '用户已经另行启动新的 Codex，已保留该实例，未替换它。'}
        Start-Sleep -Milliseconds 250
      }while([DateTimeOffset]::UtcNow -lt $taskDrainDeadline)
      $taskRemainingMain=@(Get-WallpaperCodexProcesses | Where-Object {$_.CommandLine -notmatch '--type=' -and $_.CommandLine -notmatch '--monitor-self'})
      if($taskRemainingMain.Count -gt 0){throw '检测到仍运行的主实例，保留它并停止替换。'}
      $taskStatus.preservedOrphanProcessIds=@((Get-TaskSnapshot).Id)
      if(-not (Test-DreamSkinPortAvailable -Port $taskPort)){
        throw '退出期间端口被其他进程占用，未启动调试实例。'
      }
      $taskInitial=@()
    }
    if($taskInitial.Count -gt 0) {
      if(-not $RestartCurrent){throw '当前普通 Codex 窗口未接入壁纸。请从壁纸入口确认重新连接；后台恢复不会自动关闭它。'}
      Save-TaskPhase 'closing-existing-client-gracefully'
      Close-TaskSnapshot $taskInitial
      if(@(Get-TaskSnapshot).Count -gt 0){throw '检测到新出现或仍存在的 Codex 实例，已保留，不进行再次关闭。'}
    }
    Assert-WallpaperClientAbsent @(Get-WallpaperCodexProcesses)
    # Store may have registered an update while an older client was exiting.
    $taskCodex=Get-DreamSkinCodexInstall
    $taskStatus.codexVersion="$($taskCodex.Version)"
    $taskStatus.packageFullName="$($taskCodex.PackageFullName)"
    $taskArguments=@(Get-WallpaperDebugArguments $taskPort)
    Save-TaskPhase 'launching-registered-package-with-cdp'
    Assert-WallpaperClientAbsent @(Get-WallpaperCodexProcesses)
    $taskLaunchNotBefore=[DateTime]::UtcNow.Ticks
    $taskLaunchedId=Start-DreamSkinCodex -Codex $taskCodex -Arguments $taskArguments
    $taskOwnedRoot=Get-TaskLaunchedRoot $taskLaunchedId $taskLaunchNotBefore
    $taskStatus.launchStrategy='package-activation'
    $taskIdentity=Wait-TaskIdentity -Port $taskPort
    if($null -eq $taskIdentity) {
      $taskArgumentStatus=Get-DreamSkinCodexDebugArgumentStatus -Processes @(Get-DreamSkinCodexProcesses -Codex $taskCodex) -Port $taskPort
      $taskStatus.packageArgumentStatus="$taskArgumentStatus"
      if($taskArgumentStatus -ne 'protocol-redirected'){throw '官方包未开放已验证的 CDP 端点；停止重复启动。'}
      Save-TaskPhase 'package-redirected-closing-owned-root'
      Close-TaskSnapshot @($taskOwnedRoot)
      $taskOwnedRoot=$null
      if(@(Get-TaskSnapshot).Count -gt 0){throw '出现额外 Codex 实例，保留实例并停止直接启动回退。'}
      Save-TaskPhase 'launching-validated-store-executable'
      Assert-WallpaperClientAbsent @(Get-WallpaperCodexProcesses)
      $taskLaunchNotBefore=[DateTime]::UtcNow.Ticks
      $taskLaunchedId=Start-DreamSkinCodexDirect -Codex $taskCodex -Arguments $taskArguments
      $taskOwnedRoot=Get-TaskLaunchedRoot $taskLaunchedId $taskLaunchNotBefore
      $taskStatus.launchStrategy='validated-store-executable'
      $taskIdentity=Wait-TaskIdentity -Port $taskPort
      if($null -eq $taskIdentity){throw '直接启动后仍无已验证的 CDP 端点；当前 Codex 版本不支持此接入路径。'}
    }
  }
  $taskStatus.browserId="$($taskIdentity.BrowserId)"
  $taskStatus.debugRootPid=[int](@(Get-DreamSkinPortListeners -Port $taskPort)[0].OwningProcess)
  Assert-WallpaperClientAbsent @(Get-WallpaperCodexProcesses) $taskStatus.debugRootPid
  $taskVerifiedRoot=Get-Process -Id $taskStatus.debugRootPid -ErrorAction Stop
  $taskStatus.rootStartedAtUtc=$taskVerifiedRoot.StartTime.ToUniversalTime().ToString('o')
  $taskStatus.rootExecutable=$taskVerifiedRoot.MainModule.FileName
  Save-TaskPhase 'cdp-verified-starting-wallpaper-host'
  $taskRuntime=Join-Path $taskRoot 'runtime-status.json'
  $taskHostAlreadyRunning=$false
  if(Test-Path -LiteralPath $taskRuntime){
    try{$taskPrevious=Get-Content -LiteralPath $taskRuntime -Raw -ErrorAction Stop|ConvertFrom-Json
      $taskProcessInfo=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$taskPrevious.pid)" -ErrorAction Stop
      $taskHostAlreadyRunning=$taskProcessInfo -and $taskProcessInfo.ExecutablePath -ieq $taskNode -and $taskProcessInfo.CommandLine.Contains((Join-Path $taskCodeRoot 'src/video-cdp-host.mjs'))
    }catch{}
  }
  if(-not $taskHostAlreadyRunning){
    $taskHost=Start-Process -FilePath $taskNode -ArgumentList @('--expose-gc','--max-old-space-size=64','--max-semi-space-size=4',('"{0}"' -f (Join-Path $taskCodeRoot 'src/video-cdp-host.mjs')),'--cdp-port',"$taskPort") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'video-output.log') -RedirectStandardError (Join-Path $taskRoot 'video-error.log') -ErrorAction Stop
    $taskStatus.hostPid=$taskHost.Id
  }
  else {$taskStatus.hostPid=[int]$taskPrevious.pid}
  $taskDeadline=[DateTimeOffset]::UtcNow.AddSeconds(45)
  $taskRendered=$false
  do {
    if(Test-Path -LiteralPath $taskRuntime){
      try{$taskRuntimeState=Get-Content -LiteralPath $taskRuntime -Raw -ErrorAction Stop|ConvertFrom-Json
        $taskAge=([DateTimeOffset]::UtcNow-([DateTimeOffset]$taskRuntimeState.updatedAt)).TotalSeconds
        $taskFresh=$taskAge -ge 0 -and $taskAge -lt 12
        if($taskRuntimeState.phase -in @('background-rendered','background-disabled') -and $taskRuntimeState.pid -eq $taskStatus.hostPid -and $taskRuntimeState.browserId -eq $taskIdentity.BrowserId -and $taskFresh){$taskRendered=$true;break}
      }catch{}
    }
    Start-Sleep -Milliseconds 500
  }while([DateTimeOffset]::UtcNow -lt $taskDeadline)
  Save-TaskPhase $(if($taskRendered){'background-rendered'}else{'cdp-ready-background-not-yet-rendered'})
  if($taskLockOwned){$taskBootstrapLock.ReleaseMutex();$taskLockOwned=$false}
  if($TaskName -and $taskRendered -and $taskStatus.hostPid){Wait-Process -Id $taskStatus.hostPid -ErrorAction SilentlyContinue}
}catch {
  $taskStatus.error=$_.Exception.Message
  Save-TaskPhase 'failed'
  try {
    if($null -ne $taskOwnedRoot){Close-TaskSnapshot @($taskOwnedRoot);$taskOwnedRoot=$null}
    if(@(Get-TaskSnapshot).Count -eq 0){
      Assert-WallpaperClientAbsent @(Get-WallpaperCodexProcesses)
      $taskNormalId=Start-DreamSkinCodex -Codex $taskCodex -Arguments @()
      Start-Sleep -Seconds 2
      $taskStatus.recovery=if($null -ne (Get-TaskLaunchedRoot $taskNormalId)){'normal-client-reopened'}else{'normal-client-not-confirmed'}
    }else{$taskStatus.recovery='existing-client-preserved'}
  }catch{$taskStatus.recovery='client-left-available-or-close-not-confirmed';$taskStatus.recoveryError=$_.Exception.Message}
  Save-TaskPhase 'failed'
}finally {
  if($taskLockOwned){$taskBootstrapLock.ReleaseMutex()}
  $taskBootstrapLock.Dispose()
  if($TaskName){try{Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop|Out-Null}catch{}}
}
