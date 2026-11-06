# Local startup adapter; keep the vendored upstream implementation unchanged.
function Get-DreamSkinPortListeners {
  param([int]$Port)
  @(Get-WallpaperTcpListeners -Port $Port)
}
