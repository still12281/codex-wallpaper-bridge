$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/UpdateReconnectPolicy.ps1')
function Assert-Update($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
Assert-Update (Test-WallpaperUpdateTaskOwner $identity.User.Value $identity.User.Value) 'Task SID owner rejected'
Assert-Update (Test-WallpaperUpdateTaskOwner $identity.Name $identity.User.Value) 'Task Scheduler account-name normalization rejected'
Assert-Update (-not (Test-WallpaperUpdateTaskOwner $identity.Name 'S-1-5-21-0-0-0-9999')) 'Foreign task owner accepted'
$identity.Dispose()
$selfCim=Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
$exact=Get-WallpaperExactUpdateSnapshot $selfCim;$self=Get-Process -Id $PID
Assert-Update ($exact.ticks -eq $self.StartTime.ToUniversalTime().Ticks) 'Native process identity lost FILETIME precision';$self.Dispose()
$now=[DateTimeOffset]::Parse('2026-10-28T02:00:00Z')
$state=@{armedAt=$now.AddMinutes(-1).ToString('o');baselineRecordId=100;observedVersion='26.1023.6123.0'}
$package='OpenAI.Codex_26.1024.1000.0_x64__2p2nqsd0c76g0'
$event=[pscustomobject]@{id=400;provider='Microsoft-Windows-AppXDeployment-Server';operation='6';userId='S-1-5-21-1';at=$now.AddSeconds(-8);recordId=101;package=$package}
$installed=[pscustomobject]@{PackageFullName=$package}
function Decision {Get-WallpaperUpdateDecision -Event $event -State $state -Installed $installed -UserId 'S-1-5-21-1' -Now $now}
Assert-Update ((Decision).eligible) 'New package event rejected'
$roundtrip=$state|ConvertTo-Json|ConvertFrom-Json -AsHashtable
Assert-Update ((Get-WallpaperUpdateDecision -Event $event -State $roundtrip -Installed $installed -UserId 'S-1-5-21-1' -Now $now).eligible) 'JSON date parsing changed the installation time zone'
$state.observedVersion='26.1024.1000.0';Assert-Update (-not (Decision).eligible) 'Duplicate version would retry';$state.observedVersion='26.1023.6123.0'
$event.recordId=99;Assert-Update (-not (Decision).eligible) 'Historical event would run';$event.recordId=101
$event.at=$now.AddMinutes(-4);Assert-Update (-not (Decision).eligible) 'Delayed event would close a working session';$event.at=$now.AddSeconds(-8)
$event.userId='S-1-5-21-2';Assert-Update (-not (Decision).eligible) 'Other user event was accepted';$event.userId='S-1-5-21-1'
$event.operation='4';Assert-Update (-not (Decision).eligible) 'Staging event was accepted';$event.operation='6'
$installed.PackageFullName='newer-than-event';Assert-Update (-not (Decision).eligible) 'Outdated package event was accepted';$installed.PackageFullName=$package
$path='C:\Program Files\WindowsApps\'+$package+'\app\ChatGPT.exe'
$root=[pscustomobject]@{id=20;path=$path;createdAt=$event.at.AddSeconds(1).ToString('o')}
Assert-Update ((Get-WallpaperUpdateClientDecision -Roots @($root) -Executable $path -EventAt $event.at -Now $now) -eq 'close-once') 'Fresh update root rejected'
Assert-Update ((Get-WallpaperUpdateClientDecision -Roots @() -Executable $path -EventAt $event.at -Now $now) -eq 'no-client-do-not-launch') 'Background update would open Codex'
Assert-Update ((Get-WallpaperUpdateClientDecision -Roots @($root) -Executable $path -EventAt $event.at -Now $now -HealthyCdp $true) -eq 'already-connected') 'Healthy client would close'
$root.createdAt=$now.AddHours(-1).ToString('o');Assert-Update ((Get-WallpaperUpdateClientDecision -Roots @($root) -Executable $path -EventAt $event.at -Now $now) -ne 'close-once') 'Older working session would close'
$script:closed=0;$script:clock=$now
$result=Invoke-WallpaperUpdateCloseOnce -Close {$script:closed++;$true} -Remaining {$false} -NewRoot {$false}
Assert-Update ($result -eq 'ready-to-relaunch' -and $script:closed -eq 1) 'Successful close count incorrect'
$script:closed=0;$result=Invoke-WallpaperUpdateCloseOnce -Close {$script:closed++;$false} -Remaining {throw 'must not wait'} -NewRoot {throw 'must not wait'}
Assert-Update ($result -eq 'close-not-accepted' -and $script:closed -eq 1) 'Failed close retried'
$script:closed=0;$result=Invoke-WallpaperUpdateCloseOnce -Close {$script:closed++;$true} -Remaining {$true} -NewRoot {$false} -Now {$script:clock} -Sleep {$script:clock=$script:clock.AddSeconds(5)}
Assert-Update ($result -eq 'close-timeout-client-preserved' -and $script:closed -eq 1) 'Timeout retried or did not stop'
$script:closed=0;$result=Invoke-WallpaperUpdateCloseOnce -Close {$script:closed++;$true} -Remaining {throw 'new root must be preserved'} -NewRoot {$true}
Assert-Update ($result -eq 'new-client-preserved' -and $script:closed -eq 1) 'New instance would be replaced'
$entry='E:\generated fixture\CodexEntry.exe';[xml]$xml=New-WallpaperUpdateTaskXml -UserId 'S-1-5-21-1' -Entry $entry -Root 'E:\generated fixture'
Assert-Update ($xml.Task.Actions.Exec.Command -eq $entry -and $xml.Task.Actions.Exec.Arguments -ceq '--after-update-event $(UpdateRecordId)') 'Native hidden entry or literal event substitution lost'
Assert-Update (-not $xml.Task.Triggers.EventTrigger.Repetition -and $xml.Task.Settings.AllowHardTerminate -eq 'false' -and $xml.Task.Principals.Principal.LogonType -eq 'InteractiveToken') 'Resident/repeating/forceful task settings introduced'
# Execute the real bootstrap's central close guard without loading its startup code.
$parseErrors=$null;$tokens=$null;$bootstrapPath=Join-Path $PSScriptRoot '../windows/Start-CodexWallpaper.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($bootstrapPath,[ref]$tokens,[ref]$parseErrors);Assert-Update (-not $parseErrors) 'Bootstrap syntax error'
$function=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Close-TaskSnapshot'},$true)
. ([scriptblock]::Create($function.Extent.Text));$AfterUpdate=$true;$blocked=$false;try{Close-TaskSnapshot @()}catch{$blocked=$true};Assert-Update $blocked 'Automatic bootstrap could close another client'
foreach($file in @('AfterUpdateReconnect.ps1','Install-UpdateReconnect.ps1','UpdateReconnectPolicy.ps1')){$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot "../windows/$file"),[ref]$tokens,[ref]$errors);Assert-Update (-not $errors) "Syntax error: $file"}
Write-Output 'PASS: fresh/duplicate/stale/foreign events, background updates, old roots, close-once/timeout/new-instance, task shape, and real bootstrap no-close guard. No real client launched or closed.'
