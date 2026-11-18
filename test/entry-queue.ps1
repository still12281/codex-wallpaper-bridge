$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-entry-queue-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
$windows=Join-Path $PSScriptRoot '../windows'
$entrySource=Join-Path $root 'CodexEntry.cs'
$source=[IO.File]::ReadAllText((Join-Path $windows 'CodexEntry.cs'))
# Isolate the fixture's mutexes from the user's installed launcher.
$suffix=[guid]::NewGuid().ToString('N')
$source=$source.Replace('Entry.9335',"Entry.$suffix").Replace('Entry.Pending.9335',"Entry.Pending.$suffix")
[IO.File]::WriteAllText($entrySource,$source,[Text.UTF8Encoding]::new($true))
$entry=Join-Path $root 'CodexEntry.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sources=@($entrySource)+@('TaskbarIdentity.cs','CleanProcess.cs','ClientWindow.cs','TcpListeners.cs' | ForEach-Object {Join-Path $windows $_})
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll ('/out:'+$entry) @sources
if($LASTEXITCODE -ne 0){throw 'Fixture launcher compilation failed'}
$bootstrap=Join-Path $root 'bootstrap.ps1'
[IO.File]::WriteAllText((Join-Path $root 'launch-script.txt'),$bootstrap)
[IO.File]::WriteAllText($bootstrap,@'
$calls=Join-Path $PSScriptRoot 'calls.txt'
[IO.File]::AppendAllText($calls,"$PID`n")
if([IO.File]::ReadAllLines($calls).Count -eq 1){
  $clock=[Diagnostics.Stopwatch]::StartNew()
  while(-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'release'))){
    if($clock.Elapsed.TotalSeconds -gt 10){exit 1}
    Start-Sleep -Milliseconds 20
  }
}
@{helperPid=$PID;phase='background-rendered'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'launch-status.json')
'@)
$calls=Join-Path $root 'calls.txt'
$info=[Diagnostics.ProcessStartInfo]::new($entry)
$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
$info.Environment['CODEX_WALLPAPER_PWSH']=(Get-Process -Id $PID).Path
$info.Environment['CODEX_WALLPAPER_NODE']=(Get-Command node.exe -ErrorAction Stop).Source
$first=[Diagnostics.Process]::Start($info);$second=$null
try{
  $clock=[Diagnostics.Stopwatch]::StartNew()
  while(-not (Test-Path -LiteralPath $calls)){
    if($clock.Elapsed.TotalSeconds -gt 7 -or $first.HasExited){throw 'First entry did not reach its bootstrap'}
    Start-Sleep -Milliseconds 20
  }
  $second=[Diagnostics.Process]::Start($info)
  $pending=[Threading.Mutex]::new($false,"Local\CodexWallpaperBridge.Entry.Pending.$suffix")
  try{
    $clock.Restart()
    while($pending.WaitOne(0)){
      $pending.ReleaseMutex()
      if($clock.Elapsed.TotalSeconds -gt 2 -or $second.HasExited){throw 'Second click was discarded instead of waiting'}
      Start-Sleep -Milliseconds 20
    }
    if([IO.File]::ReadAllLines($calls).Count -ne 1){throw 'Two bootstraps ran concurrently'}
  }finally{$pending.Dispose()}
  [IO.File]::WriteAllText((Join-Path $root 'release'),'continue')
  if(-not $first.WaitForExit(5000) -or -not $second.WaitForExit(8000) -or $first.ExitCode -ne 0 -or $second.ExitCode -ne 0){throw 'Queued launcher did not finish after the first'}
  if([IO.File]::ReadAllLines($calls).Count -ne 2){throw 'The queued click did not reach its own bootstrap'}
}finally{
  [IO.File]::WriteAllText((Join-Path $root 'release'),'continue')
  foreach($process in @($first,$second)){if($process){if(-not $process.HasExited){$process.Kill()};$process.Dispose()}}
}
Write-Output 'PASS: compiled taskbar launcher serializes an overlapping manual click and processes it once the first request finishes.'
