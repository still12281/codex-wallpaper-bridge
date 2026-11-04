$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LoginStartup.ps1')
function Assert-Login($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-LoginFailure([scriptblock]$Action,[string]$Pattern){
  $failure=$null;try{& $Action|Out-Null}catch{$failure=$_.Exception.Message}
  Assert-Login ($failure -match $Pattern) "Expected failure matching $Pattern; got $failure"
}
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('cwb-login-'+[guid]::NewGuid())
$registryRoot='HKCU:\Software\CodexWallpaperBridgeTests\'+[guid]::NewGuid().ToString('N')
$shell=New-Object -ComObject WScript.Shell
$caseNumber=0
function New-LoginFixture($InitialState=2){
  $script:caseNumber++
  $root=Join-Path $fixture "$caseNumber/data";$startup=Join-Path $fixture "$caseNumber/Startup"
  [void][IO.Directory]::CreateDirectory($root);[void][IO.Directory]::CreateDirectory($startup)
  foreach($name in @('CodexEntry.exe','launcher-runtime.json','launch-script.txt')){[IO.File]::WriteAllText((Join-Path $root $name),'fixture')}
  [IO.File]::WriteAllText((Join-Path $root 'settings.json'),'private fixture settings')
  $link=$shell.CreateShortcut((Join-Path $root 'Codex.lnk'));$link.TargetPath=Join-Path $root 'CodexEntry.exe';$link.Arguments='';$link.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
  $registry=Join-Path $registryRoot "$caseNumber"
  [void](New-Item -Path $registry -Force -ErrorAction Stop)
  New-ItemProperty -LiteralPath $registry -Name PreserveOtherValue -Value 'untouched' -PropertyType String -ErrorAction Stop|Out-Null
  if($null -ne $InitialState){New-ItemProperty -LiteralPath $registry -Name State -Value $InitialState -PropertyType DWord -ErrorAction Stop|Out-Null}
  @{Root=$root;StartupDirectory=$startup;RegistryPath=$registry}
}
try{
  foreach($initial in @(0,1,2,$null)){
    $case=New-LoginFixture $initial
    $settings=(Get-FileHash -LiteralPath (Join-Path $case.Root 'settings.json')).Hash
    $inspection=Set-WallpaperLoginStartup @case -Mode inspect
    Assert-Login (-not $inspection.shortcutExists -and -not (Test-Path -LiteralPath (Join-Path $case.Root 'login-startup.json'))) 'Inspect mutated login setup'
    $first=Set-WallpaperLoginStartup @case -Mode enable
    Assert-Login ($first.changed -and -not $first.clientStarted -and (Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 1) 'Enable failed'
    Assert-Login ((Get-ItemPropertyValue -LiteralPath $case.RegistryPath -Name PreserveOtherValue) -eq 'untouched') 'Unrelated native startup value was changed'
    $recordPath=Join-Path $case.Root 'login-startup.json';$recordHash=(Get-FileHash -LiteralPath $recordPath).Hash
    $second=Set-WallpaperLoginStartup @case -Mode enable
    Assert-Login (-not $second.changed -and (Get-FileHash -LiteralPath $recordPath).Hash -ceq $recordHash) 'Repeated enable changed the original restore chain'
    $disabled=Set-WallpaperLoginStartup @case -Mode disable
    $native=Get-WallpaperLoginNativeState $case.RegistryPath
    Assert-Login ($disabled.nativeStateRestored -and $native.exists -eq ($null -ne $initial) -and $native.value -eq $initial) 'Disable did not restore the exact original State presence/value'
    Assert-Login (-not (Test-Path -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk'))) 'Disable kept the owned link'
    Assert-Login ((Get-FileHash -LiteralPath (Join-Path $case.Root 'settings.json')).Hash -ceq $settings) 'Settings changed'
    Assert-Login (-not (Set-WallpaperLoginStartup @case -Mode disable).changed) 'Repeated disable changed configuration'
  }
  $case=New-LoginFixture
  $conflict=Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk';[IO.File]::WriteAllText($conflict,'unrelated shortcut')
  Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode enable} 'unowned'
  Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 2 -and [IO.File]::ReadAllText($conflict) -eq 'unrelated shortcut') 'Conflict changed existing configuration'
  $case=New-LoginFixture
  [void](Set-WallpaperLoginStartup @case -Mode enable)
  $edited=Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk';[IO.File]::WriteAllText($edited,'user edited')
  Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode disable} 'edited'
  Assert-Login ([IO.File]::ReadAllText($edited) -eq 'user edited') 'Edited startup shortcut was removed'
  $case=New-LoginFixture
  [void](Set-WallpaperLoginStartup @case -Mode enable)
  Set-ItemProperty -LiteralPath $case.RegistryPath -Name State -Value 0 -ErrorAction Stop
  $disabled=Set-WallpaperLoginStartup @case -Mode disable
  Assert-Login (-not $disabled.nativeStateRestored -and (Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 0) 'Disable overwrote a later native startup choice'
  foreach($policy in @(3,4,9)){
    $case=New-LoginFixture $policy
    Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode enable} 'policy'
    Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq $policy) 'Policy changed'
  }
  $case=New-LoginFixture
  $writer=${function:Write-WallpaperLoginRecord}
  function Write-WallpaperLoginRecord([string]$Path,$Record){if($Record.phase -eq 'enabled'){throw 'injected record commit failure'};& $writer $Path $Record}
  try{Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode enable} 'injected record commit failure'}finally{Set-Item -LiteralPath Function:\Write-WallpaperLoginRecord -Value $writer}
  Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 2 -and -not (Test-Path -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk'))) 'Commit failure did not roll back both startup mechanisms'
  # A read-only native key must not leave a second login shortcut behind.
  $case=New-LoginFixture
  $script:deniedRegistry=$case.RegistryPath
  function Set-ItemProperty {
    [CmdletBinding()]param([string]$LiteralPath,[string]$Name,$Value)
    if($LiteralPath -eq $script:deniedRegistry){throw 'injected native write denial'}
    Microsoft.PowerShell.Management\Set-ItemProperty @PSBoundParameters
  }
  try{Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode enable} 'injected native write denial'}finally{Remove-Item -LiteralPath Function:\Set-ItemProperty}
  Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 2 -and -not (Test-Path -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk'))) 'Registry denial left duplicate startup paths'
  Assert-Login ((Get-Content -LiteralPath (Join-Path $case.Root 'login-startup.json') -Raw|ConvertFrom-Json).phase -eq 'disabled') 'Unchanged native state was falsely reported as interrupted'
  # A real rollback failure still cleans the new link and retains the baseline.
  $case=New-LoginFixture;$script:deniedRegistry=$case.RegistryPath
  function Set-ItemProperty {
    [CmdletBinding()]param([string]$LiteralPath,[string]$Name,$Value)
    if($LiteralPath -eq $script:deniedRegistry -and $Value -eq 2){throw 'injected native restore denial'}
    Microsoft.PowerShell.Management\Set-ItemProperty @PSBoundParameters
  }
  function Write-WallpaperLoginRecord([string]$Path,$Record){if($Record.phase -eq 'enabled'){throw 'injected commit failure'};& $writer $Path $Record}
  try{Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode enable} 'Rollback incomplete'}finally{Remove-Item -LiteralPath Function:\Set-ItemProperty;Set-Item -LiteralPath Function:\Write-WallpaperLoginRecord -Value $writer}
  $pending=Get-Content -LiteralPath (Join-Path $case.Root 'login-startup.json') -Raw|ConvertFrom-Json
  Assert-Login ($pending.phase -eq 'preparing' -and $pending.originalNativeState.value -eq 2 -and -not (Test-Path -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk'))) 'Rollback failure prevented shortcut cleanup or erased the recovery baseline'
  $case=New-LoginFixture;[void](Set-WallpaperLoginStartup @case -Mode enable)
  $recordBefore=(Get-FileHash -LiteralPath (Join-Path $case.Root 'login-startup.json')).Hash
  $linkBefore=(Get-FileHash -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk')).Hash
  function Write-WallpaperLoginRecord([string]$Path,$Record){if($Record.phase -eq 'disabled'){throw 'injected disable commit failure'};& $writer $Path $Record}
  try{Assert-LoginFailure {Set-WallpaperLoginStartup @case -Mode disable} 'injected disable commit failure'}finally{Set-Item -LiteralPath Function:\Write-WallpaperLoginRecord -Value $writer}
  Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 1 -and (Get-FileHash -LiteralPath (Join-Path $case.StartupDirectory 'Codex Wallpaper.lnk')).Hash -ceq $linkBefore -and (Get-FileHash -LiteralPath (Join-Path $case.Root 'login-startup.json')).Hash -ceq $recordBefore) 'Disable commit failure did not restore the active setup'
  # Updating the installed source link must retain the first native restore point.
  $sourceLink=$shell.CreateShortcut((Join-Path $case.Root 'Codex.lnk'));$sourceLink.Description='updated version';$sourceLink.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sourceLink)
  Assert-Login (Set-WallpaperLoginStartup @case -Mode enable).changed 'Updated source link was not refreshed'
  Assert-Login ((Get-Content -LiteralPath (Join-Path $case.Root 'login-startup.json') -Raw|ConvertFrom-Json).originalNativeState.value -eq 2) 'Shortcut refresh lost the initial native State'
  [void](Set-WallpaperLoginStartup @case -Mode disable)
  Assert-Login ((Get-WallpaperLoginNativeState $case.RegistryPath).value -eq 2) 'Disable after shortcut refresh restored the wrong State'
  foreach($file in @('LoginStartup.ps1','Set-LoginStartup.ps1','Install-Wallpaper.ps1')){
    $tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot "../windows/$file"),[ref]$tokens,[ref]$errors)
    Assert-Login (-not $errors) "Syntax error: $file"
  }
  Write-Output 'PASS: login inspect/enable/disable, exact native State restoration, repeated setup, unrelated values, shortcut conflicts/edits, later user choices, policy refusal and commit-failure rollback. Only isolated registry keys and shortcuts used; no client started.'
}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
