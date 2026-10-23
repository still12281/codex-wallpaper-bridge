[CmdletBinding()]
param([string]$Python)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$captureDataRoot = Get-WallpaperDataRoot
$captureCodeRoot = Split-Path -Parent $PSScriptRoot
$captureUv = if ($env:CODEX_WALLPAPER_UV) { $env:CODEX_WALLPAPER_UV } else { (Get-Command uv -ErrorAction Stop).Source }
$env:UV_CACHE_DIR = Join-Path $captureDataRoot 'capture-cache'
if (-not $Python) { $Python = if ($env:CODEX_WALLPAPER_PYTHON) { $env:CODEX_WALLPAPER_PYTHON } else { '3.12' } }
& $captureUv sync --frozen --script (Join-Path $captureCodeRoot 'src/capture-scene.py') --python $Python
if ($LASTEXITCODE -ne 0) { throw 'Realtime capture dependency preparation failed. No capture was started.' }
Write-Output 'Capture dependencies prepared. No wallpaper or capture was started.'
