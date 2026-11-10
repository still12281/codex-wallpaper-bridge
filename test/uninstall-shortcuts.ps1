$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/InstallSupport.ps1')
. (Join-Path $PSScriptRoot '../windows/UninstallSupport.ps1')
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('cwb-uninstall-'+[guid]::NewGuid().ToString('N'))
$root=Join-Path $scratch 'data';$desktop=Join-Path $scratch 'Desktop'
[void][IO.Directory]::CreateDirectory($root);[void][IO.Directory]::CreateDirectory($desktop)
$entry=Join-Path $root 'CodexEntry.exe';[IO.File]::WriteAllText($entry,'fixture')
$source=Join-Path $root 'Codex.lnk';$destination=Join-Path $desktop 'Codex Wallpaper.lnk'
$shell=New-Object -ComObject WScript.Shell
try{$link=$shell.CreateShortcut($source);$link.TargetPath=$entry;$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
Publish-WallpaperInstallShortcut $source $destination $entry
$before=(Get-FileHash -LiteralPath $destination).Hash
$plan=@(Remove-WallpaperManagedShortcuts -Root $root -AllowedPaths @($destination) -InspectOnly)
if($plan.Count -ne 1 -or $plan[0].reason -ne 'owned' -or (Get-FileHash -LiteralPath $destination).Hash -cne $before){throw 'Inspect changed the managed shortcut or ownership was lost.'}
$saved=[IO.File]::ReadAllBytes($destination);[IO.File]::WriteAllBytes($destination,($saved+[byte[]]@(1)))
$preserved=@(Remove-WallpaperManagedShortcuts -Root $root -AllowedPaths @($destination))
if($preserved[0].reason -ne 'modified-preserved' -or -not (Test-Path -LiteralPath $destination)){throw 'Modified shortcut was not preserved.'}
[IO.File]::WriteAllBytes($destination,$saved)
$rejected=$false;try{Remove-WallpaperManagedShortcuts -Root $root -AllowedPaths @((Join-Path $desktop 'Other.lnk'))|Out-Null}catch{$rejected=$true}
if(-not $rejected -or -not (Test-Path -LiteralPath $destination)){throw 'Unapproved shortcut path was accepted.'}
$removed=@(Remove-WallpaperManagedShortcuts -Root $root -AllowedPaths @($destination))
if(-not $removed[0].removed -or (Test-Path -LiteralPath $destination) -or -not (Test-Path -LiteralPath $entry)){throw 'Owned shortcut removal affected data or did not complete.'}
$startup=Join-Path $scratch 'Startup'
$record=@{schemaVersion=1;entry=$entry;shortcut=(Join-Path $startup 'Codex Wallpaper.lnk');registryPath='HKCU:\Software\Unrelated\Startup'}
$record|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'login-startup.json')
$rejected=$false;try{Get-WallpaperUninstallLoginRecord $root $startup|Out-Null}catch{$rejected=$true}
if(-not $rejected){throw 'Foreign startup registry path was accepted.'}
Write-Output 'PASS: recorded shortcut ownership, inspect, edited shortcut preservation, foreign path rejection, owned removal and data preservation. No user integrations changed.'
