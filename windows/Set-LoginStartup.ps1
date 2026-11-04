[CmdletBinding()]
param([string]$Root,[ValidateSet('enable','disable','inspect')][string]$Mode='inspect')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'LoginStartup.ps1')
. (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
if(-not $Root){$Root=if($env:CODEX_WALLPAPER_DATA_DIR){$env:CODEX_WALLPAPER_DATA_DIR}else{Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodexWallpaperBridge'}}
if(-not [IO.Path]::IsPathFullyQualified($Root)){throw 'Root must be absolute.'}
$codex=Get-WallpaperRegisteredCodex
[xml]$manifest=Get-Content -LiteralPath (Join-Path $codex.PackageRoot 'AppxManifest.xml') -Raw -ErrorAction Stop
$tasks=@($manifest.SelectNodes('//*[local-name()="Extension" and @Category="windows.startupTask"]') | Where-Object {
  $executable=$_.GetAttribute('Executable').Replace('/',[IO.Path]::DirectorySeparatorChar)
  $executable -and [IO.Path]::GetFullPath((Join-Path $codex.PackageRoot $executable)) -ieq [IO.Path]::GetFullPath($codex.Executable)
} | ForEach-Object {$_.SelectNodes('*[local-name()="StartupTask"]')})
if($tasks.Count -ne 1 -or $tasks[0].TaskId -notmatch '^[a-zA-Z0-9_.-]+$'){throw 'Cannot identify one official Codex login startup task; no changes made.'}
$registry='HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\'+$codex.PackageFamilyName+'\'+$tasks[0].TaskId
$mutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.LoginStartup');$locked=$false
try{
  try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
  if(-not $locked){throw 'Another login startup configuration is running.'}
  Set-WallpaperLoginStartup -Root $Root -StartupDirectory ([Environment]::GetFolderPath('Startup')) -RegistryPath $registry -Mode $Mode | ConvertTo-Json -Depth 5
}finally{if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
