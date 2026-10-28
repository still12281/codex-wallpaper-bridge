$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/InstallSupport.ps1')
function Assert-Dependency($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-dependencies-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory($root)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
function New-VersionFixture([string]$File,[string]$Version){
  [void][IO.Directory]::CreateDirectory((Split-Path -Parent $File));$source=$File+'.cs'
  [IO.File]::WriteAllText($source,('public static class Program { public static void Main() { System.Console.WriteLine("'+$Version+'"); } }'))
  & $compiler /nologo /target:exe ('/out:'+$File) $source
  if($LASTEXITCODE -ne 0){throw 'Version fixture compilation failed'}
}
$ffmpeg=Join-Path $root 'media/ffmpeg.exe';New-VersionFixture $ffmpeg 'ffmpeg version fixture'
Assert-Dependency (-not (Test-WallpaperInstallDependency ffmpeg $ffmpeg)) 'FFmpeg without ffprobe was accepted'
New-VersionFixture (Join-Path $root 'media/ffprobe.exe') 'ffprobe version fixture'
Assert-Dependency (Test-WallpaperInstallDependency ffmpeg $ffmpeg) 'Complete FFmpeg pair was rejected'
$oldNode=Join-Path $root 'old/node.exe';$newNode=Join-Path $root 'new/node.exe'
New-VersionFixture $oldNode 'v20.0.0';New-VersionFixture $newNode 'v24.0.0'
$previous=$env:CODEX_WALLPAPER_NODE;$previousPath=$env:PATH
try{
  $env:CODEX_WALLPAPER_NODE=$null
  $env:PATH=(Split-Path -Parent $oldNode)+';'+(Split-Path -Parent $newNode)+';'+$previousPath
  $candidates=@(Get-WallpaperInstallCandidates node)
  Assert-Dependency ($candidates -icontains $oldNode -and $candidates -icontains $newNode) 'Discovery ignored a later PATH runtime'
  Assert-Dependency ((Get-WallpaperInstallDependency node) -ieq $newNode) 'Old PATH candidate masked the usable runtime'
  $env:CODEX_WALLPAPER_NODE=$oldNode;$rejected=$false
  try{Get-WallpaperInstallDependency node|Out-Null}catch{$rejected=$true}
  Assert-Dependency $rejected 'Invalid explicit override was silently ignored'
}finally{$env:CODEX_WALLPAPER_NODE=$previous;$env:PATH=$previousPath}
$mutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.Install');$owned=$false
try{
  $owned=$mutex.WaitOne(0);Assert-Dependency $owned 'Another installation is already active'
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path
  $script=Join-Path $PSScriptRoot '../windows/Install-Wallpaper.ps1'
  $info.Arguments='-NoProfile -File "'+$script+'" -DataDirectory "'+(Join-Path $root 'data')+'" -NoShortcuts -NonInteractive -SkipDependencyInstall -SkipPreparation'
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $child=[Diagnostics.Process]::Start($info)
  try{$output=$child.StandardOutput.ReadToEndAsync();$errorOutput=$child.StandardError.ReadToEndAsync();if(-not $child.WaitForExit(20000)){$child.Kill();throw 'Install lock test timed out'};Assert-Dependency ($child.ExitCode -ne 0 -and ($output.Result+$errorOutput.Result).Contains('Another wallpaper installation is running')) 'Concurrent installer was not blocked before changing state'}finally{$child.Dispose()}
}finally{if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
Write-Output 'PASS: FFmpeg/ffprobe pair, old runtime fallback, explicit override and concurrent-install rejection. No dependencies installed.'
