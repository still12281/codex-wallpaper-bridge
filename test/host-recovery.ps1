$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
. (Join-Path $repo 'windows/Runtime.ps1')
$node=Get-WallpaperNode
$pwsh=(Get-Process -Id $PID).Path
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('cwb-host-recovery-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch|Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$worker=Join-Path $scratch 'RecoveryFixture.exe'
& $compiler /nologo /target:winexe /reference:System.Web.Extensions.dll "/out:$worker" (Join-Path $repo 'windows/HostRecovery.cs') (Join-Path $repo 'windows/CleanProcess.cs')
if($LASTEXITCODE){throw 'Recovery fixture build failed'}

function Start-FixtureProcess([string]$File,[string[]]$Arguments) {
  $options=[Diagnostics.ProcessStartInfo]::new($File)
  $options.UseShellExecute=$false;$options.CreateNoWindow=$true
  foreach($argument in $Arguments){$options.ArgumentList.Add($argument)}
  [Diagnostics.Process]::Start($options)
}

function Test-Recovery([string]$Name,[int]$HostDelay,[int]$ClientDelay,[int]$AttachExit,[int]$ExpectedAttempts,[int]$Prior=0) {
  $data=Join-Path $scratch $Name
  New-Item -ItemType Directory -Path $data|Out-Null
  $script=Join-Path $data 'attach.ps1'
  @'
param([switch]$AttachOnly,[string]$ExpectedRecoveryClient,[int]$RecoveryAttempt)
if(-not $AttachOnly -or $ExpectedRecoveryClient -cne (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'expected.txt') -Raw).Trim()){exit 6}
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'attempts.txt') -Value "$RecoveryAttempt"
exit [int](Get-Content -LiteralPath (Join-Path $PSScriptRoot 'attach-exit.txt') -Raw)
'@ | Set-Content -LiteralPath $script
  $script|Set-Content -LiteralPath (Join-Path $data 'launch-script.txt')
  $AttachExit|Set-Content -LiteralPath (Join-Path $data 'attach-exit.txt')
  'fixture stderr'|Set-Content -LiteralPath (Join-Path $data 'video-error.log')
  $client=Start-FixtureProcess $node @('-e',"setTimeout(()=>{},$ClientDelay)")
  $hostProcess=Start-FixtureProcess $node @('-e',"setTimeout(()=>process.exit(17),$HostDelay)")
  $browser='e64aa47b-472a-494c-a889-68c155d08046'
  $clientTicks=$client.StartTime.ToUniversalTime().Ticks
  "$($client.Id):${clientTicks}:$browser"|Set-Content -LiteralPath (Join-Path $data 'expected.txt')
  $watchArgs=@($data,$pwsh,"$($client.Id)","$clientTicks","$($hostProcess.Id)","$($hostProcess.StartTime.ToUniversalTime().Ticks)",$browser,"$Prior")
  $first=Start-FixtureProcess $worker $watchArgs
  $second=Start-FixtureProcess $worker $watchArgs
  try {
    if(-not $first.WaitForExit(20000) -or -not $second.WaitForExit(20000) -or $first.ExitCode -or $second.ExitCode){throw "$Name watcher did not complete"}
    $attempts=Join-Path $data 'attempts.txt'
    $actual=if(Test-Path -LiteralPath $attempts){@(Get-Content -LiteralPath $attempts).Count}else{0}
    if($actual -ne $ExpectedAttempts){throw "$Name expected $ExpectedAttempts attempts, got $actual"}
    $events=Join-Path $data 'host-recovery.jsonl'
    if($HostDelay -lt $ClientDelay){
      $records=@(Get-Content -LiteralPath $events | ForEach-Object {ConvertFrom-Json -InputObject $_})
      if(@($records|Where-Object state -eq 'host-exited').Count -ne 1 -or $records[0].exitCode -ne 17 -or $records[0].stderr -notmatch 'fixture stderr'){
        throw "$Name did not retain the exit diagnostics exactly once"
      }
      if($AttachExit -ne 0 -and $records[-1].state -ne 'manual-repair-required'){throw "$Name did not report the recovery limit"}
    }elseif(Test-Path -LiteralPath $events){throw "$Name treated Codex exit as an unexpected host exit"}
    [pscustomobject]@{name=$Name;attachAttempts=$actual;duplicateWatchersSuppressed=$true}
  } finally {
    foreach($fixture in @($first,$second,$hostProcess,$client)){$fixture.Dispose()}
  }
}

Test-Recovery 'attach' 1800 12500 0 1
Test-Recovery 'bounded' 1800 12500 7 2
Test-Recovery 'limit-inherited' 1800 12500 7 0 2
Test-Recovery 'client-exit' 2500 900 7 0
