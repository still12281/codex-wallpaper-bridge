[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$SourceDirectory,[Parameter(Mandatory=$true)][string]$OutputDirectory,[string]$CompilerPath)
$ErrorActionPreference='Stop'
$SourceDirectory=(Resolve-Path -LiteralPath $SourceDirectory -ErrorAction Stop).Path
foreach($excluded in @('.git','node_modules')){if(Test-Path -LiteralPath (Join-Path $SourceDirectory $excluded)){throw 'Use an extracted Git archive, not a working checkout.'}}
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
if($OutputDirectory.StartsWith($SourceDirectory+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $OutputDirectory -ieq $SourceDirectory){throw 'Build outside the source snapshot.'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $SourceDirectory 'tools/check-release.mjs')
if($LASTEXITCODE -ne 0){throw 'Source manifest/privacy check failed.'}
$version=(Get-Content -LiteralPath (Join-Path $SourceDirectory 'package.json') -Raw -ErrorAction Stop|ConvertFrom-Json).version
if($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$'){throw 'Invalid package version.'}
if(-not $CompilerPath){
  $command=Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if($command){$CompilerPath=$command.Source}else{$CompilerPath=Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7/ISCC.exe'}
}
if(-not (Test-Path -LiteralPath $CompilerPath -PathType Leaf)){throw 'Inno Setup 7 compiler not found. Pass -CompilerPath to ISCC.exe.'}
[void][IO.Directory]::CreateDirectory($OutputDirectory)
$file=Join-Path $OutputDirectory ('CodexWallpaperBridge-'+$version+'-Setup.exe')
if(Test-Path -LiteralPath $file){throw 'Output already exists; use a fresh build directory.'}
& $CompilerPath ('/DPayloadRoot='+$SourceDirectory) ('/DAppVersion='+$version) ('/DBuildOutput='+$OutputDirectory) (Join-Path $SourceDirectory 'windows/installer/CodexWallpaperBridge.iss')
if($LASTEXITCODE -ne 0){throw 'Inno Setup compilation failed.'}
$hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($file+'.sha256',($hash+'  '+[IO.Path]::GetFileName($file)+"`n"),[Text.UTF8Encoding]::new($false))
[ordered]@{version=$version;installer=$file;sha256=$hash;bytes=(Get-Item -LiteralPath $file).Length}|ConvertTo-Json
