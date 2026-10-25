function Copy-WallpaperOfficialIcon([object]$Codex,[string]$Destination) {
  # Copy the full original resource, rather than extracting the EXE's small icon.
  $source=Join-Path (Split-Path -Parent $Codex.Executable) 'resources/icon-chatgpt.ico'
  if(-not (Test-Path -LiteralPath $source -PathType Leaf)){throw 'Official full-size icon resource unavailable; no replacement icon was generated.'}
  Copy-Item -LiteralPath $source -Destination $Destination -Force -ErrorAction Stop
  if((Get-FileHash -LiteralPath $source).Hash -cne (Get-FileHash -LiteralPath $Destination).Hash){throw 'Official icon copy mismatch'}
  return $source
}
