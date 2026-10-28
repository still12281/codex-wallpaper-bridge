[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ScratchDirectory)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/Runtime.ps1')
[void](New-Item -ItemType Directory -Path $ScratchDirectory -Force -ErrorAction Stop)
$testUv=Join-Path $ScratchDirectory 'uv.exe';$testFfmpeg=Join-Path $ScratchDirectory 'ffmpeg.exe'
[IO.File]::WriteAllBytes($testUv,[byte[]]@(0));[IO.File]::WriteAllBytes($testFfmpeg,[byte[]]@(0))
@{uv=$testUv;ffmpeg=$testFfmpeg}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $ScratchDirectory 'launcher-runtime.json') -Encoding UTF8
$beforeUv=$env:CODEX_WALLPAPER_UV;$beforeFfmpeg=$env:CODEX_WALLPAPER_FFMPEG
try{
  $env:CODEX_WALLPAPER_UV=$null;$env:CODEX_WALLPAPER_FFMPEG=$null
  Import-WallpaperOptionalRuntimes $ScratchDirectory
  if($env:CODEX_WALLPAPER_UV -cne $testUv -or $env:CODEX_WALLPAPER_FFMPEG -cne $testFfmpeg){throw 'Recorded optional runtimes were not restored'}
  $env:CODEX_WALLPAPER_UV='explicit-user-choice'
  Import-WallpaperOptionalRuntimes $ScratchDirectory
  if($env:CODEX_WALLPAPER_UV -cne 'explicit-user-choice'){throw 'Explicit override was replaced'}
  [pscustomobject]@{passed=$true;recordedPathsRestored=$true;explicitOverridesPreserved=$true}
}finally{$env:CODEX_WALLPAPER_UV=$beforeUv;$env:CODEX_WALLPAPER_FFMPEG=$beforeFfmpeg}
