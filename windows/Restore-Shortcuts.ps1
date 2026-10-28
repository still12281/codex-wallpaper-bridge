[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[switch]$InspectOnly)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$index=Join-Path $Root 'shortcut-replacements.json'
if(-not (Test-Path -LiteralPath $index)){return}
if(-not $InspectOnly){
  $policyPath=Join-Path $Root 'installation.json'
  $policy=if(Test-Path -LiteralPath $policyPath){Get-Content -LiteralPath $policyPath -Raw|ConvertFrom-Json -AsHashtable}else{@{schemaVersion=1}}
  $policy.shortcutMode='separate'
  [IO.File]::WriteAllText($policyPath,($policy|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
}
$shell=New-Object -ComObject WScript.Shell
try{foreach($record in @((Get-Content -LiteralPath $index -Raw|ConvertFrom-Json).links)){
  $result=[ordered]@{path=$record.path;restored=$false}
  try{
    $expected=Join-Path (Join-Path $Root 'backups/entry-shortcuts') ($record.originalSha256+'.lnk')
    if([IO.Path]::GetFullPath($record.backup) -ine [IO.Path]::GetFullPath($expected) -or (Get-Item -LiteralPath $expected).LinkType){throw 'Unexpected shortcut backup location'}
    if((Get-FileHash -LiteralPath $expected -Algorithm SHA256).Hash -ine $record.originalSha256){throw 'Shortcut backup checksum mismatch'}
    if(-not (Test-Path -LiteralPath $record.path)){$result.reason='shortcut-missing'}
    elseif((Get-FileHash -LiteralPath $record.path -Algorithm SHA256).Hash -ine $record.replacementSha256){$result.reason='shortcut-modified-preserved'}
    else{
      $link=$shell.CreateShortcut($record.path)
      try{if($link.TargetPath -ine (Join-Path $Root 'CodexEntry.exe')){throw 'Shortcut no longer belongs to this entry'}}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
      if($InspectOnly){$result.reason='ready-to-restore'}else{[IO.File]::WriteAllBytes($record.path,[IO.File]::ReadAllBytes($expected));$result.restored=$true}
    }
  }catch{$result.error=$_.Exception.Message}
  [pscustomobject]$result
}}finally{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
