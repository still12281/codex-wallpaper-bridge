[CmdletBinding()]
param([string]$Python)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$captureDataRoot = Get-WallpaperDataRoot
$captureCodeRoot = Split-Path -Parent $PSScriptRoot
$captureUv = if ($env:CODEX_WALLPAPER_UV) { $env:CODEX_WALLPAPER_UV } else { (Get-Command uv -ErrorAction Stop).Source }
$env:UV_CACHE_DIR = Join-Path $captureDataRoot 'capture-cache'
if (-not $env:UV_PYTHON_INSTALL_DIR) { $env:UV_PYTHON_INSTALL_DIR = Join-Path $env:UV_CACHE_DIR 'python' }
if (-not $Python) { $Python = $env:CODEX_WALLPAPER_PYTHON }
$script = Join-Path $captureCodeRoot 'src/capture-scene.py'
$lock = $script + '.lock'
$lockHash = (Get-FileHash -LiteralPath $lock -Algorithm SHA256).Hash.ToLowerInvariant()
$runtimeRecord = Join-Path $env:UV_CACHE_DIR ('runtime-'+$lockHash+'.txt')
$cachePath = [IO.Path]::GetFullPath($env:UV_CACHE_DIR) + [IO.Path]::DirectorySeparatorChar

function Test-CaptureEnvironment([string]$Candidate) {
  try {
    if (-not $Candidate -or -not [IO.Path]::IsPathFullyQualified($Candidate)) { return $false }
    $absolute = [IO.Path]::GetFullPath($Candidate)
    if (-not $absolute.StartsWith($cachePath,[StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($absolute) -ine 'python.exe') { return $false }
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { return $false }
    $answer = & $absolute -I -B $script --verify-runtime 2>$null
    return ($LASTEXITCODE -eq 0 -and $answer -ieq $absolute)
  } catch { return $false }
}

function Save-CaptureEnvironment([string]$Interpreter) {
  $next = $runtimeRecord + '.' + [guid]::NewGuid().ToString('N') + '.next'
  [IO.File]::WriteAllText($next,$Interpreter)
  [IO.File]::Move($next,$runtimeRecord,$true)
}

function Find-CapturePython {
  # Test each candidate independently. A blocked entry must not hide a working
  # installation later in the search, or cause a managed download needlessly.
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs/Python/Python312/python.exe')
    (Join-Path $env:ProgramFiles 'Python312/python.exe')
    (Get-Command python3.12.exe,python.exe -All -CommandType Application -ErrorAction SilentlyContinue |
      ForEach-Object Source)
  )
  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not $candidate -or $candidate -match '\\Microsoft\\WindowsApps\\') { continue }
    try {
      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
      $actual = & $candidate -I -B -c 'import sys, struct; assert sys.version_info[:2] == (3, 12) and struct.calcsize("P") == 8; print(sys._base_executable)' 2>$null
      if ($LASTEXITCODE -eq 0 -and $actual -and [IO.Path]::IsPathFullyQualified([string]$actual) -and
          (Test-Path -LiteralPath ([string]$actual) -PathType Leaf)) { return [string]$actual }
    } catch { continue }
  }
}

if (-not $Python) {
  if (Test-Path -LiteralPath $runtimeRecord -PathType Leaf) {
    $saved = [IO.File]::ReadAllText($runtimeRecord).Trim()
    if (Test-CaptureEnvironment $saved) {
      Write-Output 'Reusing the verified native capture environment.'
      return
    }
  }
  # Versions installed before the record was introduced can still have a
  # usable uv environment. Inspect it directly, without asking uv to sync.
  $legacyRoot = Join-Path $env:UV_CACHE_DIR 'environments-v2'
  if (Test-Path -LiteralPath $legacyRoot -PathType Container) {
    $legacy = Get-ChildItem -LiteralPath $legacyRoot -Directory -Filter 'capture-scene-*' |
      Sort-Object LastWriteTime -Descending
    foreach ($candidate in $legacy) {
      $interpreter = Join-Path $candidate.FullName 'Scripts/python.exe'
      if (-not (Test-CaptureEnvironment $interpreter)) { continue }
      Save-CaptureEnvironment $interpreter
      Write-Output 'Reusing the verified native capture environment from the previous version.'
      return
    }
  }
}
$pythonOptions = @()
if (-not $Python) { $Python = Find-CapturePython }
if (-not $Python) {
  $systemPython = & $captureUv python find --no-managed-python --no-python-downloads 3.12 2>$null
  if ($LASTEXITCODE -eq 0 -and $systemPython) {
    $Python = [string]$systemPython
    $pythonOptions += '--no-managed-python'
  } else {
    $Python = '3.12'
    $pythonOptions += '--managed-python'
  }
}
if ([IO.Path]::IsPathFullyQualified($Python)) { $pythonOptions += '--no-python-downloads' }
Write-Output "Preparing capture with Python $Python."
& $captureUv sync --frozen --script $script --python $Python @pythonOptions
if ($LASTEXITCODE -ne 0) { throw 'Realtime capture dependency preparation failed. No capture was started.' }
$prepared = & $captureUv run --offline --frozen --python $Python @pythonOptions --script $script --runtime-path
if ($LASTEXITCODE -ne 0 -or -not (Test-CaptureEnvironment ([string]$prepared))) {
  throw 'The prepared capture environment failed its Python and dependency check.'
}
Save-CaptureEnvironment ([string]$prepared)
Write-Output 'Capture dependencies prepared. No wallpaper or capture was started.'
