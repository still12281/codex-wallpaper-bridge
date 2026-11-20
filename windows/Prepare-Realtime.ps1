[CmdletBinding()]
param([string]$Python)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$captureDataRoot = Get-WallpaperDataRoot
$captureCodeRoot = Split-Path -Parent $PSScriptRoot
$captureUv = if ($env:CODEX_WALLPAPER_UV) { $env:CODEX_WALLPAPER_UV } else { (Get-Command uv -ErrorAction Stop).Source }
$env:UV_CACHE_DIR = Join-Path $captureDataRoot 'capture-cache'
if (-not $Python) { $Python = $env:CODEX_WALLPAPER_PYTHON }
$script = Join-Path $captureCodeRoot 'src/capture-scene.py'
$pythonOptions = @()
if (-not $Python) {
  $previousLauncher = Join-Path $captureDataRoot 'launch-script.txt'
  if (Test-Path -LiteralPath $previousLauncher -PathType Leaf) {
    $previousEntry = [IO.File]::ReadAllText($previousLauncher).Trim()
    $versionPrefix = [regex]::Escape((Join-Path $captureDataRoot 'versions') + [IO.Path]::DirectorySeparatorChar)
    if ($previousEntry -match ('^' + $versionPrefix + 'release-[0-9a-f]{16}\\windows\\Start-CodexWallpaper\.ps1$')) {
      $previousScript = Join-Path (Split-Path -Parent (Split-Path -Parent $previousEntry)) 'src/capture-scene.py'
      if ($previousScript -ine $script -and (Test-Path -LiteralPath $previousScript -PathType Leaf)) {
        $cached = & $captureUv run --offline --frozen --script $previousScript --runtime-path 2>$null
        if ($LASTEXITCODE -eq 0 -and $cached -and (Test-Path -LiteralPath ([string]$cached) -PathType Leaf)) {
          $base = & ([string]$cached) -I -c 'import sys; print(sys._base_executable)' 2>$null
          if ($LASTEXITCODE -eq 0 -and $base -and (Test-Path -LiteralPath ([string]$base) -PathType Leaf)) {
            $Python = [string]$base
          }
        }
      }
    }
  }
}
if (-not $Python) {
  $systemPython = & $captureUv python find --no-managed-python --no-python-downloads 3.12 2>$null
  if ($LASTEXITCODE -eq 0 -and $systemPython) {
    $Python = [string]$systemPython
    $pythonOptions += '--no-managed-python'
  } else {
    $Python = '3.12'
    if (-not $env:UV_PYTHON_INSTALL_DIR) { $env:UV_PYTHON_INSTALL_DIR = Join-Path $env:UV_CACHE_DIR 'python' }
  }
}
Write-Output "Preparing capture with Python $Python."
& $captureUv sync --frozen --script $script --python $Python @pythonOptions
if ($LASTEXITCODE -ne 0) { throw 'Realtime capture dependency preparation failed. No capture was started.' }
Write-Output 'Capture dependencies prepared. No wallpaper or capture was started.'
