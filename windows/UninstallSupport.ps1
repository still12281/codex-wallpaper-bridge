# Only remove unchanged shortcuts explicitly published by this installation.
function Remove-WallpaperManagedShortcuts {
  param([string]$Root,[string[]]$AllowedPaths,[switch]$InspectOnly)
  $recordPath=Join-Path $Root 'managed-shortcuts.json'
  if(-not (Test-Path -LiteralPath $recordPath)){return}
  $record=Get-Content -LiteralPath $recordPath -Raw -ErrorAction Stop|ConvertFrom-Json
  if($record.schemaVersion -ne 1){throw 'Unknown managed shortcut record; preserved.'}
  $entry=[IO.Path]::GetFullPath((Join-Path $Root 'CodexEntry.exe'))
  $allowed=@($AllowedPaths|ForEach-Object {[IO.Path]::GetFullPath($_)})
  $plan=@();$shell=New-Object -ComObject WScript.Shell
  try{foreach($link in @($record.links)){
    if(-not [IO.Path]::IsPathFullyQualified($link.path) -or [IO.Path]::GetFullPath($link.path) -inotIn $allowed -or $link.entry -ine $entry -or $link.sha256 -notmatch '^[0-9a-f]{64}$'){throw 'Managed shortcut identity mismatch; preserved.'}
    $result=[ordered]@{path=$link.path;removed=$false;reason='missing'}
    if(Test-Path -LiteralPath $link.path){
      if((Get-FileHash -LiteralPath $link.path -Algorithm SHA256 -ErrorAction Stop).Hash -ine $link.sha256){$result.reason='modified-preserved'}else{
        $shortcut=$shell.CreateShortcut($link.path)
        try{if($shortcut.TargetPath -ine $entry -or $shortcut.Arguments){throw 'Managed shortcut target changed; preserved.'}}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)}
        $result.reason='owned';$result.sha256=$link.sha256
      }
    }
    $plan+=,[pscustomobject]$result
  }}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
  foreach($item in $plan){
    if($item.reason -eq 'owned' -and -not $InspectOnly){
      if((Get-FileHash -LiteralPath $item.path -Algorithm SHA256 -ErrorAction Stop).Hash -ine $item.sha256){throw 'Shortcut changed during uninstall; preserved.'}
      Remove-Item -LiteralPath $item.path -ErrorAction Stop;$item.removed=$true
    }
    $item
  }
}

function Get-WallpaperUninstallLoginRecord([string]$Root,[string]$StartupDirectory) {
  $file=Join-Path $Root 'login-startup.json'
  if(-not (Test-Path -LiteralPath $file)){return $null}
  $record=Get-Content -LiteralPath $file -Raw -ErrorAction Stop|ConvertFrom-Json
  $prefix='HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\OpenAI.Codex_2p2nqsd0c76g0\'
  if($record.schemaVersion -ne 1 -or $record.entry -ine (Join-Path $Root 'CodexEntry.exe') -or $record.shortcut -ine (Join-Path $StartupDirectory 'Codex Wallpaper.lnk') -or $record.registryPath -notmatch ('^'+[regex]::Escape($prefix)+'[a-zA-Z0-9_.-]+$')){throw 'Login startup uninstall identity mismatch; preserved.'}
  return $record
}
