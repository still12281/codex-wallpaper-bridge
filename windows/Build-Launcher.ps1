[CmdletBinding()]
param([switch]$NoIcon)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$buildDataRoot = Get-WallpaperDataRoot
$buildRepoRoot = Split-Path -Parent $PSScriptRoot
$buildCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $buildCompiler)) { throw '.NET Framework C# compiler not found' }
$buildArguments = @('/nologo','/target:winexe','/platform:x64',('/out:' + (Join-Path $buildDataRoot 'CodexEntry.exe')))
if (-not $NoIcon) {
  . (Join-Path $buildRepoRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
  $buildCodex = Get-DreamSkinCodexInstall
  Add-Type -AssemblyName System.Drawing
  $buildIcon = [Drawing.Icon]::ExtractAssociatedIcon($buildCodex.Executable)
  $buildIconPath = Join-Path $buildDataRoot 'Codex.ico'
  $buildStream = [IO.File]::Create($buildIconPath)
  try { $buildIcon.Save($buildStream) } finally { $buildStream.Dispose(); $buildIcon.Dispose() }
  $buildArguments += ('/win32icon:' + $buildIconPath)
}
$buildArguments += (Join-Path $PSScriptRoot 'CodexEntry.cs')
& $buildCompiler @buildArguments
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
& $buildCompiler /nologo /target:winexe /platform:x64 /reference:System.Web.Extensions.dll ('/out:' + (Join-Path $buildDataRoot 'WallpaperSupervisor.exe')) (Join-Path $PSScriptRoot 'WallpaperSupervisor.cs')
if ($LASTEXITCODE -ne 0) { throw 'Supervisor compilation failed' }
[IO.File]::WriteAllText((Join-Path $buildDataRoot 'launch-script.txt'),(Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'),[Text.UTF8Encoding]::new($false))
Write-Output "Built launcher in $buildDataRoot. No shortcut was changed and no app was started."
