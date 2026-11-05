$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/CleanProcess.ps1')
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('cwb-clean-process-'+[guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($scratch)
$exe=Join-Path $scratch 'socket fixture.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe /platform:x64 /reference:System.Web.Extensions.dll ('/out:'+$exe) (Join-Path $PSScriptRoot '../windows/CleanProcess.cs') (Join-Path $PSScriptRoot 'fixtures/socket-inheritance.cs')
if($LASTEXITCODE -ne 0){throw 'Socket fixture compilation failed'}
function Assert-Clean($condition,[string]$message){if(-not $condition){throw $message}}
function Can-Bind([int]$port){$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port);$listener.Server.ExclusiveAddressUse=$true;try{$listener.Start();return $true}catch{return $false}finally{$listener.Stop()}}
for($index=0;$index -lt 10;$index++){
 $fast=Start-WallpaperCleanProcess -FilePath $exe -ArgumentList @('quickexit') -Hidden
 try{Assert-Clean ($fast.WaitForExit(5000) -and $fast.ExitCode -eq 23) 'Short-lived child exit status lost'}finally{$fast.Dispose()}
}
foreach($mode in @('legacy','clean','logs')){
 $parentFile=Join-Path $scratch ($mode+' parent.json');$childFile=Join-Path $scratch ($mode+' child.json');$stop=Join-Path $scratch ($mode+'.stop')
 $parent=Start-WallpaperCleanProcess -FilePath $exe -ArgumentList @($mode,$parentFile,$childFile,$stop) -Hidden
 try{
  Assert-Clean ($parent.WaitForExit(10000)) 'Fixture parent did not exit'
  Assert-Clean ($parent.ExitCode -eq 0) 'Fixture parent failed'
  $end=[DateTime]::UtcNow.AddSeconds(5);while(-not (Test-Path -LiteralPath $childFile) -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 25}
  $root=Get-Content -LiteralPath $parentFile -Raw|ConvertFrom-Json;$child=Get-Content -LiteralPath $childFile -Raw|ConvertFrom-Json
  $live=Get-Process -Id $root.child -ErrorAction Stop
  try{Assert-Clean (-not $live.HasExited) 'Fixture child must stay alive during bind check'}finally{$live.Dispose()}
  if($mode -eq 'legacy'){
   Assert-Clean $child.inherited 'Control fixture did not reproduce socket inheritance'
   Assert-Clean (-not (Can-Bind $root.port)) 'Control fixture did not retain parent listener'
  }else{
   Assert-Clean (-not $child.inherited) 'Clean child inherited parent socket'
   Assert-Clean (Can-Bind $root.port) 'Listener did not release while clean child remained alive'
   Assert-Clean ($child.args[4] -ceq 'argument with spaces' -and $child.args[5] -ceq 'quote"and\trailing\') 'Windows argument quoting changed'
   Assert-Clean ($child.environment -ceq 'explicit child environment' -and $child.cwd -eq $scratch) 'Child environment or cwd changed'
   if($mode -eq 'logs'){
    $end=[DateTime]::UtcNow.AddSeconds(5);while(((-not (Test-Path -LiteralPath ($parentFile+'.stdout'))) -or (Get-Item -LiteralPath ($parentFile+'.stdout')).Length -eq 0) -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 25}
    Assert-Clean ((Get-Content -LiteralPath ($parentFile+'.stdout') -Raw).Contains('fixture stdout')) 'Child stdout redirection failed'
    Assert-Clean ((Get-Content -LiteralPath ($parentFile+'.stderr') -Raw).Contains('fixture stderr')) 'Child stderr redirection failed'
   }
  }
 }finally{[IO.File]::WriteAllText($stop,'stop fixture');$parent.Dispose()}
 $end=[DateTime]::UtcNow.AddSeconds(5);while(-not (Can-Bind $root.port) -and [DateTime]::UtcNow -lt $end){Start-Sleep -Milliseconds 25}
 Assert-Clean (Can-Bind $root.port) 'Fixture listener did not release after normal child exit'
}
Write-Output 'PASS: inherited listener reproduced; clean child remains alive without retaining listener; explicit stdio whitelist, environment, cwd and Windows argument quoting passed. Only isolated fixture processes used.'
