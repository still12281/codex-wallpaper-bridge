# Dependency discovery and installer helpers for PowerShell 7.
function Update-WallpaperInstallPath {
  $env:PATH=$env:PATH+';'+[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
}
function Resolve-WallpaperInstallChoices {
  param([string]$ShortcutMode='ask',[string]$UpdateReconnect='ask',$Existing,[switch]$NonInteractive,[scriptblock]$ReadChoice={param($Question) Read-Host $Question})
  if($ShortcutMode -eq 'ask'){
    if($Existing.shortcutMode -in @('separate','replace','none')){$ShortcutMode=$Existing.shortcutMode}
    elseif($NonInteractive){$ShortcutMode='separate'}
    else{do{$answer=& $ReadChoice 'Shortcut: 1 = new Codex Wallpaper entry (default), 2 = replace identified original Codex shortcuts with backup'}while($answer -notin @('','1','2'));$ShortcutMode=if($answer -eq '2'){'replace'}else{'separate'}}
  }
  if($UpdateReconnect -eq 'ask'){
    if($Existing -or $NonInteractive){$UpdateReconnect='keep'}
    else{do{$answer=& $ReadChoice 'Enable recovery after future Codex updates? It may request ONE normal close/reconnect after an update; no forced close or resident watcher. y/N'}while($answer -notin @('','y','Y','n','N'));$UpdateReconnect=if($answer -in @('y','Y')){'enable'}else{'keep'}}
  }
  [pscustomobject]@{shortcutMode=$ShortcutMode;updateReconnect=$UpdateReconnect}
}
function Get-WallpaperInstallDependency([string]$Name) {
  $variable=@{node='CODEX_WALLPAPER_NODE';pwsh='CODEX_WALLPAPER_PWSH';ffmpeg='CODEX_WALLPAPER_FFMPEG';uv='CODEX_WALLPAPER_UV'}[$Name]
  $override=[Environment]::GetEnvironmentVariable($variable,'Process')
  if($override){
    if(-not (Test-Path -LiteralPath $override -PathType Leaf) -or -not (Test-WallpaperInstallDependency $Name $override)){
      $detail=if($Name -eq 'ffmpeg'){' FFmpeg requires a working ffprobe.exe in the same directory.'}else{''}
      throw "Invalid $variable executable/version.$detail"
    }
    return [IO.Path]::GetFullPath($override)
  }
  foreach($candidate in @(Get-WallpaperInstallCandidates $Name)){if((Test-Path -LiteralPath $candidate -PathType Leaf) -and (Test-WallpaperInstallDependency $Name $candidate)){return [IO.Path]::GetFullPath($candidate)}}
  return $null
}
function Get-WallpaperInstallCandidates([string]$Name) {
  $commands=@(Get-Command ($Name+'.exe') -All -CommandType Application -ErrorAction SilentlyContinue)
  $candidates=@($commands|ForEach-Object Source)
  switch($Name){
    node {$candidates+=Join-Path $env:ProgramFiles 'nodejs/node.exe'}
    pwsh {$candidates+=Join-Path $env:ProgramFiles 'PowerShell/7/pwsh.exe'}
    uv {$candidates+=Join-Path $env:USERPROFILE '.local/bin/uv.exe'}
  }
  $candidates+=Join-Path $env:LOCALAPPDATA ('Microsoft/WinGet/Links/'+$Name+'.exe')
  if($Name -eq 'ffmpeg'){
    $packages=Join-Path $env:LOCALAPPDATA 'Microsoft/WinGet/Packages'
    if(Test-Path -LiteralPath $packages){foreach($package in Get-ChildItem -LiteralPath $packages -Directory -ErrorAction Stop | Where-Object Name -Like 'Gyan.FFmpeg.*'){
      foreach($folder in Get-ChildItem -LiteralPath $package.FullName -Directory -ErrorAction Stop){$candidates+=Join-Path $folder.FullName 'bin/ffmpeg.exe'}
    }}
  }
  return @($candidates|Select-Object -Unique)
}
function Test-WallpaperInstallDependency([string]$Name,[string]$Executable) {
  if(-not $Executable){return $false}
  try{
    $info=New-Object Diagnostics.ProcessStartInfo
    $info.FileName=$Executable;$info.Arguments=if($Name -eq 'pwsh'){'-NoProfile -Command "$PSVersionTable.PSVersion.Major"'}elseif($Name -in @('ffmpeg','ffprobe')){'-version'}else{'--version'}
    $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $process=New-Object Diagnostics.Process;$process.StartInfo=$info
    try{
      [void]$process.Start();$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
      if(-not $process.WaitForExit(15000)){$process.Kill();return $false}
      $output=$stdout.Result+$stderr.Result
      if($process.ExitCode -ne 0){return $false}
    }finally{$process.Dispose()}
    if($Name -eq 'pwsh'){return [int]$output.Trim() -ge 7}
    if($Name -eq 'node'){return "$output" -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22}
    if($Name -eq 'ffmpeg'){
      $probe=Join-Path (Split-Path -Parent $Executable) 'ffprobe.exe'
      return "$output" -match 'ffmpeg version' -and (Test-Path -LiteralPath $probe -PathType Leaf) -and (Test-WallpaperInstallDependency 'ffprobe' $probe)
    }
    if($Name -eq 'ffprobe'){return "$output" -match 'ffprobe version'}
    return "$output" -match $(if($Name -eq 'uv'){'^uv \d+\.'}else{'ffmpeg version'})
  }catch{return $false}
}
function Install-WallpaperReplacementShortcuts {
  param([string]$Root,[string]$CodexAppId,[string]$DesktopDirectory=[Environment]::GetFolderPath('Desktop'),[string[]]$Candidates)
  $arguments=@{Root=$Root;CodexAppId=$CodexAppId}
  if($PSBoundParameters.ContainsKey('Candidates')){$arguments.Candidates=$Candidates}
  $replaced=@(Repair-WallpaperEntryShortcuts @arguments)
  if(@($replaced|Where-Object error).Count){throw 'Some shortcuts could not be replaced. Originals are backed up; inspect shortcut-replacements.json.'}
  $entry=Join-Path $Root 'CodexEntry.exe';$desktopLink=Join-Path $DesktopDirectory 'Codex.lnk'
  $paths=@($desktopLink)+@($Candidates)
  $index=Join-Path $Root 'shortcut-replacements.json'
  if(Test-Path -LiteralPath $index){$paths+=@((Get-Content -LiteralPath $index -Raw|ConvertFrom-Json).links|ForEach-Object path)}
  $existing=$false;$shell=New-Object -ComObject WScript.Shell
  try{foreach($file in ($paths|Where-Object {$_ -and (Test-Path -LiteralPath $_)}|Select-Object -Unique)){
    $link=$shell.CreateShortcut($file)
    try{if($link.TargetPath -and [IO.Path]::GetFullPath($link.TargetPath) -ieq [IO.Path]::GetFullPath($entry)){$existing=$true;break}}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
  }}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
  $created=$false
  if(-not @($replaced|Where-Object changed).Count -and -not $existing){Publish-WallpaperInstallShortcut (Join-Path $Root 'Codex.lnk') $desktopLink $entry;$created=$true}
  [pscustomobject]@{replaced=@($replaced|Where-Object changed).Count;existingManaged=$existing;createdFallback=$created}
}
function Publish-WallpaperInstallShortcut([string]$Source,[string]$Destination,[string]$Entry) {
  $shell=New-Object -ComObject WScript.Shell
  if(Test-Path -LiteralPath $Destination){
    $existing=$shell.CreateShortcut($Destination)
    if(-not $existing.TargetPath -or [IO.Path]::GetFullPath($existing.TargetPath) -ine [IO.Path]::GetFullPath($Entry)){throw "Shortcut belongs to another program; preserved: $Destination"}
  }
  [void](New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force -ErrorAction Stop)
  Copy-Item -LiteralPath $Source -Destination $Destination -Force -ErrorAction Stop
}
