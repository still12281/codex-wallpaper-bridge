# Release template. Generate install.ps1 with create-bootstrap.mjs after archiving the source.
# Compatible with Windows PowerShell 5.1 and PowerShell 7; Install.cmd prepares PowerShell 7.
[CmdletBinding()]
param([switch]$CheckOnly)
& {
  param([bool]$InspectOnly)
  $ErrorActionPreference='Stop'
  $version='__CWB_VERSION__'
  $expected='__CWB_ARCHIVE_SHA256__'
  if($env:OS -ne 'Windows_NT'){throw 'Windows 10/11 x64 is required.'}
  if($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$' -or $expected -notmatch '^[0-9a-f]{64}$'){throw 'Use the generated install.ps1 from a versioned GitHub Release.'}
  $directory=Join-Path ([IO.Path]::GetTempPath()) ('CodexWallpaperBridge-install-'+[guid]::NewGuid().ToString('N'))
  [void][IO.Directory]::CreateDirectory($directory)
  try{
    $archive=Join-Path $directory ('CodexWallpaperBridge-'+$version+'.zip')
    $uri='https://github.com/still12281/codex-wallpaper-bridge/releases/download/v'+$version+'/'+[IO.Path]::GetFileName($archive)
    Write-Host ('Downloading Codex Wallpaper Bridge '+$version+' ...')
    $previousProtocol=[Net.ServicePointManager]::SecurityProtocol
    try{
      [Net.ServicePointManager]::SecurityProtocol=$previousProtocol -bor [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $archive -ErrorAction Stop
    }finally{[Net.ServicePointManager]::SecurityProtocol=$previousProtocol}
    if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected){throw 'Release SHA256 mismatch; installation was not started.'}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($archive)
    try{
      $total=0L
      foreach($entry in $zip.Entries){
        $name=$entry.FullName
        if(-not $name.StartsWith('CodexWallpaperBridge/',[StringComparison]::Ordinal) -or $name.Contains('\') -or $name.Contains(':') -or @($name.Split('/')|Where-Object {$_ -in @('.','..')}).Count){throw 'Unsafe release archive path; installation was not started.'}
        if((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000){throw 'Release archive contains a symbolic link.'}
        $total+=$entry.Length
        if($total -gt 64MB){throw 'Unexpected source archive size; installation was not started.'}
      }
    }finally{$zip.Dispose()}
    $expanded=Join-Path $directory 'source'
    [IO.Compression.ZipFile]::ExtractToDirectory($archive,$expanded)
    $source=Join-Path $expanded 'CodexWallpaperBridge'
    foreach($required in @('Install.cmd','release-manifest.json','windows/Install-Wallpaper.ps1')){
      if(-not (Test-Path -LiteralPath (Join-Path $source $required) -PathType Leaf)){throw 'Incomplete release layout; installation was not started.'}
    }
    $installer=Join-Path $source 'Install.cmd'
    Write-Host 'SHA256 verified. Starting the installer ...'
    if($InspectOnly){& $installer -NoPause -CheckOnly}else{& $installer -NoPause}
    if($LASTEXITCODE -ne 0){throw ('Installer exited with code '+$LASTEXITCODE+'. See the message above.')}
    Write-Host ('Download cache: '+$directory)
  }catch{
    Write-Host ('Download cache retained for troubleshooting: '+$directory)
    throw
  }
} ([bool]$CheckOnly)
