$ErrorActionPreference='Stop'

$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-entry-window-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
$windows=Join-Path $PSScriptRoot '../windows'
$suffix=[guid]::NewGuid().ToString('N')
$source=[IO.File]::ReadAllText((Join-Path $windows 'CodexEntry.cs'))
$source=$source.Replace('Entry.9335',"Entry.$suffix").Replace('Entry.Pending.9335',"Entry.Pending.$suffix")
$entrySource=Join-Path $root 'CodexEntry.cs'
[IO.File]::WriteAllText($entrySource,$source,[Text.UTF8Encoding]::new($true))

# Substitute only the OS queries with a visible window owned by an isolated process.
$stubs=Join-Path $root 'WindowFixture.cs'
[IO.File]::WriteAllText($stubs,@'
using System;
using System.Diagnostics;
using System.IO;
internal static class WallpaperIdentity {
 internal const string AppId="CodexWallpaperBridge.Test";
 internal static bool Official(Process p){return p.Id==int.Parse(Environment.GetEnvironmentVariable("CWB_FIXTURE_PID"));}
}
internal static class WallpaperClientWindow {
 internal static bool Bound(long h,int p,long c){return h==123&&c==456&&p==int.Parse(Environment.GetEnvironmentVariable("CWB_FIXTURE_PID"));}
 internal static bool Visible(long h){
  var marker=Environment.GetEnvironmentVariable("CWB_FIXTURE_EXIT_MARKER");
  if(!string.IsNullOrEmpty(marker))File.WriteAllText(marker,"accepted");
  return true;
 }
 internal static bool Minimized(long h){return false;}
 internal static bool Foreground(long h){return true;}
 internal static void Activate(long h,int p,string exe,long ticks,long c){throw new InvalidOperationException("A foreground window did not need activation");}
}
namespace CodexWallpaperBridge {
 internal class Listener {public int OwningProcess;public string LocalAddress;}
 internal static class TcpListeners {
  internal static Listener[] Read(int port){return new[]{new Listener{OwningProcess=int.Parse(Environment.GetEnvironmentVariable("CWB_FIXTURE_PID")),LocalAddress="127.0.0.1"}};}
 }
}
'@)
$entry=Join-Path $root 'CodexEntry.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll ('/out:'+$entry) $entrySource $stubs (Join-Path $windows 'CleanProcess.cs')
if($LASTEXITCODE -ne 0){throw 'Fixture launcher compilation failed'}

$bootstrap=Join-Path $root 'bootstrap.ps1'
$fixture=Join-Path $root 'root.ps1'
$exitMarker=Join-Path $root 'fixture-exit'
[IO.File]::WriteAllText((Join-Path $root 'launch-script.txt'),$bootstrap)
[IO.File]::WriteAllText($fixture,@'
$signal=Join-Path $PSScriptRoot 'fixture-exit'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'fixture-ready'),'yes')
$timeout=[Diagnostics.Stopwatch]::StartNew()
while(-not [IO.File]::Exists($signal) -and $timeout.Elapsed.TotalSeconds -lt 20){Start-Sleep -Milliseconds 10}
'@)
[IO.File]::WriteAllText($bootstrap,@'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'bootstrap-ran'),'yes')
@{helperPid=$PID;phase='background-rendered'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'launch-status.json')
'@)

$pwsh=(Get-Process -Id $PID).Path
$info=[Diagnostics.ProcessStartInfo]::new($pwsh,('-NoProfile -File "'+$fixture+'"'))
$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$fakeRoot=[Diagnostics.Process]::Start($info)
try{
  $clock=[Diagnostics.Stopwatch]::StartNew()
  while(-not [IO.File]::Exists((Join-Path $root 'fixture-ready'))){
    if($fakeRoot.HasExited -or $clock.ElapsedMilliseconds -gt 5000){throw 'Fixture process failed to become ready'}
    Start-Sleep -Milliseconds 20
  }
  $started=$fakeRoot.StartTime.ToUniversalTime().ToString('o')
  $browser='11111111-2222-4333-8444-555555555555'
  $endpoint=@{schemaVersion=1;address='127.0.0.1';port=9335;processId=$fakeRoot.Id;browserId=$browser;executable=$pwsh;createdAtUtc=$started}
  $binding=@{schemaVersion=2;clientId=$fakeRoot.Id;startedAt=$started;executable=$pwsh;sessionId=$fakeRoot.SessionId;browserId=$browser;mainTarget='A11';handle=123;cookie='456'}
  $runtime=@{cdpPort=9335;browserId=$browser;phase='background-rendered';updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
  foreach($record in @{ 'cdp-endpoint.json'=$endpoint; 'main-window.json'=$binding; 'runtime-status.json'=$runtime }.GetEnumerator()){
    [IO.File]::WriteAllText((Join-Path $root $record.Key),($record.Value|ConvertTo-Json))
  }
  $entryInfo=[Diagnostics.ProcessStartInfo]::new($entry)
  $entryInfo.UseShellExecute=$false;$entryInfo.CreateNoWindow=$true
  $entryInfo.Environment['CWB_FIXTURE_PID']=[string]$fakeRoot.Id
  $entryInfo.Environment['CODEX_WALLPAPER_PWSH']=$pwsh
  $entryInfo.Environment['CODEX_WALLPAPER_NODE']=(Get-Command node.exe -ErrorAction Stop).Source
  function Invoke-FixtureEntry {
    $child=[Diagnostics.Process]::Start($entryInfo)
    try{if(-not $child.WaitForExit(5000)){throw 'Fixture launcher was blocked'};if($child.ExitCode -ne 0){throw "Fixture launcher failed: $($child.ExitCode)"}}
    finally{if(-not $child.HasExited){$child.Kill()};$child.Dispose()}
  }

  $lock=[Threading.Mutex]::new($false,"Local\CodexWallpaperBridge.Entry.$suffix")
  if(-not $lock.WaitOne(0)){throw 'Fixture lock could not be acquired'}
  try{Invoke-FixtureEntry}finally{$lock.ReleaseMutex();$lock.Dispose()}
  $activation=Get-Content -LiteralPath (Join-Path $root 'activation-status.json') -Raw|ConvertFrom-Json
  if($activation.activationMode -ne 'native-visible-window' -or $activation.activationResult -ne 'foreground' -or [IO.File]::Exists((Join-Path $root 'bootstrap-ran'))){throw 'The visible window depended on CDP or wallpaper startup completion'}

  $entryInfo.Environment['CWB_FIXTURE_EXIT_MARKER']=$exitMarker
  Invoke-FixtureEntry
  if(-not $fakeRoot.HasExited -or -not [IO.File]::Exists((Join-Path $root 'bootstrap-ran'))){throw 'The click was lost when the selected process exited'}
}finally{
  [IO.File]::WriteAllText($exitMarker,'stop')
  if(-not $fakeRoot.WaitForExit(3000)){$fakeRoot.Kill()}
  $fakeRoot.Dispose()
}

Write-Output 'PASS: visible-window dispatch bypasses a busy boot; an exiting process leaves the same click available to the bootstrap.'
