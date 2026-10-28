function Get-WallpaperDataRoot {
  $configured = $env:CODEX_WALLPAPER_DATA_DIR
  if ($configured -and -not [IO.Path]::IsPathFullyQualified($configured)) { throw 'CODEX_WALLPAPER_DATA_DIR must be absolute' }
  $dataRoot = if ($configured) { $configured } else { Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodexWallpaperBridge' }
  [void](New-Item -ItemType Directory -Path $dataRoot -Force -ErrorAction Stop)
  return $dataRoot
}
function Get-WallpaperNode {
  if ($env:CODEX_WALLPAPER_NODE) { $nodePath = $env:CODEX_WALLPAPER_NODE } else { $nodePath = (Get-Command node.exe -ErrorAction Stop).Source }
  if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw 'Node.js not found' }
  return [IO.Path]::GetFullPath($nodePath)
}
function Import-WallpaperOptionalRuntimes([string]$Root) {
  $file=Join-Path $Root 'launcher-runtime.json'
  if(-not (Test-Path -LiteralPath $file -PathType Leaf)){return}
  $record=Get-Content -LiteralPath $file -Raw -ErrorAction Stop | ConvertFrom-Json
  foreach($item in @(@{key='ffmpeg';variable='CODEX_WALLPAPER_FFMPEG'},@{key='uv';variable='CODEX_WALLPAPER_UV'})){
    if([Environment]::GetEnvironmentVariable($item.variable,'Process')){continue}
    $property=$record.PSObject.Properties[$item.key]
    if($property -and [IO.Path]::IsPathFullyQualified([string]$property.Value) -and (Test-Path -LiteralPath ([string]$property.Value) -PathType Leaf)){
      [Environment]::SetEnvironmentVariable($item.variable,[string]$property.Value,'Process')
    }
  }
}
