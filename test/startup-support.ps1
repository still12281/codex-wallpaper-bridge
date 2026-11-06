$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/StartupSupport.ps1')
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('cwb-support-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory($scratch)
$base=Join-Path $scratch 'base';Build-WallpaperStartupSupport -Root $base
$childText=@'
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')
. (Join-Path $PSScriptRoot 'CleanProcess.ps1')
if($env:CWB_SUPPORT_CASE -eq 'partial'){Add-Type -LiteralPath (Join-Path $PSScriptRoot 'CleanProcess.cs')}
Import-WallpaperCleanProcess
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start()
try{
  $rows=@(Get-WallpaperTcpListeners $listener.LocalEndpoint.Port)
  if(-not @($rows|Where-Object {$_.OwningProcess -eq $PID -and $_.LocalAddress -eq '127.0.0.1'}).Count){throw 'Compiled helper failed actual listener ownership'}
}finally{$listener.Stop()}
$cached=[WallpaperCleanProcess].Assembly.Location -ne '' -and [CodexWallpaperBridge.TcpListeners].Assembly.Location -ne ''
if($cached -ne ($env:CWB_SUPPORT_CASE -eq 'hit')){throw ('Unexpected cache outcome: '+$env:CWB_SUPPORT_CASE)}
$child=Start-WallpaperCleanProcess -FilePath (Get-Process -Id $PID).Path -ArgumentList @('-NoProfile','-Command','exit 23') -Hidden
try{if(-not $child.WaitForExit(5000) -or $child.ExitCode -ne 23){throw 'Loaded helper failed real child launch/exit status'}}finally{$child.Dispose()}
'@
foreach($case in @('hit','missing','changed-source','corrupt-dll','invalid-assembly','partial')){
  $root=Join-Path $scratch $case;$windows=Join-Path $root 'windows';[void][IO.Directory]::CreateDirectory($windows)
  foreach($file in @('StartupSupport.ps1','LaunchPolicy.ps1','CleanProcess.ps1','CleanProcess.cs','TcpListeners.cs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot "../windows/$file") -Destination (Join-Path $windows $file) -ErrorAction Stop}
  if($case -ne 'missing'){
    $cache=Join-Path $root 'startup-support';[void][IO.Directory]::CreateDirectory($cache)
    foreach($file in @('cache.json','StartupSupport.dll')){Copy-Item -LiteralPath (Join-Path $base "startup-support/$file") -Destination (Join-Path $cache $file) -ErrorAction Stop}
    if($case -eq 'changed-source'){[IO.File]::AppendAllText((Join-Path $windows 'TcpListeners.cs'),[Environment]::NewLine+'// generated source-change fixture')}
    if($case -in @('corrupt-dll','invalid-assembly')){
      [IO.File]::WriteAllText((Join-Path $cache 'StartupSupport.dll'),'Generated non-assembly fixture')
      if($case -eq 'invalid-assembly'){$record=Get-Content -LiteralPath (Join-Path $cache 'cache.json') -Raw|ConvertFrom-Json;$record.dllSha256=(Get-FileHash -LiteralPath (Join-Path $cache 'StartupSupport.dll') -Algorithm SHA256).Hash;$record|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $cache 'cache.json')}
    }
  }
  $childFile=Join-Path $windows 'fixture.ps1';[IO.File]::WriteAllText($childFile,$childText,[Text.UTF8Encoding]::new($false))
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path;$info.Arguments='-NoProfile -File "'+$childFile+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.Environment['CODEX_WALLPAPER_DATA_DIR']=$root;$info.Environment['CWB_SUPPORT_CASE']=$case
  $child=[Diagnostics.Process]::Start($info)
  try{if(-not $child.WaitForExit(15000)){throw 'Support fixture timed out'};if($child.ExitCode -ne 0){throw ('Support fixture failed: '+$case)}}finally{$child.Dispose()}
  Write-Output ('PASS: startup support '+$case+'; actual listener/child behavior checked in a fresh PowerShell process.')
}
