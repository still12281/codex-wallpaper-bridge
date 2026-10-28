$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/InstallSupport.ps1')
. (Join-Path $PSScriptRoot '../windows/StartupHealth.ps1')
function Assert-Upgrade($Condition,[string]$Message){if(-not $Condition){throw $Message}}
Set-WallpaperTrustedPackageRoots @([pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';PackageRoot='C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0'})
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('cwb-upgrade-'+[guid]::NewGuid());$root=Join-Path $fixture 'data';$desktop=Join-Path $fixture 'Desktop'
[void][IO.Directory]::CreateDirectory((Join-Path $root 'icons'));[void][IO.Directory]::CreateDirectory($desktop)
$entry=Join-Path $root 'CodexEntry.exe';[IO.File]::WriteAllText($entry,'fixture');[IO.File]::WriteAllText((Join-Path $root 'icons/Codex-Native.ico'),'fixture')
@{shortcutMode='replace'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json')
$shell=New-Object -ComObject WScript.Shell
$internal=$shell.CreateShortcut((Join-Path $root 'Codex.lnk'));$internal.TargetPath=$entry;$internal.Description='Codex';$internal.WindowStyle=7;$internal.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($internal)
$file=Join-Path $desktop 'Codex.lnk';$link=$shell.CreateShortcut($file);$link.TargetPath='C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe';$link.Description='custom original';$link.WindowStyle=3;$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
$original=(Get-FileHash -LiteralPath $file).Hash
$first=Install-WallpaperReplacementShortcuts -Root $root -DesktopDirectory $desktop -Candidates @($file)
Assert-Upgrade ($first.replaced -eq 1 -and -not $first.createdFallback) 'First replacement failed'
$after=(Get-FileHash -LiteralPath $file).Hash;$index=(Get-FileHash -LiteralPath (Join-Path $root 'shortcut-replacements.json')).Hash
$second=Install-WallpaperReplacementShortcuts -Root $root -DesktopDirectory $desktop -Candidates @($file)
Assert-Upgrade ($second.existingManaged -and -not $second.createdFallback) 'Reinstall did not recognize managed shortcut'
Assert-Upgrade ((Get-FileHash -LiteralPath $file).Hash -ceq $after -and (Get-FileHash -LiteralPath (Join-Path $root 'shortcut-replacements.json')).Hash -ceq $index) 'Reinstall broke the original restore chain'
$restored=@(& (Join-Path $PSScriptRoot '../windows/Restore-Shortcuts.ps1') -Root $root)
Assert-Upgrade ($restored[0].restored -and (Get-FileHash -LiteralPath $file).Hash -ceq $original) 'Original shortcut did not restore after repeat install'
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
Write-Output 'PASS: full replacement branch repeated without overwriting managed bytes or backup index, then exact original restoration. No user shortcuts changed.'
