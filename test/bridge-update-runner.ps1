$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-update-runner-'+[guid]::NewGuid().ToString('N')+" O'Brien 数据")
[void][IO.Directory]::CreateDirectory($root)
$installer=Join-Path $root 'fixture.exe';[IO.File]::WriteAllText($installer,'Not an executable. Start-Process is mocked.')
$global:CwbRunnerFixture=@{argumentsSeen=$null;exitCode=0;starts=0}
function Start-Process {
  param($FilePath,$ArgumentList,$WindowStyle,[switch]$Wait,[switch]$PassThru,$ErrorAction)
  if($global:CwbRunnerFixture.native){return Microsoft.PowerShell.Management\Start-Process @PSBoundParameters}
  if($FilePath -cne $installer -or $WindowStyle -ne 'Hidden' -or -not $Wait -or -not $PassThru){throw 'Unsafe installer invocation'}
  $global:CwbRunnerFixture.argumentsSeen=$ArgumentList;$global:CwbRunnerFixture.starts++
  [pscustomobject]@{ExitCode=$global:CwbRunnerFixture.exitCode}
}
$request=@{id=[guid]::NewGuid().ToString();installer=$installer;sha256=(Get-FileHash -LiteralPath $installer).Hash;dataDirectory=$root;statusFile=(Join-Path $root 'status.json')}
$requestFile=Join-Path $root 'request.json';$runner=Join-Path $PSScriptRoot '../windows/Install-BridgeUpdate.ps1'
foreach($case in @('success','installer-failure','checksum-failure')) {
  $global:CwbRunnerFixture.exitCode=if($case -eq 'installer-failure'){7}else{0}
  $request.sha256=if($case -eq 'checksum-failure'){'0'*64}else{(Get-FileHash -LiteralPath $installer).Hash}
  [IO.File]::WriteAllText($requestFile,($request|ConvertTo-Json))
  & $runner -RequestFile $requestFile
  $status=Get-Content -LiteralPath $request.statusFile -Raw -ErrorAction Stop|ConvertFrom-Json
  if($status.id -ne $request.id -or $status.phase -ne $(if($case -eq 'success'){'installed'}else{'error'})){throw ('Wrong status for '+$case)}
}
if($global:CwbRunnerFixture.starts -ne 2){throw 'A checksum failure reached installer execution'}
foreach($argument in @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/UPDATE=keep','/LOGIN=keep',('/DATADIR="'+$root+'"'))) {
  if($global:CwbRunnerFixture.argumentsSeen -cnotcontains $argument){throw ('Missing or incorrectly quoted argument: '+$argument)}
}
$source=Join-Path $root 'fake-installer.cs';$installer=Join-Path $root 'real-process.exe'
[IO.File]::WriteAllText($source,'class Fixture { static int Main(string[] args) { System.IO.File.WriteAllLines(System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory,"args.txt"),args); return 0; } }')
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe ('/out:'+$installer) $source
if($LASTEXITCODE -ne 0){throw 'Fixture compiler failed'}
$request.installer=$installer;$request.sha256=(Get-FileHash -LiteralPath $installer).Hash
[IO.File]::WriteAllText($requestFile,($request|ConvertTo-Json));$global:CwbRunnerFixture.native=$true
& $runner -RequestFile $requestFile
if((Get-Content -LiteralPath $request.statusFile -Raw|ConvertFrom-Json).phase -ne 'installed'){throw 'Real process result was not recorded'}
if((Get-Content -LiteralPath (Join-Path $root 'args.txt')) -cnotcontains ('/DATADIR='+$root)){throw 'Real Windows argument quoting lost the data path'}
Write-Output 'PASS: runner success, failures, checksum refusal and retained options; real synthetic EXE verifies process exit and quoted Unicode paths. No product installer executed.'
