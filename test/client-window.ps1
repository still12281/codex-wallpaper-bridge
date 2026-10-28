$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../windows/ClientWindow.cs')
if(-not [WallpaperClientWindow]::Matches(383,62,1309,900,383,62,1309,900,1)){throw 'Main geometry rejected'}
if([WallpaperClientWindow]::Matches(421,396,356,320,383,62,1309,900,1)){throw 'Avatar geometry accepted as main'}
if([WallpaperClientWindow]::Matches(0,0,960,720,383,62,1309,900,1)){throw 'Detached geometry accepted as main'}
if(-not [WallpaperClientWindow]::Matches(125,250,1250,1000,100,200,1000,800,1.25)){throw 'Scaled geometry rejected'}
$missing=$false
try{[WallpaperClientWindow]::Find(-1,0,0,0,100,100,1)|Out-Null}catch{$missing=$true}
if(-not $missing){throw 'Unknown owner must not resolve a window'}
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../windows/Start-CodexWallpaper.ps1') -Raw
$tokens=$null;$errors=$null
[void][Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
[pscustomobject]@{passed=$true;geometryAndOwnerGuards=$true;noRealWindowActivated=$true}|ConvertTo-Json
