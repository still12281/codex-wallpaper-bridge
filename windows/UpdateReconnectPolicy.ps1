function Test-WallpaperUpdateTaskOwner([string]$Principal,[string]$UserId) {
  if($Principal -ceq $UserId){return $true}
  try{return ([Security.Principal.NTAccount]::new($Principal).Translate([Security.Principal.SecurityIdentifier])).Value -ceq $UserId}catch{return $false}
}

function Get-WallpaperUpdateEvent {
  param([xml]$Xml)
  $data=@{};foreach($item in $Xml.Event.EventData.Data){$data[[string]$item.Name]=[string]$item.'#text'}
  [pscustomobject]@{id=[int]$Xml.Event.System.EventID;recordId=[long]$Xml.Event.System.EventRecordID;provider=[string]$Xml.Event.System.Provider.Name;userId=[string]$Xml.Event.System.Security.UserID;at=[DateTimeOffset]::Parse([string]$Xml.Event.System.TimeCreated.SystemTime);operation=$data.DeploymentOperation;package=$data.PackageFullName}
}

function Get-WallpaperUpdateDecision {
  param($Event,$State,$Installed,[string]$UserId,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow)
  $reject={param($why)[pscustomobject]@{eligible=$false;reason=$why}}
  if($Event.id -ne 400 -or $Event.provider -cne 'Microsoft-Windows-AppXDeployment-Server' -or $Event.operation -ne '6' -or $Event.userId -cne $UserId){return & $reject 'unrelated-event'}
  $match=[regex]::Match($Event.package,'^OpenAI\.Codex_(\d+\.\d+\.\d+\.\d+)_(x64|arm64)__2p2nqsd0c76g0$')
  if(-not $match.Success){return & $reject 'unrelated-package'}
  if($Event.at -le [DateTimeOffset]$State.armedAt -or $Event.recordId -le [long]$State.baselineRecordId){return & $reject 'before-installation-baseline'}
  $age=($Now-$Event.at).TotalSeconds
  if($age -lt 0 -or $age -gt 120){return & $reject 'stale-event'}
  if($Installed.PackageFullName -cne $Event.package){return & $reject 'package-not-current'}
  if([version]$match.Groups[1].Value -le [version]$State.observedVersion){return & $reject 'version-already-consumed'}
  [pscustomobject]@{eligible=$true;reason='new-current-version';version=$match.Groups[1].Value}
}

function Get-WallpaperUpdateClientDecision {
  param([object[]]$Roots,[string]$Executable,[DateTimeOffset]$EventAt,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow,[bool]$HealthyCdp=$false)
  if($HealthyCdp){return 'already-connected'}
  if($Roots.Count -eq 0){return 'no-client-do-not-launch'}
  if($Roots.Count -ne 1){return 'multiple-clients-preserved'}
  $root=$Roots[0];$created=[DateTimeOffset]::Parse($root.createdAt)
  if($root.path -ine $Executable -or ($created-$EventAt).TotalSeconds -lt -2 -or ($created-$EventAt).TotalSeconds -gt 120 -or ($Now-$created).TotalSeconds -gt 120){return 'client-not-created-by-recent-update'}
  return 'close-once'
}

function Get-WallpaperExactUpdateSnapshot {
  param($Cim)
  $process=Get-Process -Id $Cim.ProcessId -ErrorAction Stop
  try{
    $started=$process.StartTime.ToUniversalTime();$path=$process.MainModule.FileName
    # Win32_Process CreationDate truncates native FILETIME to microseconds.
    if($path -ine $Cim.ExecutablePath -or [math]::Abs($started.Ticks-$Cim.CreationDate.ToUniversalTime().Ticks) -gt 9){throw 'Process identity changed during snapshot'}
    [pscustomobject]@{id=[int]$Cim.ProcessId;path=$path;createdAt=$started.ToString('o');ticks=$started.Ticks}
  }finally{$process.Dispose()}
}

function Invoke-WallpaperUpdateCloseOnce {
  param([scriptblock]$Close,[scriptblock]$Remaining,[scriptblock]$NewRoot,[scriptblock]$Now={ [DateTimeOffset]::UtcNow },[scriptblock]$Sleep={ Start-Sleep -Milliseconds 250 })
  if(-not (& $Close)){return 'close-not-accepted'}
  $deadline=(& $Now).AddSeconds(20)
  do{
    if(& $NewRoot){return 'new-client-preserved'}
    if(-not (& $Remaining)){return 'ready-to-relaunch'}
    & $Sleep
  }while((& $Now) -lt $deadline)
  return 'close-timeout-client-preserved'
}

function Save-WallpaperUpdateState {
  param([string]$Root,$State)
  $next=Join-Path $Root 'update-reconnect.next.json'
  [IO.File]::WriteAllText($next,($State|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
  [IO.File]::Move($next,(Join-Path $Root 'update-reconnect.json'),$true)
}

function New-WallpaperUpdateTaskXml {
  param([string]$UserId,[string]$Entry,[string]$Root)
  $escape={param($s)[Security.SecurityElement]::Escape($s)}
  $query="<QueryList><Query Id='0' Path='Microsoft-Windows-AppXDeploymentServer/Operational'><Select Path='Microsoft-Windows-AppXDeploymentServer/Operational'>*[System[Provider[@Name='Microsoft-Windows-AppXDeployment-Server'] and EventID=400 and Security[@UserID='$UserId']]] and *[EventData[Data[@Name='DeploymentOperation']='6' and (Data[@Name='PackageDisplayName']='ChatGPT' or Data[@Name='PackageDisplayName']='Codex')]]</Select></Query></QueryList>"
  $arguments='--after-update-event $(UpdateRecordId)'
  @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
 <RegistrationInfo><Description>Codex Wallpaper Bridge: one graceful reconnect per new package update; no polling or resident supervisor.</Description></RegistrationInfo>
 <Triggers><EventTrigger><Enabled>true</Enabled><Subscription>$(& $escape $query)</Subscription><Delay>PT8S</Delay><ValueQueries><Value name="UpdateRecordId">Event/System/EventRecordID</Value></ValueQueries></EventTrigger></Triggers>
 <Principals><Principal id="CurrentUser"><UserId>$(& $escape $UserId)</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
 <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>false</AllowHardTerminate><StartWhenAvailable>false</StartWhenAvailable><AllowStartOnDemand>false</AllowStartOnDemand><Enabled>true</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT3M</ExecutionTimeLimit></Settings>
 <Actions Context="CurrentUser"><Exec><Command>$(& $escape $Entry)</Command><Arguments>$(& $escape $arguments)</Arguments><WorkingDirectory>$(& $escape $Root)</WorkingDirectory></Exec></Actions>
</Task>
"@
}
