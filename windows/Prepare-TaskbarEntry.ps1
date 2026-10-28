[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$entryCodeRoot=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$entryRoot=Get-WallpaperDataRoot
. (Join-Path $entryCodeRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
$entryCodex=Get-DreamSkinCodexInstall
if($null -eq $entryCodex){throw 'Official Codex package unavailable'}
$entryLink=Join-Path $entryRoot 'Codex.lnk'
$entryIcon=Join-Path $entryRoot 'icons/Codex-Native.ico'
. (Join-Path $PSScriptRoot 'Official-Icon.ps1')
$entryIconSource=Copy-WallpaperOfficialIcon $entryCodex (Join-Path $entryRoot 'Codex.ico')
$entryShell=New-Object -ComObject WScript.Shell
$entryShortcut=$entryShell.CreateShortcut($entryLink)
$entryShortcut.TargetPath=Join-Path $entryRoot 'CodexEntry.exe'
if(-not (Test-Path -LiteralPath $entryShortcut.TargetPath)){throw 'Native Codex entry is not built'}
$entryShortcut.Arguments=''
$entryShortcut.WorkingDirectory=$entryRoot
$entryShortcut.IconLocation="$entryIcon,0"
$entryShortcut.Description='Codex'
$entryShortcut.WindowStyle=7
$entryShortcut.Save()

if(-not ('CodexWallpaperEntry.LinkIdentity' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'ShortcutIdentity.cs')}
$entryAppId='CodexWallpaperBridge.Codex'
$entryCommand='"'+$entryShortcut.TargetPath+'"'
$entryActual=[CodexWallpaperEntry.LinkIdentity]::Set($entryLink,$entryAppId,$entryCommand,"$entryIcon,0")
if($entryActual -cne $entryAppId){throw 'Shortcut AppUserModelID verification failed'}
. (Join-Path $PSScriptRoot 'Native-Icon-Pins.ps1')
$entryPinnedIcons=@(Update-WallpaperPinnedIcons -Entry $entryShortcut.TargetPath -Icon $entryIcon)
[ordered]@{shortcut=$entryLink;icon=$entryIcon;officialIconSource=$entryIconSource;iconSha256=(Get-FileHash -LiteralPath $entryIcon).Hash;appUserModelId=$entryActual;target=$entryShortcut.TargetPath;arguments=$entryShortcut.Arguments;existingPinnedEntryModified=(@($entryPinnedIcons | Where-Object changed).Count -gt 0);pinnedIconReferences=$entryPinnedIcons;taskbarGroupingVerified=$false;clientColdLaunchVerified=$false} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $entryRoot 'taskbar-entry-status.json') -Encoding utf8 -ErrorAction Stop
Get-Content -LiteralPath (Join-Path $entryRoot 'taskbar-entry-status.json') -Raw
