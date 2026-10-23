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
