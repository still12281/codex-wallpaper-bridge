[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][int]$ClientId,[Parameter(Mandatory=$true)][string]$StartedAt,[Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$MainTarget,[Parameter(Mandatory=$true)][string]$GeometryJson,[switch]$InspectOnly,[switch]$RememberOnly)
$ErrorActionPreference='Stop'
if($MainTarget -notmatch '^[a-fA-F0-9]+$' -or $Executable -notmatch '\\WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\ChatGPT\.exe$'){throw 'Unverified client activation identity'}
$client=Get-Process -Id $ClientId -ErrorAction Stop
$ticks=([DateTime]::Parse($StartedAt,$null,[Globalization.DateTimeStyles]::RoundtripKind)).ToUniversalTime().Ticks
if($client.StartTime.ToUniversalTime().Ticks -ne $ticks -or $client.MainModule.FileName -ine $Executable){throw 'Client changed before native activation'}
$geometry=$GeometryJson|ConvertFrom-Json
foreach($field in @('x','y','width','height','dpr')){if($null -eq $geometry.$field -or -not [double]::IsFinite([double]$geometry.$field)){throw 'Invalid main window geometry'}}
if($geometry.width -le 0 -or $geometry.height -le 0 -or $geometry.dpr -le 0){throw 'Main window geometry is unavailable'}
if(-not ('WallpaperClientWindow' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'ClientWindow.cs')}
$hint=0L;$hintPath=Join-Path $Root 'main-window.json'
try{$saved=Get-Content -LiteralPath $hintPath -Raw -ErrorAction Stop|ConvertFrom-Json;if($saved.clientId -eq $ClientId -and $saved.startedAt -eq $StartedAt -and $saved.mainTarget -eq $MainTarget){$hint=[long]$saved.handle}}catch{}
$handle=[WallpaperClientWindow]::Find($ClientId,$hint,$geometry.x,$geometry.y,$geometry.width,$geometry.height,$geometry.dpr)
if(-not $InspectOnly -and -not $RememberOnly){
 [WallpaperClientWindow]::Activate($handle,$ClientId,$Executable,$ticks)
 $deadline=[DateTimeOffset]::UtcNow.AddSeconds(1)
 do{if([WallpaperClientWindow]::Visible($handle) -and -not [WallpaperClientWindow]::Minimized($handle) -and [WallpaperClientWindow]::Foreground($handle)){break};Start-Sleep -Milliseconds 50}while([DateTimeOffset]::UtcNow -lt $deadline)
 if(-not [WallpaperClientWindow]::Visible($handle) -or [WallpaperClientWindow]::Minimized($handle)){throw 'Codex main window did not restore; client preserved'}
 if(-not [WallpaperClientWindow]::Foreground($handle)){throw 'Codex restored but Windows did not grant foreground focus; client preserved'}
}
if(-not $InspectOnly){
 [ordered]@{clientId=$ClientId;startedAt=$StartedAt;mainTarget=$MainTarget;handle=$handle}|ConvertTo-Json|Set-Content -LiteralPath ($hintPath+'.next') -ErrorAction Stop
 [IO.File]::Move($hintPath+'.next',$hintPath,$true)
}
[pscustomobject]@{handle=$handle;visible=[WallpaperClientWindow]::Visible($handle);minimized=[WallpaperClientWindow]::Minimized($handle);foreground=[WallpaperClientWindow]::Foreground($handle);inspectOnly=[bool]$InspectOnly;rememberOnly=[bool]$RememberOnly}
