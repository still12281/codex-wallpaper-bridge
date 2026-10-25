function Copy-WallpaperOfficialIcon([object]$Codex,[string]$Destination) {
  # Copy the full original resource, rather than extracting the EXE's small icon.
  $light=$true
  try{$light=(Get-ItemPropertyValue -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name AppsUseLightTheme -ErrorAction Stop) -ne 0}catch{}
  $name=if($light){'chatgpt-app-light.ico'}else{'chatgpt-app-dark.ico'}
  $source=Join-Path (Split-Path -Parent $Codex.Executable) "resources/$name"
  if(-not (Test-Path -LiteralPath $source -PathType Leaf)){throw 'Official full-size icon resource unavailable; no replacement icon was generated.'}
  Copy-Item -LiteralPath $source -Destination $Destination -Force -ErrorAction Stop
  if((Get-FileHash -LiteralPath $source).Hash -cne (Get-FileHash -LiteralPath $Destination).Hash){throw 'Official icon copy mismatch'}
  return $source
}
