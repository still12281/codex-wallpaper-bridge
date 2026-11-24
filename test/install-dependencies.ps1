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
$aliasRoot=Join-Path $root 'local-app-data'
$alias=Join-Path $aliasRoot 'Microsoft/WindowsApps/pwsh.exe'
New-VersionFixture $alias '7'
$previousLocal=$env:LOCALAPPDATA;$previousPrograms=$env:ProgramFiles;$previousPwsh=$env:CODEX_WALLPAPER_PWSH
try{
  $env:LOCALAPPDATA=$aliasRoot;$env:ProgramFiles=Join-Path $root 'programs'
  $env:PATH=(Split-Path -Parent $oldNode);$env:CODEX_WALLPAPER_PWSH=$null
  Assert-Dependency ((Get-WallpaperInstallDependency pwsh) -ieq $alias) 'PowerShell app alias was missed without a refreshed PATH'
}finally{
  $env:LOCALAPPDATA=$previousLocal;$env:ProgramFiles=$previousPrograms
  $env:PATH=$previousPath;$env:CODEX_WALLPAPER_PWSH=$previousPwsh
}
function New-CaptureFixture([string]$File,[string]$Body){
  [void][IO.Directory]::CreateDirectory((Split-Path -Parent $File))
  $source=$File+'.cs'
  [IO.File]::WriteAllText($source,('public static class Fixture { public static int Main(string[] args) { '+$Body+' } }'))
  & $compiler /nologo /target:exe ('/out:'+$File) $source
  if($LASTEXITCODE){throw 'Capture test fixture compilation failed'}
}
$captureData=Join-Path $root 'capture-data'
$blockedPython=Join-Path $root 'blocked/python3.12.exe'
$usablePython=Join-Path $root 'usable/python.exe'
$preparedPython=Join-Path $captureData 'capture-cache/prepared/python.exe'
$mockUv=Join-Path $root 'mock/uv.exe'
New-CaptureFixture $blockedPython 'System.Console.Error.WriteLine("Unavailable Python (448)"); return 1;'
foreach($python in $usablePython,$preparedPython) {
  New-CaptureFixture $python 'System.Console.WriteLine(System.Reflection.Assembly.GetExecutingAssembly().Location); return 0;'
}
New-CaptureFixture $mockUv 'if(args[0]=="sync") return System.Array.IndexOf(args,System.Environment.GetEnvironmentVariable("CWB_FIXTURE_PYTHON"))>=0 ? 0 : 2; if(args[0]!="run") return 3; System.Console.WriteLine(System.Environment.GetEnvironmentVariable("CWB_FIXTURE_RUNTIME")); return 0;'
$oldEnv=@{}
foreach($name in 'LOCALAPPDATA','ProgramFiles','PATH','UV_CACHE_DIR','UV_PYTHON_INSTALL_DIR','CODEX_WALLPAPER_DATA_DIR','CODEX_WALLPAPER_PYTHON','CODEX_WALLPAPER_UV','CWB_FIXTURE_PYTHON','CWB_FIXTURE_RUNTIME'){
  $oldEnv[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
}
try{
  $env:LOCALAPPDATA=Join-Path $root 'fixture-local';$env:ProgramFiles=Join-Path $root 'fixture-programs'
  $env:PATH=(Split-Path -Parent $blockedPython)+';'+(Split-Path -Parent $usablePython)
  $env:CODEX_WALLPAPER_DATA_DIR=$captureData;$env:CODEX_WALLPAPER_PYTHON=$null;$env:CODEX_WALLPAPER_UV=$mockUv
  $env:CWB_FIXTURE_PYTHON=$usablePython;$env:CWB_FIXTURE_RUNTIME=$preparedPython
  $prepare=Join-Path $PSScriptRoot '../windows/Prepare-Realtime.ps1'
  $out=& $prepare
  Assert-Dependency (($out -join ' ').Contains($usablePython)) 'A failed Python masked the working interpreter'
  $env:CODEX_WALLPAPER_UV=Join-Path $root 'unavailable/uv.exe'
  $out=& $prepare
  Assert-Dependency (($out -join ' ').Contains('Reusing the verified native capture environment')) 'The published runtime was not reused'
}finally{
  foreach($name in $oldEnv.Keys){[Environment]::SetEnvironmentVariable($name,$oldEnv[$name],'Process')}
}
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
Write-Output 'PASS: PowerShell alias, FFmpeg/ffprobe, runtime fallback and reuse, explicit overrides and concurrent-install rejection. No dependencies installed.'
