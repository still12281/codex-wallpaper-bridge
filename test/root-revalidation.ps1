$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
function Assert-Root($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$process=Get-Process -Id $PID -ErrorAction Stop;[void]$process.Handle
$identity=[pscustomobject]@{RootProcessId=$PID;RootCreatedAtUtc=$process.StartTime.ToUniversalTime().ToString('o');RootExecutable=$process.MainModule.FileName;SessionId=$process.SessionId;BrowserId='verified-browser'}
$codex=[pscustomobject]@{Executable=$identity.RootExecutable}
$script:owner=$PID;$script:public=$false;$script:listenerReads=0;$script:browser='verified-browser';$script:changeOwner=$false;$script:disposeRoot=$false
function Get-DreamSkinPortListeners {param($Port) $script:listenerReads++;[pscustomobject]@{LocalAddress=$(if($script:public){'0.0.0.0'}else{'127.0.0.1'});OwningProcess=$script:owner}}
function Get-DreamSkinCdpBrowserIdentity {param($Port) if($script:changeOwner){$script:owner++};if($script:disposeRoot){$process.Dispose()};[pscustomobject]@{BrowserId=$script:browser}}
function Get-CimInstance {throw 'Pinned-root revalidation must not repeat CIM discovery'}
try{
  Assert-Root ($null -ne (Get-WallpaperReverifiedEndpoint $process $identity 9335 $codex)) 'A live verified native root was rejected'
  Assert-Root ($script:listenerReads -eq 2) 'Listener was not checked before and after HTTP'
  foreach($field in @('RootProcessId','RootCreatedAtUtc','RootExecutable','SessionId')){
    $bad=$identity.PSObject.Copy()
    switch($field){'RootProcessId'{$bad.$field++};'RootCreatedAtUtc'{$bad.$field=([DateTimeOffset]::Parse($bad.$field)).AddTicks(1).ToString('o')};'RootExecutable'{$bad.$field+='-other'};'SessionId'{$bad.$field++}}
    Assert-Root (-not (Get-WallpaperReverifiedEndpoint $process $bad 9335 $codex)) ('Changed/PID-reused root accepted: '+$field)
  }
  $script:public=$true;Assert-Root (-not (Get-WallpaperReverifiedEndpoint $process $identity 9335 $codex)) 'Public listener accepted';$script:public=$false
  $script:browser='other-browser';Assert-Root (-not (Get-WallpaperReverifiedEndpoint $process $identity 9335 $codex)) 'Changed browser accepted';$script:browser='verified-browser'
  $script:changeOwner=$true;Assert-Root (-not (Get-WallpaperReverifiedEndpoint $process $identity 9335 $codex)) 'Listener ownership changed during HTTP';$script:changeOwner=$false;$script:owner=$PID
  $script:disposeRoot=$true;Assert-Root (-not (Get-WallpaperReverifiedEndpoint $process $identity 9335 $codex)) 'Disposed native identity was reused';$script:disposeRoot=$false
}finally{$process.Dispose()}
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path;$info.Arguments='-NoProfile -Command "Start-Sleep -Milliseconds 400"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
$child=[Diagnostics.Process]::Start($info)
try{
  [void]$child.Handle
  $exited=[pscustomobject]@{RootProcessId=$child.Id;RootCreatedAtUtc=$child.StartTime.ToUniversalTime().ToString('o');RootExecutable=$child.MainModule.FileName;SessionId=$child.SessionId;BrowserId='verified-browser'}
  Assert-Root ($child.WaitForExit(5000)) 'Fixture child did not exit naturally'
  Assert-Root (-not (Get-WallpaperReverifiedEndpoint $child $exited 9335 ([pscustomobject]@{Executable=$exited.RootExecutable}))) 'An exited pinned process handle was accepted'
}finally{$child.Dispose()}
Write-Output 'PASS: retained native handle, exact creation/session/path, PID replacement, HTTP/listener ownership change, disposed handle and naturally exited child; no CIM discovery repeated.'
& {
  $script:fallback=$identity.PSObject.Copy();$script:fallbackReads=0;$script:pendingUsed=$null
  function Get-WallpaperReverifiedEndpoint {throw 'Permission fallback must not use a retained-handle fast path'}
  function Get-WallpaperVerifiedEndpoint {param($Port,$Codex,[switch]$AllowPendingPage) $script:fallbackReads++;$script:pendingUsed=$AllowPendingPage.IsPresent;$script:fallback}
  Assert-Root ($null -ne (Get-WallpaperKnownRootEndpoint -Identity $identity -Port 9335 -Codex $codex)) 'No-handle compatibility fallback was rejected'
  Assert-Root ($script:fallbackReads -eq 1 -and $script:pendingUsed -eq $false) 'Fallback did not preserve strict page validation'
  Assert-Root ($null -ne (Get-WallpaperKnownRootEndpoint -Identity $identity -Port 9335 -Codex $codex -AllowPendingPage)) 'Pending-browser fallback was rejected'
  Assert-Root ($script:pendingUsed -eq $true) 'Pending-page fallback lost its explicit mode'
  $script:fallback.BrowserId='other-browser'
  Assert-Root (-not (Get-WallpaperKnownRootEndpoint -Identity $identity -Port 9335 -Codex $codex)) 'Compatibility fallback changed the known browser'
  $script:fallback=$identity.PSObject.Copy();$script:fallback.RootCreatedAtUtc='replacement-process'
  Assert-Root (-not (Get-WallpaperKnownRootEndpoint -Identity $identity -Port 9335 -Codex $codex)) 'Compatibility fallback changed the known root'
  Write-Output 'PASS: original strict/pending verification remains available without a retained handle and cannot switch browser/root identity.'
}
