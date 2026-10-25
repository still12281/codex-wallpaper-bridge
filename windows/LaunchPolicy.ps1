# Keep launch policy independent of package version and of the wallpaper profile.
function Test-WallpaperOfficialCodexPath([string]$Path) {
  return $Path -imatch '^[A-Z]:\\(?:[^\\]+\\)*WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\ChatGPT\.exe$'
}

function Select-WallpaperCodexProcesses([object[]]$Processes,[int]$SessionId) {
  foreach($candidate in @($Processes | Where-Object {$_.Name -ieq 'ChatGPT.exe' -and [int]$_.SessionId -eq $SessionId})){
    if(-not $candidate.ExecutablePath){throw '无法确认现有 ChatGPT 进程的路径，已停止启动，避免重复实例。'}
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
