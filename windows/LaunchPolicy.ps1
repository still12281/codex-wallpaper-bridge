# Keep launch policy independent of package version and of the wallpaper profile.
function Get-WallpaperRegisteredCodex {
  $installed=@(Get-DreamSkinRegisteredCodexInstalls | Where-Object {$_.PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and $_.SignatureKind -eq 'Store'})
  if(-not $installed.Count){throw 'The verified official OpenAI.Codex package is not installed for this user.'}
  return $installed[0]
}
function Set-WallpaperTrustedPackageRoots([object[]]$Installs) {
  $script:WallpaperTrustedPackageRoots=@($Installs | Where-Object {$_.PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and $_.SignatureKind -eq 'Store'} | ForEach-Object {[IO.Path]::GetFullPath((Split-Path -Parent $_.PackageRoot)).TrimEnd('\')} | Select-Object -Unique)
}
function Get-WallpaperTrustedPackageRoots {
  if(-not (Get-Variable WallpaperTrustedPackageRoots -Scope Script -ErrorAction SilentlyContinue)){
    if(Get-Command Get-DreamSkinRegisteredCodexInstalls -ErrorAction SilentlyContinue){Set-WallpaperTrustedPackageRoots @(Get-DreamSkinRegisteredCodexInstalls)}
    else{
      $packages=@(Get-AppxPackage -Name OpenAI.Codex -ErrorAction Stop | Where-Object {$_.PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and $_.SignatureKind -eq 'Store' -and -not $_.IsDevelopmentMode} | ForEach-Object {[pscustomobject]@{PackageRoot=$_.InstallLocation;PackageFamilyName=$_.PackageFamilyName;SignatureKind=$_.SignatureKind}})
      Set-WallpaperTrustedPackageRoots $packages
    }
  }
  return $script:WallpaperTrustedPackageRoots
}
function Test-WallpaperOfficialCodexPath([string]$Path) {
  try{
    if(-not [IO.Path]::IsPathFullyQualified($Path)){return $false}
    $full=[IO.Path]::GetFullPath($Path)
    if($full -inotmatch '\\OpenAI\.Codex_\d+\.\d+\.\d+\.\d+_(x64|arm64)__2p2nqsd0c76g0\\app\\ChatGPT\.exe$'){return $false}
    $package=Split-Path -Parent (Split-Path -Parent $full)
    return (Split-Path -Parent $package).TrimEnd('\') -iin @(Get-WallpaperTrustedPackageRoots)
  }catch{return $false}
}

function Test-WallpaperHostScript([string]$CommandLine,[string]$Root,[string]$CodeRoot) {
  $known=@((Join-Path $CodeRoot 'src/video-cdp-host.mjs'),(Join-Path $Root 'app/src/video-cdp-host.mjs'),(Join-Path $Root 'video-cdp-host.mjs')) | ForEach-Object {[IO.Path]::GetFullPath($_)}
  $versionPrefix=[regex]::Escape(([IO.Path]::GetFullPath($Root).TrimEnd('\')+'\versions\'))
  foreach($token in [regex]::Matches($CommandLine,'"([^"]*)"|([^\s"]+)')){
    $value=if($token.Groups[1].Success){$token.Groups[1].Value}else{$token.Groups[2].Value}
    if(-not [IO.Path]::IsPathFullyQualified($value) -or ($value -split '[\\/]') -contains '..'){continue}
    try{$candidate=[IO.Path]::GetFullPath($value)}catch{continue}
    if($candidate -iin $known -or $candidate -imatch ('^'+$versionPrefix+'release-[0-9a-f]{16}\\src\\video-cdp-host\.mjs$')){return $true}
  }
  return $false
}
function Get-WallpaperHostDecision {
  param($Process,$Status,[string]$Root,[string]$CodeRoot,[string]$Node,[string]$BrowserId,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow)
  if(-not $Process -or [int]$Process.ProcessId -ne [int]$Status.pid -or -not (Test-WallpaperHostScript $Process.CommandLine $Root $CodeRoot)){return 'absent'}
  if($Process.ExecutablePath -ine $Node){return 'conflict'}
  try{$age=($Now-[DateTimeOffset]$Status.updatedAt).TotalSeconds}catch{return 'conflict'}
  if($Status.browserId -ceq $BrowserId -and $age -ge 0 -and $age -lt 12){return 'reuse'}
  return 'conflict'
}
function Select-WallpaperOwnedHosts([object[]]$Processes,[string]$Root,[string]$CodeRoot) {
  @($Processes | Where-Object {$_.Name -ieq 'node.exe' -and (Test-WallpaperHostScript $_.CommandLine $Root $CodeRoot)})
}

function Select-WallpaperCodexProcesses([object[]]$Processes,[int]$SessionId) {
  foreach($candidate in @($Processes | Where-Object {$_.Name -ieq 'ChatGPT.exe' -and [int]$_.SessionId -eq $SessionId})){
    if(-not $candidate.ExecutablePath){throw '无法确认现有 ChatGPT 进程的路径，已停止启动，避免重复实例。'}
    if($candidate.ExecutablePath -imatch '\\OpenAI\.Codex_\d+\.\d+\.\d+\.\d+_(x64|arm64)__2p2nqsd0c76g0\\app\\ChatGPT\.exe$' -and -not (Test-WallpaperOfficialCodexPath $candidate.ExecutablePath)){
      throw '已有类似官方 Codex 的进程，但安装根不在当前可信登记中；已保留该进程并停止启动第二份。'
    }
  }
  @($Processes | Where-Object {
    $_.Name -ieq 'ChatGPT.exe' -and [int]$_.SessionId -eq $SessionId -and
    (Test-WallpaperOfficialCodexPath "$($_.ExecutablePath)")
  })
}

function Get-WallpaperCodexProcesses {
  $currentSession=(Get-Process -Id $PID -ErrorAction Stop).SessionId
  Select-WallpaperCodexProcesses @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction Stop) $currentSession
}

function Assert-WallpaperClientAbsent([object[]]$Processes,[int]$AllowedProcessId=0) {
  # Unknown command lines are treated as main processes, rather than ignored.
  $clients=@($Processes | Where-Object {[int]$_.ProcessId -ne $AllowedProcessId -and "$($_.CommandLine)" -notmatch '--type=|--monitor-self'})
  if($clients.Count -gt 0){throw '已有 Codex 主实例（可能来自更新前的版本），已停止启动第二份。请先正常退出当前客户端。'}
}

function Get-WallpaperDebugArguments([int]$Port) {
  # Do not override user-data-dir: ordinary and wallpaper launches must share
  # the official profile and its native single-instance mechanism.
  @('--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$Port")
}

# An explicit entry click can overlap the preceding client's shutdown. Wait a
# bounded number of times without closing anything; a newly appearing main
# process belongs to another activation and must be preserved immediately.
function Wait-WallpaperStartupDrain {
  param([object[]]$Initial,[scriptblock]$ReadSnapshot,[int]$Checks=48,
    [scriptblock]$Pause={Start-Sleep -Milliseconds 250})
  $identities=@($Initial | ForEach-Object {'{0}|{1}|{2}' -f $_.Id,$_.Created,$_.Path})
  for($index=0;$index -le $Checks;$index++){
    $current=@(& $ReadSnapshot)
    $mains=@($current | Where-Object {-not $_.PSObject.Properties['IsMain'] -or $_.IsMain})
    $newMains=@($mains | Where-Object {('{0}|{1}|{2}' -f $_.Id,$_.Created,$_.Path) -notin $identities})
    if($newMains.Count){return [pscustomobject]@{reason='new-client-preserved';remaining=$current}}
    if(-not $current.Count){return [pscustomobject]@{reason='exit-completed';remaining=@()}}
    if($index -eq $Checks){return [pscustomobject]@{reason=$(if($mains.Count){'client-still-running'}else{'helpers-only'});remaining=$current}}
    & $Pause
  }
}
function Get-WallpaperFailureRecovery {
  param([bool]$CreatedVerifiedClient,[object[]]$Remaining=@())
  if($Remaining.Count){return 'existing-client-preserved'}
  if($CreatedVerifiedClient){return 'reopen-normal-client'}
  return 'no-client-started-before-failure'
}

function Get-WallpaperCdpProbePorts([string]$Root) {
  $ports=@()
  foreach($name in @('cdp-endpoint.json','runtime-status.json')){
    try{
      $record=Get-Content -LiteralPath (Join-Path $Root $name) -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop
      if($name -eq 'cdp-endpoint.json'){
        if($record.schemaVersion -ne 1 -or $record.address -cne '127.0.0.1'){continue}
        $value=$record.port
      }else{$value=$record.cdpPort}
      if(($value -is [int] -or $value -is [long]) -and $value -ge 9335 -and $value -le 9354){$ports+=[int]$value}
    }catch{}
  }
  @($ports+@(9335)|Select-Object -Unique)
}
function Get-WallpaperVerifiedEndpoint {
  param([int]$Port,$Codex)
  $listeners=@(Get-DreamSkinPortListeners -Port $Port)
  if(-not $listeners.Count -or @($listeners|Where-Object LocalAddress -notin @('127.0.0.1','::1')).Count){return $null}
  $owners=@($listeners.OwningProcess|Select-Object -Unique)
  if($owners.Count -ne 1){return $null}
  $owner=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$owners[0])" -ErrorAction SilentlyContinue
  $session=(Get-Process -Id $PID -ErrorAction Stop).SessionId
  if(-not $owner -or $owner.SessionId -ne $session -or $owner.CommandLine -match '--type=|--monitor-self' -or
    -not (Test-DreamSkinPathEqual -Left "$($owner.ExecutablePath)" -Right "$($Codex.Executable)")){return $null}
  $identity=Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $Codex
  if(-not $identity){return $null}
  $fresh=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$owners[0])" -ErrorAction SilentlyContinue
  if(-not $fresh -or $fresh.CreationDate -ne $owner.CreationDate -or $fresh.SessionId -ne $session -or $fresh.ExecutablePath -ine $owner.ExecutablePath){return $null}
  $native=$null
  try{
    $native=Get-Process -Id ([int]$owners[0]) -ErrorAction Stop
    # CIM timestamps have microsecond precision; native StartTime keeps 100ns.
    if($native.HasExited -or $native.SessionId -ne $session -or $native.MainModule.FileName -ine $owner.ExecutablePath -or [math]::Abs($native.StartTime.ToUniversalTime().Ticks-$owner.CreationDate.ToUniversalTime().Ticks) -gt 10){return $null}
    [pscustomobject]@{BrowserId=$identity.BrowserId;BrowserWebSocketDebuggerUrl=$identity.BrowserWebSocketDebuggerUrl;Browser=$identity.Browser;TargetCount=$identity.TargetCount;RootProcessId=[int]$owners[0];RootCreatedAtUtc=$native.StartTime.ToUniversalTime().ToString('o');RootExecutable=$owner.ExecutablePath;SessionId=$session}
  }catch{return $null}finally{if($native){$native.Dispose()}}
}
function Select-WallpaperCdpEndpoint {
  param([string]$Root,$Codex,[int[]]$Candidates=@(9335..9354),
    [scriptblock]$Probe={param($Port,$Install) Get-WallpaperVerifiedEndpoint -Port $Port -Codex $Install},
    [scriptblock]$Available={param($Port) Test-DreamSkinPortAvailable -Port $Port})
  foreach($port in @(Get-WallpaperCdpProbePorts $Root)){
    if($port -notin $Candidates){continue}
    $identity=& $Probe $port $Codex
    if($identity){return [pscustomobject]@{port=$port;identity=$identity;reason='verified-client-reused'}}
  }
  foreach($port in $Candidates){if(& $Available $port){return [pscustomobject]@{port=$port;identity=$null;reason=$(if($port -eq 9335){'default-port-available'}else{'occupied-port-preserved'})}}}
  throw '壁纸连接候选端口 9335–9354 均不可用；未结束或修改任何占用进程。'
}
function Get-WallpaperVerifiedEndpointForAnyRegistered([string]$Root) {
  foreach($port in @(Get-WallpaperCdpProbePorts $Root)){
    foreach($install in @(Get-DreamSkinRegisteredCodexInstalls|Where-Object {$_.PackageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and $_.SignatureKind -eq 'Store'})){
      $identity=Get-WallpaperVerifiedEndpoint -Port $port -Codex $install
      if($identity){return [pscustomobject]@{Identity=$identity;Codex=$install;Port=$port}}
    }
  }
  return $null
}
function Save-WallpaperCdpEndpoint([string]$Root,[int]$Port,$Identity) {
  if($Port -lt 9335 -or $Port -gt 9354 -or -not $Identity.BrowserId -or $Identity.RootProcessId -le 0){throw 'Cannot save an unverified wallpaper endpoint'}
  $record=[ordered]@{schemaVersion=1;address='127.0.0.1';port=$Port;browserId=$Identity.BrowserId;processId=$Identity.RootProcessId;createdAtUtc=$Identity.RootCreatedAtUtc;executable=$Identity.RootExecutable;sessionId=$Identity.SessionId;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
  $file=Join-Path $Root 'cdp-endpoint.json';$next=$file+'.next'
  [IO.File]::WriteAllText($next,($record|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false));[IO.File]::Move($next,$file,$true)
}
