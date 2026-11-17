param([Parameter(Mandatory)][string]$RequestFile)
$ErrorActionPreference='Stop'
$request=$null
function Save-UpdateResult([string]$Phase,[string]$Message) {
  $result=@{id=$request.id;phase=$Phase;message=$Message}
  $temporary=$request.statusFile+'.next'
  [IO.File]::WriteAllText($temporary,($result|ConvertTo-Json -Compress))
  Move-Item -LiteralPath $temporary -Destination $request.statusFile -Force -ErrorAction Stop
}
try {
  $request=Get-Content -LiteralPath $RequestFile -Raw -ErrorAction Stop | ConvertFrom-Json
  foreach($value in @($request.installer,$request.dataDirectory,$request.statusFile)) {
    if(-not [IO.Path]::IsPathFullyQualified($value) -or $value -match '["\r\n]'){throw 'Invalid update path.'}
  }
  [IO.File]::WriteAllText((Join-Path (Split-Path -Parent $request.statusFile) 'runner.json'),(@{id=$request.id;pid=$PID}|ConvertTo-Json -Compress))
  if((Get-FileHash -LiteralPath $request.installer -Algorithm SHA256 -ErrorAction Stop).Hash -ine $request.sha256){throw 'Installer checksum mismatch.'}
  $arguments=@('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-','/UPDATE=keep','/LOGIN=keep',('/DATADIR="'+$request.dataDirectory+'"'),('/LOG="'+(Join-Path (Split-Path -Parent $request.statusFile) 'installer.log')+'"'))
  $process=Start-Process -FilePath $request.installer -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru -ErrorAction Stop
  if($process.ExitCode -ne 0){throw ('Installer exited with code '+$process.ExitCode+'.')}
  Save-UpdateResult 'installed' '更新已安装。保存工作并正常退出 Codex，再从壁纸入口打开，新版本即生效。'
} catch {
  if($request.statusFile){Save-UpdateResult 'error' ('更新未完成：'+$_.Exception.Message)}
  exit 1
}
