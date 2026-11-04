# Explicit current-user login configuration. Does not activate or close Codex.
function Write-WallpaperLoginRecord([string]$Path,$Record) {
  $next=$Path+'.next'
  [IO.File]::WriteAllText($next,($Record|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  [IO.File]::Move($next,$Path,$true)
}
function Get-WallpaperLoginNativeState([string]$RegistryPath) {
  $exists=$false;$value=$null
  if(Test-Path -LiteralPath $RegistryPath){
    $key=Get-Item -LiteralPath $RegistryPath -ErrorAction Stop
    try{
      $exists='State' -in $key.GetValueNames()
      if($exists){
        if($key.GetValueKind('State') -ne [Microsoft.Win32.RegistryValueKind]::DWord){throw 'Unexpected native startup State type; preserved.'}
        $value=[int]$key.GetValue('State')
      }
    }finally{$key.Dispose()}
  }
  [pscustomobject]@{exists=$exists;value=$value}
}
function Restore-WallpaperLoginNativeState([string]$RegistryPath,$State) {
  $current=Get-WallpaperLoginNativeState $RegistryPath
  if($current.exists -eq $State.exists -and $current.value -eq $State.value){return}
  if($State.exists){Set-ItemProperty -LiteralPath $RegistryPath -Name State -Value ([int]$State.value) -ErrorAction Stop}
  elseif((Get-WallpaperLoginNativeState $RegistryPath).exists){Remove-ItemProperty -LiteralPath $RegistryPath -Name State -ErrorAction Stop}
}
function Set-WallpaperLoginStartup {
  param([string]$Root,[string]$StartupDirectory,[string]$RegistryPath,
    [ValidateSet('enable','disable','inspect')][string]$Mode='inspect')
  $Root=[IO.Path]::GetFullPath($Root)
  $entry=Join-Path $Root 'CodexEntry.exe';$source=Join-Path $Root 'Codex.lnk'
  $linkPath=Join-Path $StartupDirectory 'Codex Wallpaper.lnk'
  $recordPath=Join-Path $Root 'login-startup.json'
  $native=Get-WallpaperLoginNativeState $RegistryPath
  $record=$null
  if(Test-Path -LiteralPath $recordPath){
    $record=Get-Content -LiteralPath $recordPath -Raw -ErrorAction Stop|ConvertFrom-Json
    if($record.schemaVersion -ne 1 -or $record.entry -ine $entry -or $record.shortcut -ine $linkPath -or $record.registryPath -ine $RegistryPath){throw 'Login startup record identity mismatch; preserved.'}
    if($record.phase -notin @('enabled','disabled')){throw 'Login setup was interrupted; inspect login-startup.json before changing it.'}
  }
  $linkExists=Test-Path -LiteralPath $linkPath
  $owned=$linkExists -and $record.phase -eq 'enabled' -and (Get-FileHash -LiteralPath $linkPath -Algorithm SHA256 -ErrorAction Stop).Hash -ceq $record.shortcutSha256
  if($Mode -eq 'inspect'){
    return [pscustomobject]@{mode=$Mode;nativeStartupState=$native.value;managedShortcut=$linkPath;shortcutExists=$linkExists;shortcutOwned=[bool]$owned;phase=$record.phase;clientStarted=$false}
  }
  if($linkExists -and -not $owned){throw 'Login shortcut is unowned or was edited; preserved. Inspect the Startup folder before retrying.'}
  if($Mode -eq 'disable'){
    if(-not $record -or $record.phase -eq 'disabled'){return [pscustomobject]@{mode=$Mode;changed=$false;clientStarted=$false}}
    # Do not overwrite a later user/policy change to the native task.
    $restoreNative=$native.exists -and $native.value -eq 1
    $linkBytes=if($owned){[IO.File]::ReadAllBytes($linkPath)}else{$null}
    try{
      if($owned){Remove-Item -LiteralPath $linkPath -ErrorAction Stop}
      if($restoreNative){Restore-WallpaperLoginNativeState $RegistryPath $record.originalNativeState}
      $record.phase='disabled';$record.updatedAt=[DateTimeOffset]::UtcNow.ToString('o')
      Write-WallpaperLoginRecord $recordPath $record
    }catch{
      $failure=$_;$rollbackErrors=@()
      try{if($restoreNative){Restore-WallpaperLoginNativeState $RegistryPath ([pscustomobject]@{exists=$true;value=1})}}catch{$rollbackErrors+='native state: '+$_.Exception.Message}
      try{if($owned -and -not (Test-Path -LiteralPath $linkPath)){[IO.File]::WriteAllBytes($linkPath,$linkBytes)}}catch{$rollbackErrors+='shortcut: '+$_.Exception.Message}
      if($rollbackErrors.Count){throw ($failure.Exception.Message+' Rollback incomplete: '+($rollbackErrors -join '; '))}
      throw $failure
    }
    return [pscustomobject]@{mode=$Mode;changed=$true;nativeStateRestored=[bool]$restoreNative;clientStarted=$false}
  }
  if($native.exists -and $native.value -notin @(0,1,2)){throw 'Native login startup is controlled by policy or has an unknown state; preserved.'}
  foreach($file in @($entry,$source,(Join-Path $Root 'launcher-runtime.json'),(Join-Path $Root 'launch-script.txt'))){if(-not (Test-Path -LiteralPath $file -PathType Leaf)){throw 'Install/build the integrated entry before enabling login startup.'}}
  $shell=New-Object -ComObject WScript.Shell
  try{
    $link=$shell.CreateShortcut($source)
    try{if($link.TargetPath -ine $entry -or $link.Arguments -ne ''){throw 'Integrated shortcut target/arguments do not match the entry.'}}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
  }finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
  # A disabled Windows StartupFolder item must be re-enabled explicitly by the user.
  $approved='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder'
  if(Test-Path -LiteralPath $approved){
    $approval=(Get-ItemProperty -LiteralPath $approved -ErrorAction Stop).PSObject.Properties['Codex Wallpaper.lnk']
    if($approval -and $approval.Value.Length -gt 0 -and $approval.Value[0] -in @(3,7)){throw 'Codex Wallpaper is disabled in Windows Startup apps; enable it there first.'}
  }
  $sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256 -ErrorAction Stop).Hash
  if($owned -and $record.shortcutSha256 -ceq $sourceHash -and $native.exists -and $native.value -eq 1){return [pscustomobject]@{mode=$Mode;changed=$false;clientStarted=$false}}
  $previousRecord=if(Test-Path -LiteralPath $recordPath){[IO.File]::ReadAllBytes($recordPath)}else{$null}
  $previousLink=if($owned){[IO.File]::ReadAllBytes($linkPath)}else{$null}
  $original=if($record.phase -eq 'enabled'){$record.originalNativeState}else{$native}
  $pending=[ordered]@{schemaVersion=1;phase='preparing';entry=$entry;shortcut=$linkPath;shortcutSha256=$sourceHash;registryPath=$RegistryPath;originalNativeState=$original;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
  [void][IO.Directory]::CreateDirectory($StartupDirectory)
  Write-WallpaperLoginRecord $recordPath $pending
  try{
    Copy-Item -LiteralPath $source -Destination $linkPath -Force -ErrorAction Stop
    if((Get-FileHash -LiteralPath $linkPath -Algorithm SHA256 -ErrorAction Stop).Hash -cne $sourceHash){throw 'Login shortcut copy verification failed.'}
    if(-not (Test-Path -LiteralPath $RegistryPath)){[void](New-Item -Path $RegistryPath -ErrorAction Stop)}
    Set-ItemProperty -LiteralPath $RegistryPath -Name State -Value 1 -ErrorAction Stop
    $readback=Get-WallpaperLoginNativeState $RegistryPath
    if(-not $readback.exists -or $readback.value -ne 1){throw 'Native login startup disable verification failed.'}
    $pending.phase='enabled'
    Write-WallpaperLoginRecord $recordPath $pending
  }catch{
    $failure=$_;$rollbackErrors=@()
    try{Restore-WallpaperLoginNativeState $RegistryPath $native}catch{$rollbackErrors+='native state: '+$_.Exception.Message}
    try{
      if($previousLink){[IO.File]::WriteAllBytes($linkPath,$previousLink)}
      elseif((Test-Path -LiteralPath $linkPath) -and (Get-FileHash -LiteralPath $linkPath -Algorithm SHA256 -ErrorAction Stop).Hash -ceq $sourceHash){Remove-Item -LiteralPath $linkPath -ErrorAction Stop}
    }catch{$rollbackErrors+='shortcut: '+$_.Exception.Message}
    if(-not $rollbackErrors.Count){
      try{if($previousRecord){[IO.File]::WriteAllBytes($recordPath,$previousRecord)}else{$pending.phase='disabled';Write-WallpaperLoginRecord $recordPath $pending}}catch{$rollbackErrors+='record: '+$_.Exception.Message}
    }
    if($rollbackErrors.Count){throw ($failure.Exception.Message+' Rollback incomplete: '+($rollbackErrors -join '; ')+'. Original startup state remains in login-startup.json.')}
    throw $failure
  }
  [pscustomobject]@{mode=$Mode;changed=$true;shortcut=$linkPath;nativeStartupState=1;clientStarted=$false;loginAcceptance='pending-next-login'}
}
