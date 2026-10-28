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
  param([string]$Target,[string]$Arguments,[string]$Entry)
  # Preserve file/deep-link launchers and unrelated apps sharing the filename.
  -not [string]::IsNullOrWhiteSpace($Target) -and [string]::IsNullOrWhiteSpace($Arguments) -and
    (Test-WallpaperOfficialCodexPath $Target) -and -not [string]::Equals($Target,$Entry,[StringComparison]::OrdinalIgnoreCase)
}

function Repair-WallpaperEntryShortcuts {
  param([string]$Root,[string[]]$Candidates)
  $entry=Join-Path $Root 'CodexEntry.exe'
  $icon=Join-Path $Root 'icons/Codex-Native.ico'
  if(-not (Test-Path -LiteralPath $entry -PathType Leaf) -or -not (Test-Path -LiteralPath $icon -PathType Leaf)){return}
  if(-not $PSBoundParameters.ContainsKey('Candidates')){
    $folders=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'),(Join-Path $env:APPDATA 'Microsoft/Internet Explorer/Quick Launch/User Pinned'))
    $Candidates=@(foreach($folder in ($folders | Select-Object -Unique)){if($folder -and (Test-Path -LiteralPath $folder)){Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -Force -ErrorAction SilentlyContinue | Where-Object Name -in @('Codex.lnk','ChatGPT.lnk') | ForEach-Object FullName}})
  }
  $shell=New-Object -ComObject WScript.Shell
  try{foreach($file in ($Candidates | Select-Object -Unique)){
    $result=[ordered]@{path=$file;changed=$false}
    $before=$null;$link=$null;$readback=$null;$writeAttempted=$false
    try{
      $link=$shell.CreateShortcut($file)
      if(-not (Test-WallpaperShortcutRepair $link.TargetPath $link.Arguments $entry)){continue}
      $before=[IO.File]::ReadAllBytes($file)
      $sha=[Security.Cryptography.SHA256]::Create();try{$key=[Convert]::ToHexString($sha.ComputeHash($before)).ToLowerInvariant()}finally{$sha.Dispose()}
      $backupFolder=Join-Path $Root 'backups/entry-shortcuts';[void][IO.Directory]::CreateDirectory($backupFolder)
      $backup=Join-Path $backupFolder ($key+'.lnk');if(-not (Test-Path -LiteralPath $backup)){[IO.File]::WriteAllBytes($backup,$before)}
      if(-not ('CodexWallpaperEntry.LinkIdentity' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'ShortcutIdentity.cs')}
      $link.TargetPath=$entry;$link.Arguments='';$link.WorkingDirectory=$Root;$link.IconLocation=$icon+',0';$writeAttempted=$true;$link.Save()
      $actual=[CodexWallpaperEntry.LinkIdentity]::Set($file,'CodexWallpaperBridge.Codex',('"'+$entry+'"'),($icon+',0'))
      $readback=$shell.CreateShortcut($file)
      if($readback.TargetPath -ine $entry -or $readback.Arguments -ne '' -or $actual -cne 'CodexWallpaperBridge.Codex'){throw 'Shortcut readback mismatch'}
      $result.changed=$true;$result.backup=$backup
    }catch{$failure=$_.Exception.Message;if($writeAttempted -and $before){try{[IO.File]::WriteAllBytes($file,$before)}catch{$result.restoreError=$_.Exception.Message}};$result.error=$failure}
    finally{if($link){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link);$link=$null};if($readback){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($readback);$readback=$null}}
    [pscustomobject]$result
  }}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
}
