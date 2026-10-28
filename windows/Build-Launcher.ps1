[CmdletBinding()]
param([switch]$NoIcon)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$buildDataRoot = Get-WallpaperDataRoot
$buildRepoRoot = Split-Path -Parent $PSScriptRoot
$buildCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $buildCompiler)) { throw '.NET Framework C# compiler not found' }
$buildArguments = @('/nologo','/target:winexe','/platform:x64','/reference:System.Web.Extensions.dll','/reference:System.Windows.Forms.dll',('/out:' + (Join-Path $buildDataRoot 'CodexEntry.exe')),(Join-Path $PSScriptRoot 'TaskbarIdentity.cs'))
if (-not $NoIcon) {
  . (Join-Path $buildRepoRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
  . (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')
  $buildCodex = Get-WallpaperRegisteredCodex
  . (Join-Path $PSScriptRoot 'Official-Icon.ps1')
  $buildIconPath = Join-Path $buildDataRoot 'Codex.ico'
  [void](Copy-WallpaperOfficialIcon $buildCodex $buildIconPath)
  $buildArguments += ('/win32icon:' + $buildIconPath)
}
$buildArguments += (Join-Path $PSScriptRoot 'CodexEntry.cs')
& $buildCompiler @buildArguments
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
& $buildCompiler /nologo /target:exe /platform:x64 ('/out:' + (Join-Path $buildDataRoot 'Align-Taskbar.exe')) (Join-Path $PSScriptRoot 'TaskbarIdentity.cs') (Join-Path $PSScriptRoot 'Align-Taskbar.cs')
if ($LASTEXITCODE -ne 0) { throw 'Taskbar helper compilation failed' }
$buildPowerShell=(Get-Process -Id $PID -ErrorAction Stop).Path
if($PSVersionTable.PSVersion.Major -lt 7 -or [IO.Path]::GetFileName($buildPowerShell) -ine 'pwsh.exe'){throw 'Build using PowerShell 7 so its actual runtime path can be recorded.'}
$buildRuntime=[ordered]@{schemaVersion=1;powerShell=$buildPowerShell;node=(Get-WallpaperNode)}
foreach($optional in @(@{key='ffmpeg';value=$env:CODEX_WALLPAPER_FFMPEG},@{key='uv';value=$env:CODEX_WALLPAPER_UV})){
  if($optional.value){if(-not (Test-Path -LiteralPath $optional.value -PathType Leaf)){throw ('Optional executable not found: '+$optional.key)};$buildRuntime[$optional.key]=[IO.Path]::GetFullPath($optional.value)}
}
$buildRuntime | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $buildDataRoot 'launcher-runtime.json') -Encoding utf8 -ErrorAction Stop
[IO.File]::WriteAllText((Join-Path $buildDataRoot 'launch-script.txt'),(Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'),[Text.UTF8Encoding]::new($false))
Write-Output "Built launcher in $buildDataRoot. No shortcut was changed and no app was started."
