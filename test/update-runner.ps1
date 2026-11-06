param([string[]]$Cases=@('exit-race','unreadable-live','reattach','healthy','no-client','new-client'))
$ErrorActionPreference='Stop'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('cwb-update-runner-'+[guid]::NewGuid())
$code=Join-Path $fixture 'code';$windows=Join-Path $code 'windows';$vendor=Join-Path $code 'vendor/codex-dynamic-skin/scripts'
foreach($directory in @($windows,$vendor)){[void][IO.Directory]::CreateDirectory($directory)}
foreach($file in @('AfterUpdateReconnect.ps1','UpdateReconnectPolicy.ps1','LaunchPolicy.ps1','CleanProcess.ps1','CleanProcess.cs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot "../windows/$file") -Destination (Join-Path $windows $file) -ErrorAction Stop}
$common=@'
$script:fixtureClosed=$false
$script:fixtureCreated=[datetime]::Parse($env:CWB_UPDATE_CREATED).ToUniversalTime()
$script:fixturePath='C:\Program Files\WindowsApps\OpenAI.Codex_26.2.2.2_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
function Get-WinEvent {
  $record=[pscustomobject]@{}
  $record|Add-Member -MemberType ScriptMethod -Name ToXml -Value {return $env:CWB_UPDATE_XML}
  return $record
}
function Get-DreamSkinRegisteredCodexInstalls {
  [pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';SignatureKind='Store';Version='26.2.2.2';PackageFullName='OpenAI.Codex_26.2.2.2_x64__2p2nqsd0c76g0';PackageRoot=(Split-Path -Parent (Split-Path -Parent $script:fixturePath));Executable=$script:fixturePath}
}
function Get-WallpaperVerifiedEndpointForAnyRegistered {
  if($env:CWB_UPDATE_CASE -in @('reattach','healthy')){[pscustomobject]@{Port=9335;Identity=[pscustomobject]@{BrowserId='generated-browser'};Codex=(Get-WallpaperRegisteredCodex)}}
}
function New-FixtureCim([int]$Id,[bool]$Missing=$false){
  [pscustomobject]@{Name='ChatGPT.exe';ProcessId=$Id;ParentProcessId=1;SessionId=1;ExecutablePath=$(if(-not $Missing){$script:fixturePath});CreationDate=$script:fixtureCreated;CommandLine=$(if($Missing){'--type=renderer'}else{'fixture-main'})}
}
function Get-CimInstance {
  [CmdletBinding()]param([Parameter(Position=0)][string]$ClassName,[string]$Filter)
  if($Filter -eq 'ProcessId = 424243'){if($env:CWB_UPDATE_CASE -eq 'unreadable-live'){New-FixtureCim 424243 $true};return}
  if($Filter -like 'ProcessId = *'){New-FixtureCim ([int]($Filter -replace '\D',''));return}
  if($env:CWB_UPDATE_CASE -eq 'no-client'){return}
  if($script:fixtureClosed){if($env:CWB_UPDATE_CASE -eq 'new-client'){New-FixtureCim 424244}else{New-FixtureCim 424243 $true};return}
  New-FixtureCim 424242
}
function Get-Process {
  [CmdletBinding()]param([int]$Id)
  if($Id -eq $PID){return [pscustomobject]@{SessionId=1}}
  if($Id -eq 424243){throw 'Generated exiting/unreadable helper'}
  if($Id -notin @(424242,424244)){throw 'Unexpected fixture PID'}
  $process=[pscustomobject]@{Id=$Id;HasExited=$false;SessionId=1;StartTime=$script:fixtureCreated;MainModule=[pscustomobject]@{FileName=$script:fixturePath}}
  $process|Add-Member -MemberType ScriptMethod -Name Refresh -Value {}
  $process|Add-Member -MemberType ScriptMethod -Name Dispose -Value {}
  $process|Add-Member -MemberType ScriptMethod -Name CloseMainWindow -Value {$script:fixtureClosed=$true;[IO.File]::AppendAllText(($env:CWB_UPDATE_MARKER+'.close'),'close'+[char]10);return $true}
  return $process
}
'@
$commonPath=Join-Path $vendor 'common-windows.ps1';[IO.File]::WriteAllText($commonPath,$common)
$bootstrap=@'
param([switch]$AfterUpdate)
if(-not $AfterUpdate){throw 'Missing safe automatic-update mode'}
[IO.File]::AppendAllText(($env:CWB_UPDATE_MARKER+'.launch'),'launch'+[char]10)
[IO.File]::WriteAllText((Join-Path $env:CODEX_WALLPAPER_DATA_DIR 'launch-status.json'),(@{phase='background-rendered';updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}|ConvertTo-Json))
'@
$bootstrapPath=Join-Path $windows 'Start-CodexWallpaper.ps1';[IO.File]::WriteAllText($bootstrapPath,$bootstrap)
$wrapper=Join-Path $fixture 'run.ps1'
[IO.File]::WriteAllText($wrapper,('param($Common,$Runner,$Root)'+[char]10+'. $Common'+[char]10+'& $Runner -Root $Root -EventRecordId 200'+[char]10+'exit $LASTEXITCODE'))
$pwsh=(Get-Process -Id $PID).Path;$node=(Get-Command node.exe -ErrorAction Stop).Source
$user=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach($case in $Cases){
  $data=Join-Path $fixture $case;[void][IO.Directory]::CreateDirectory($data);$marker=Join-Path $data 'actions'
  $eventAt=[DateTimeOffset]::UtcNow.AddSeconds(-8);$created=$eventAt.AddSeconds(1).UtcDateTime.ToString('o')
  $xml="<Event><System><EventID>400</EventID><EventRecordID>200</EventRecordID><Provider Name='Microsoft-Windows-AppXDeployment-Server'/><Security UserID='$user'/><TimeCreated SystemTime='$($eventAt.ToString('o'))'/></System><EventData><Data Name='DeploymentOperation'>6</Data><Data Name='PackageFullName'>OpenAI.Codex_26.2.2.2_x64__2p2nqsd0c76g0</Data></EventData></Event>"
  [IO.File]::WriteAllText((Join-Path $data 'update-reconnect.json'),(@{userId=$user;armedAt=$eventAt.AddMinutes(-1).ToString('o');baselineRecordId=100;observedVersion='26.1.1.1'}|ConvertTo-Json))
  [IO.File]::WriteAllText((Join-Path $data 'launcher-runtime.json'),(@{powerShell=$pwsh;node=$node}|ConvertTo-Json))
  [IO.File]::WriteAllText((Join-Path $data 'launch-script.txt'),$bootstrapPath)
  [IO.File]::WriteAllText((Join-Path $data 'settings.json'),'{"selected":"generated-wallpaper"}')
  $settings=(Get-FileHash -LiteralPath (Join-Path $data 'settings.json')).Hash
  if($case -eq 'healthy'){[IO.File]::WriteAllText((Join-Path $data 'runtime-status.json'),(@{updatedAt=[DateTimeOffset]::UtcNow.ToString('o');phase='background-rendered';cdpPort=9335;browserId='generated-browser'}|ConvertTo-Json))}
  foreach($run in @(1,2)){
    $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$pwsh;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    foreach($argument in @('-NoProfile','-File',$wrapper,'-Common',$commonPath,'-Runner',(Join-Path $windows 'AfterUpdateReconnect.ps1'),'-Root',$data)){$info.ArgumentList.Add($argument)}
    $info.Environment['CWB_UPDATE_CASE']=$case;$info.Environment['CWB_UPDATE_CREATED']=$created;$info.Environment['CWB_UPDATE_XML']=$xml;$info.Environment['CWB_UPDATE_MARKER']=$marker
    $child=[Diagnostics.Process]::Start($info)
    try{
      $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
      if(-not $child.WaitForExit(30000)){throw 'Generated update runner timed out'}
      $expectedExit=0
      if($child.ExitCode -ne $expectedExit){throw "Runner $case/$run exit=$($child.ExitCode): $($stdout.Result) $($stderr.Result)"}
    }finally{$child.Dispose()}
  }
  $state=Get-Content -LiteralPath (Join-Path $data 'update-reconnect.json') -Raw|ConvertFrom-Json
  $closed=if(Test-Path -LiteralPath ($marker+'.close')){@(Get-Content -LiteralPath ($marker+'.close')).Count}else{0}
  $launched=if(Test-Path -LiteralPath ($marker+'.launch')){@(Get-Content -LiteralPath ($marker+'.launch')).Count}else{0}
  $expectedPhase=switch($case){'exit-race'{'reconnect-finished'};'reattach'{'reconnect-finished'};'healthy'{'already-connected'};'no-client'{'no-client-do-not-launch'};'new-client'{'new-client-preserved'};default{'close-timeout-client-preserved'}}
  $expectedCloses=if($case -in @('exit-race','unreadable-live','new-client')){1}else{0}
  $expectedLaunches=if($case -in @('exit-race','reattach')){1}else{0}
  if($state.phase -ne $expectedPhase -or $closed -ne $expectedCloses -or $launched -ne $expectedLaunches -or $state.observedVersion -ne '26.2.2.2'){throw "Wrong update outcome $case`: phase=$($state.phase), closes=$closed, launches=$launched"}
  if((Get-FileHash -LiteralPath (Join-Path $data 'settings.json')).Hash -cne $settings){throw 'Update runner changed settings'}
  Write-Output "PASS: real update runner $case; duplicate consumed event made no extra close/launch; settings preserved. Generated processes only."
}
