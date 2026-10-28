$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-remote-test-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$template=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../tools/install-bootstrap.ps1'))
function New-BootstrapArchive([string]$Name,[string]$ExtraPath=''){
  $file=Join-Path $root ($Name+'.zip');$stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew)
  $zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
  try{
    $files=@{'Install.cmd'="@echo off`r`nif /I `"%~1`" NEQ `"-NoPause`" exit /b 9`r`n> `"%~dp0invoked.txt`" echo mode:%~2`r`nexit /b 0`r`n";'release-manifest.json'='{}';'windows/Install-Wallpaper.ps1'='# fixture'}
    foreach($item in $files.GetEnumerator()){$entry=$zip.CreateEntry('CodexWallpaperBridge/'+$item.Key);$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write($item.Value)}finally{$writer.Dispose()}}
    if($ExtraPath){$entry=$zip.CreateEntry($ExtraPath);$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write('fixture')}finally{$writer.Dispose()}}
  }finally{$zip.Dispose();$stream.Dispose()}
  return $file
}
$script:fixture=New-BootstrapArchive 'valid';$script:downloads=@()
function Invoke-WebRequest {param([switch]$UseBasicParsing,[string]$Uri,[string]$OutFile,$ErrorAction)
  if($Uri -cne 'https://github.com/still12281/codex-wallpaper-bridge/releases/download/v0.1.0-alpha.0/CodexWallpaperBridge-0.1.0-alpha.0.zip'){throw 'Unexpected download origin/version'}
  Copy-Item -LiteralPath $script:fixture -Destination $OutFile -ErrorAction Stop;$script:downloads+=,$OutFile
}
function Invoke-Fixture([string]$Hash){$source=$template.Replace('__CWB_VERSION__','0.1.0-alpha.0').Replace('__CWB_ARCHIVE_SHA256__',$Hash);& ([scriptblock]::Create($source)) -CheckOnly}
$hash=(Get-FileHash -LiteralPath $script:fixture).Hash.ToLowerInvariant()
Invoke-Fixture $hash
$download=$script:downloads[-1];$marker=Join-Path (Split-Path -Parent $download) 'source/CodexWallpaperBridge/invoked.txt'
if(-not (Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -cne 'mode:-CheckOnly'){throw 'Verified package did not invoke the installer check'}
Invoke-Expression ($template.Replace('__CWB_VERSION__','0.1.0-alpha.0').Replace('__CWB_ARCHIVE_SHA256__',$hash))
$marker=Join-Path (Split-Path -Parent $script:downloads[-1]) 'source/CodexWallpaperBridge/invoked.txt'
if((Get-Content -LiteralPath $marker -Raw).Trim() -cne 'mode:'){throw 'Default one-line invocation did not start normal installation'}
$blocked=$false;try{Invoke-Fixture ('0'*64)}catch{if($_.Exception.Message -like '*SHA256 mismatch*'){$blocked=$true}else{throw}}
if(-not $blocked -or (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $script:downloads[-1]) 'source'))){throw 'Digest mismatch reached extraction'}
$script:fixture=New-BootstrapArchive 'traversal' 'CodexWallpaperBridge/../escaped.txt'
$blocked=$false;try{Invoke-Fixture (Get-FileHash -LiteralPath $script:fixture).Hash.ToLowerInvariant()}catch{if($_.Exception.Message -like '*Unsafe release archive path*'){$blocked=$true}else{throw}}
if(-not $blocked){throw 'Traversal archive was not rejected'}
Write-Output 'PASS: default and check-only remote calls reach the fixture installer; bad hash/traversal stop before extraction. Downloads mocked; no user installation changed.'
