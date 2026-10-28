$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/InstallSupport.ps1')
. (Join-Path $PSScriptRoot '../windows/StartupHealth.ps1')
function Assert-Option($Condition,[string]$Message){if(-not $Condition){throw $Message}}
Set-WallpaperTrustedPackageRoots @([pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';PackageRoot='C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0'})
$noPrompt={throw 'Noninteractive/preserved settings must not prompt'}
$choice=Resolve-WallpaperInstallChoices -NonInteractive -ReadChoice $noPrompt
Assert-Option ($choice.shortcutMode -eq 'separate' -and $choice.updateReconnect -eq 'keep') 'Unattended defaults changed existing shortcuts or update tasks'
$choice=Resolve-WallpaperInstallChoices -Existing ([pscustomobject]@{shortcutMode='replace'}) -ReadChoice $noPrompt
Assert-Option ($choice.shortcutMode -eq 'replace' -and $choice.updateReconnect -eq 'keep') 'Upgrade forgot saved preference'
$answers=[Collections.Generic.Queue[string]]::new();$answers.Enqueue('2');$answers.Enqueue('y')
$choice=Resolve-WallpaperInstallChoices -ReadChoice {param($Question) $answers.Dequeue()}
Assert-Option ($choice.shortcutMode -eq 'replace' -and $choice.updateReconnect -eq 'enable') 'Explicit interactive choices lost'
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-options-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory((Join-Path $root 'icons'))
$entry=Join-Path $root 'CodexEntry.exe';[IO.File]::WriteAllText($entry,'fixture');[IO.File]::WriteAllText((Join-Path $root 'icons/Codex-Native.ico'),'fixture')
$shell=New-Object -ComObject WScript.Shell
$file=Join-Path $root 'Codex.lnk';$link=$shell.CreateShortcut($file);$link.TargetPath='C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe';$link.Description='original description';$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
$original=[IO.File]::ReadAllBytes($file)
foreach($mode in @('separate','none')){
  @{schemaVersion=1;shortcutMode=$mode}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json')
  Assert-Option (@(Repair-WallpaperEntryShortcuts -Root $root -Candidates @($file)).Count -eq 0) 'Separate/none mode still rewrote an official shortcut'
}
@{schemaVersion=1;shortcutMode='replace'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json')
$repaired=@(Repair-WallpaperEntryShortcuts -Root $root -Candidates @($file));Assert-Option ($repaired.Count -eq 1 -and $repaired[0].changed) 'Explicit replace failed'
$restored=@(& (Join-Path $PSScriptRoot '../windows/Restore-Shortcuts.ps1') -Root $root)
Assert-Option ($restored.Count -eq 1 -and $restored[0].restored) 'Original shortcut was not restored'
Assert-Option ([Convert]::ToHexString([IO.File]::ReadAllBytes($file)) -ceq [Convert]::ToHexString($original)) 'Restore changed original shortcut bytes'
Assert-Option ((Get-Content -LiteralPath (Join-Path $root 'installation.json') -Raw|ConvertFrom-Json).shortcutMode -eq 'separate') 'Restore would be undone by next entry launch'
@{schemaVersion=1;shortcutMode='replace'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json')
[void]@(Repair-WallpaperEntryShortcuts -Root $root -Candidates @($file))
$link=$shell.CreateShortcut($file);$link.Description='edited after replacement';$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
$edited=(Get-FileHash -LiteralPath $file).Hash
$preserved=@(& (Join-Path $PSScriptRoot '../windows/Restore-Shortcuts.ps1') -Root $root)
Assert-Option ($preserved[0].reason -eq 'shortcut-modified-preserved' -and (Get-FileHash -LiteralPath $file).Hash -ceq $edited) 'Restore overwrote a later user change'
$appid='OpenAI.Codex_fixture!App'
Assert-Option (Test-WallpaperShortcutRepair '' '' $entry $appid $appid) 'Verified Store shortcut rejected'
Assert-Option (-not (Test-WallpaperShortcutRepair 'C:\OtherApp.exe' '' $entry $appid $appid)) 'AppID alone captured an unrelated executable'
Assert-Option (Test-WallpaperShortcutRepair (Join-Path $env:WINDIR 'explorer.exe') ('shell:AppsFolder\'+$appid) $entry '' $appid) 'Verified shell app shortcut rejected'
Assert-Option (-not (Test-WallpaperShortcutRepair (Join-Path $env:WINDIR 'explorer.exe') ('shell:AppsFolder\'+$appid+' --file private.txt') $entry '' $appid)) 'Extra arguments would be discarded'
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
Write-Output 'PASS: explicit/preserved/unattended choices, separate/none no-repair, replacement backup/exact restore, Store identity and extra-argument boundaries. No user shortcuts or tasks changed.'
