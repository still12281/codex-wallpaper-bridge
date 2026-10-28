$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/StartupHealth.ps1')
function Assert-Startup($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-startup-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory($root)
$old=[pscustomobject]@{version='26.1021.3705.0';package='old';at='2026-10-27T00:00:00Z'}
[IO.File]::WriteAllText((Join-Path $root 'entry-health.json'),(@{lastSuccess=$old}|ConvertTo-Json))
$new=[pscustomobject]@{Version='26.1023.6123.0';PackageFullName='registered-new'}
$running=[pscustomobject]@{IsMain=$true;CommandLine='client'}
$check=Get-WallpaperStartupCheck -Root $root -Codex $new -Processes @($running)
Assert-Startup ($check.versionChanged -and $check.nextAction -eq 'preserve-client-wait-for-normal-integrated-launch') 'Update ordinary-client boundary lost'
$check=Get-WallpaperStartupCheck -Root $root -Codex $new -Processes @() -HasVerifiedCdp $true
Assert-Startup ($check.nextAction -eq 'reuse-client-and-check-host') 'Healthy reuse lost'
$check=Get-WallpaperStartupCheck -Root $root -Codex $new
Assert-Startup ($check.nextAction -eq 'launch-current-package-and-restore-selection') 'Cold launch not using current package'
$status=[ordered]@{phase='failed';updatedAt=[DateTimeOffset]::UtcNow.ToString('o');startupCheck=$check;error='generated fixture'}
Save-WallpaperStartupHealth -Root $root -Status $status
Assert-Startup ((Get-Content -LiteralPath (Join-Path $root 'entry-health.json') -Raw|ConvertFrom-Json).lastSuccess.version -eq $old.version) 'Failure erased last successful version'
$status.phase='background-rendered';$status.codexVersion=$new.Version;$status.packageFullName=$new.PackageFullName;$status.browserId='generated-fixture'
Save-WallpaperStartupHealth -Root $root -Status $status
Assert-Startup ((Get-Content -LiteralPath (Join-Path $root 'entry-health.json') -Raw|ConvertFrom-Json).lastSuccess.version -eq $new.Version) 'Success was not recorded'
$entry=Join-Path $root 'CodexEntry.exe';[IO.File]::WriteAllText($entry,'generated fixture');[void][IO.Directory]::CreateDirectory((Join-Path $root 'icons'));[IO.File]::WriteAllText((Join-Path $root 'icons/Codex-Native.ico'),'generated fixture')
$official='C:\Program Files\WindowsApps\OpenAI.Codex_26.1016.8622.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
Assert-Startup (Test-WallpaperShortcutRepair $official '' $entry) 'Old version shortcut was not repairable'
Assert-Startup (-not (Test-WallpaperShortcutRepair 'C:\OtherApp\ChatGPT.exe' '' $entry)) 'Unrelated ChatGPT was captured'
Assert-Startup (-not (Test-WallpaperShortcutRepair $official '--file generated.txt' $entry)) 'Document shortcut arguments would be discarded'
$shell=New-Object -ComObject WScript.Shell
$file=Join-Path $root 'Codex.lnk';$link=$shell.CreateShortcut($file);$link.TargetPath=$official;$link.Description='preserve fixture description';$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
$before=[IO.File]::ReadAllBytes($file);$result=@(Repair-WallpaperEntryShortcuts -Root $root -Candidates @($file));Assert-Startup ($result.Count -eq 1 -and $result[0].changed -and -not $result[0].error) 'Generated shortcut was not repaired'
Assert-Startup ([Convert]::ToHexString([IO.File]::ReadAllBytes($result[0].backup)) -ceq [Convert]::ToHexString($before)) 'Original shortcut backup changed'
$link=$shell.CreateShortcut($file);Assert-Startup ($link.TargetPath -ieq $entry -and $link.Description -eq 'preserve fixture description') 'Shortcut identity/description not preserved';[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
Assert-Startup (@(Repair-WallpaperEntryShortcuts -Root $root -Candidates @($file)).Count -eq 0) 'Repair is not idempotent'
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
Write-Output 'PASS: update/cold/reuse decisions, success history, scoped shortcut repair/backup/idempotence; no client launched.'
