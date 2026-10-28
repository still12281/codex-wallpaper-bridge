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
