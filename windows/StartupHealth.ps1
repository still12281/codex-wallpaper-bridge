# One-shot entry checks only. Never attach a watcher or replace a running client.
. (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')

function Get-WallpaperStartupCheck {
  param([string]$Root,$Codex,[object[]]$Processes=@(),[bool]$HasVerifiedCdp=$false)
  $previous=$null
  try{$previous=(Get-Content -LiteralPath (Join-Path $Root 'entry-health.json') -Raw -ErrorAction Stop | ConvertFrom-Json).lastSuccess}catch{}
  $roots=@($Processes | Where-Object {$_.IsMain -or (-not $_.PSObject.Properties['IsMain'] -and "$($_.CommandLine)" -notmatch '--type=|--monitor-self')})
  $mode=if($HasVerifiedCdp){'verified-client'}elseif($roots.Count){'ordinary-client-running'}else{'client-absent'}
  [ordered]@{registeredVersion="$($Codex.Version)";registeredPackage="$($Codex.PackageFullName)";previousSuccessfulVersion=$previous.version;versionChanged=if($previous.version){$previous.version -cne "$($Codex.Version)"}else{$null};clientMode=$mode;nextAction=if($HasVerifiedCdp){'reuse-client-and-check-host'}elseif($roots.Count){'preserve-client-wait-for-normal-integrated-launch'}else{'launch-current-package-and-restore-selection'}}
}

function Save-WallpaperStartupHealth {
  param([string]$Root,$Status)
  $previous=$null
  try{$previous=(Get-Content -LiteralPath (Join-Path $Root 'entry-health.json') -Raw -ErrorAction Stop | ConvertFrom-Json).lastSuccess}catch{}
  if($Status.phase -eq 'background-rendered'){$previous=[ordered]@{version=$Status.codexVersion;package=$Status.packageFullName;browserId=$Status.browserId;at=$Status.updatedAt}}
  $health=[ordered]@{schemaVersion=1;checkedAt=$Status.updatedAt;phase=$Status.phase;check=$Status.startupCheck;lastSuccess=$previous;error=$Status.error;shortcuts=$Status.shortcutChecks}
  $next=Join-Path $Root 'entry-health.next.json'
  [IO.File]::WriteAllText($next,($health | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
  [IO.File]::Move($next,(Join-Path $Root 'entry-health.json'),$true)
}

function Test-WallpaperShortcutRepair {
  param([string]$Target,[string]$Arguments,[string]$Entry,[string]$AppId,[string]$CodexAppId)
  # Preserve file/deep-link launchers and unrelated apps sharing the filename.
  if(-not [string]::IsNullOrWhiteSpace($Arguments)){
    return $CodexAppId -and $Target -ieq (Join-Path $env:WINDIR 'explorer.exe') -and $Arguments -ieq ('shell:AppsFolder\'+$CodexAppId)
  }
  if(Test-WallpaperOfficialCodexPath $Target){return $true}
  return $CodexAppId -and $AppId -ceq $CodexAppId -and ([string]::IsNullOrWhiteSpace($Target) -or $Target -ieq ('::{4234d49b-0245-4df3-b780-3893943456e1}\'+$CodexAppId))
}

function Repair-WallpaperEntryShortcuts {
  param([string]$Root,[string[]]$Candidates,[string]$CodexAppId)
  $policy=Join-Path $Root 'installation.json'
  if(Test-Path -LiteralPath $policy){$mode=(Get-Content -LiteralPath $policy -Raw -ErrorAction Stop|ConvertFrom-Json).shortcutMode;if($mode -ne 'replace'){return}}
  $entry=Join-Path $Root 'CodexEntry.exe'
  $icon=Join-Path $Root 'icons/Codex-Native.ico'
  if(-not (Test-Path -LiteralPath $entry -PathType Leaf) -or -not (Test-Path -LiteralPath $icon -PathType Leaf)){return}
  if(-not $PSBoundParameters.ContainsKey('Candidates')){
    $folders=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))
    $Candidates=@(foreach($folder in ($folders | Select-Object -Unique)){if($folder -and (Test-Path -LiteralPath $folder)){Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -Force -ErrorAction SilentlyContinue | Where-Object Name -in @('Codex.lnk','ChatGPT.lnk') | ForEach-Object FullName}})
  }
  if(-not ('CodexWallpaperEntry.LinkIdentity' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'ShortcutIdentity.cs')}
  $shell=New-Object -ComObject WScript.Shell
  try{foreach($file in ($Candidates | Select-Object -Unique)){
    $result=[ordered]@{path=$file;changed=$false}
    $before=$null;$link=$null;$readback=$null;$writeAttempted=$false
    try{
      $link=$shell.CreateShortcut($file)
      $appId=[CodexWallpaperEntry.LinkIdentity]::Get($file)
      if(-not (Test-WallpaperShortcutRepair $link.TargetPath $link.Arguments $entry $appId $CodexAppId)){continue}
      $before=[IO.File]::ReadAllBytes($file)
      $sha=[Security.Cryptography.SHA256]::Create();try{$key=[Convert]::ToHexString($sha.ComputeHash($before)).ToLowerInvariant()}finally{$sha.Dispose()}
      $backupFolder=Join-Path $Root 'backups/entry-shortcuts';[void][IO.Directory]::CreateDirectory($backupFolder)
      $backup=Join-Path $backupFolder ($key+'.lnk');if(-not (Test-Path -LiteralPath $backup)){[IO.File]::WriteAllBytes($backup,$before)}
      if(-not ('CodexWallpaperEntry.LinkIdentity' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'ShortcutIdentity.cs')}
      $link.TargetPath=$entry;$link.Arguments='';$link.WorkingDirectory=$Root;$link.IconLocation=$icon+',0';$writeAttempted=$true;$link.Save()
      $actual=[CodexWallpaperEntry.LinkIdentity]::Set($file,'CodexWallpaperBridge.Codex',('"'+$entry+'"'),($icon+',0'))
      $readback=$shell.CreateShortcut($file)
      if($readback.TargetPath -ine $entry -or $readback.Arguments -ne '' -or $actual -cne 'CodexWallpaperBridge.Codex'){throw 'Shortcut readback mismatch'}
      $indexPath=Join-Path $Root 'shortcut-replacements.json'
      $records=@();if(Test-Path -LiteralPath $indexPath){$records=@((Get-Content -LiteralPath $indexPath -Raw|ConvertFrom-Json).links)}
      $records=@($records|Where-Object {$_.path -ine $file})+@([ordered]@{path=$file;backup=$backup;originalSha256=$key;replacementSha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()})
      $next=$indexPath+'.next';[IO.File]::WriteAllText($next,(@{schemaVersion=1;links=$records}|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false));[IO.File]::Move($next,$indexPath,$true)
      $result.changed=$true;$result.backup=$backup
    }catch{$failure=$_.Exception.Message;if($writeAttempted -and $before){try{[IO.File]::WriteAllBytes($file,$before)}catch{$result.restoreError=$_.Exception.Message}};$result.error=$failure}
    finally{if($link){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link);$link=$null};if($readback){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($readback);$readback=$null}}
    [pscustomobject]$result
  }}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
}
