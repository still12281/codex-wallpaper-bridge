$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
function Assert-Handoff($Condition,[string]$Message){if(-not $Condition){throw $Message}}
$root=Join-Path ([IO.Path]::GetTempPath()) ('cwb-handoff-'+[guid]::NewGuid());[void][IO.Directory]::CreateDirectory($root)
$code=Join-Path $root 'code';$node='C:\Runtime\node.exe'
$hostProcess=[pscustomobject]@{Name='node.exe';ProcessId=77;ExecutablePath=$node;CommandLine=('node.exe "'+(Join-Path $code 'src/video-cdp-host.mjs')+'" --cdp-port 9335')}
$read={Get-WallpaperHostState -Processes @($hostProcess) -Root $root -CodeRoot $code -Node $node -BrowserId 'new-browser'}
Assert-Handoff ((& $read).mode -eq 'conflict') 'Missing state hid a live host'
[IO.File]::WriteAllText((Join-Path $root 'runtime-status.json'),'corrupt')
Assert-Handoff ((& $read).mode -eq 'conflict') 'Corrupt state hid a live host'
$status=@{pid=77;browserId='old-browser';updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
$status|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'runtime-status.json')
Assert-Handoff ((& $read).mode -eq 'conflict') 'Previous browser host was reused'
$script:reads=0
$state=Wait-WallpaperHostDrain -Pause {} -ReadState {$script:reads++;if($script:reads -eq 1){& $read}else{Get-WallpaperHostState -Processes @() -Root $root -CodeRoot $code -Node $node -BrowserId 'new-browser'}}
Assert-Handoff ($state.mode -eq 'absent' -and $script:reads -eq 2) 'Natural old-host exit did not allow handoff'
$status.browserId='new-browser';$status|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'runtime-status.json')
Assert-Handoff ((& $read).mode -eq 'reuse') 'Matching healthy host was not reused'
Assert-Handoff ((Get-WallpaperHostState -Processes @($hostProcess,$hostProcess) -Root $root -CodeRoot $code -Node $node -BrowserId 'new-browser').mode -eq 'conflict') 'Duplicate host was hidden by a healthy record'
$script:reads=0
$state=Wait-WallpaperHostDrain -Pause {} -ReadState {$script:reads++;if($script:reads -eq 1){[pscustomobject]@{mode='conflict'}}else{& $read}}
Assert-Handoff ($state.mode -eq 'reuse' -and $state.pid -eq 77) 'Host becoming healthy during handoff was duplicated'
$state=Wait-WallpaperHostDrain -TimeoutMilliseconds 0 -Pause {throw 'Timeout did not stop waiting'} -ReadState {[pscustomobject]@{mode='conflict'}}
Assert-Handoff ($state.mode -eq 'conflict') 'Persistent conflict was allowed to start another host'
$main=[pscustomobject]@{targetId='main';url='app://-/index.html';installed=$false;ready=$false;phase='waiting-for-visible-page'}
$detached=[pscustomobject]@{targetId='detached';url='app://-/detached-window.html?initialRoute=x';installed=$true;ready=$true;mode='webwallgl';hidden=$false}
$choice=Select-WallpaperReadyTargets @($main,$detached) 'main'
Assert-Handoff ($choice.mainDeferred -and $choice.targets.Count -eq 1 -and $choice.targets[0].targetId -eq 'detached') 'Visible detached wallpaper was blocked by an intentionally hidden main page'
$detached.hidden=$true
Assert-Handoff (-not (Select-WallpaperReadyTargets @($main,$detached) 'main').targets.Count) 'Hidden auxiliary wallpaper counted as visible recovery'
$detached.hidden=$false;$main.phase='waiting-for-shell'
Assert-Handoff (-not (Select-WallpaperReadyTargets @($main,$detached) 'main').targets.Count) 'A genuinely pending main page was bypassed'
$main.installed=$true;$main.ready=$true
$choice=Select-WallpaperReadyTargets @($main,$detached) 'main'
Assert-Handoff (-not $choice.mainDeferred -and $choice.targets[0].targetId -eq 'main') 'Main-page priority was lost'

# Run the real catch branch in a disposable PowerShell process: even if the
# client exits during the host wait, no close or ordinary reopen may occur.
$errors=$null;$tokens=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../windows/Start-CodexWallpaper.ps1'),[ref]$tokens,[ref]$errors)
Assert-Handoff (-not $errors) 'Bootstrap syntax error'
$mainTry=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst] -and $_.CatchClauses.Count -gt 0}|Select-Object -Last 1
$catchText=$mainTry.CatchClauses[0].Body.Extent.Text
$scriptFile=Join-Path $root 'catch.ps1'
$fixtureText=@'
$ErrorActionPreference='Stop'
$InspectOnly=$false;$AfterUpdate=$false;$taskPreserveVerifiedClient=$true
$taskCreatedVerifiedClient=$true;$taskOwnedRoot=[pscustomobject]@{Id=777}
$taskStatus=[ordered]@{};$script:saves=0
function Close-TaskSnapshot {throw 'Must not close a verified client'}
function Get-TaskSnapshot {throw 'Must not enter ordinary recovery, even with no remaining client'}
function Start-DreamSkinCodex {throw 'Must not reopen an ordinary client'}
function Save-TaskPhase {param($Phase) $script:saves++;if($script:saves -eq 2){if($taskStatus.recovery -ne 'client-preserved-after-cdp'){throw 'Wrong preservation outcome'};[IO.File]::WriteAllText($env:CWB_CATCH_MARKER,'preserved') }}
try{throw 'Generated host setup failure'}catch
'@
[IO.File]::WriteAllText($scriptFile,($fixtureText+$catchText),[Text.UTF8Encoding]::new($false))
$info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Get-Process -Id $PID).Path;$info.Arguments='-NoProfile -File "'+$scriptFile+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
$marker=Join-Path $root 'catch-preserved';$info.Environment['CWB_CATCH_MARKER']=$marker
$child=[Diagnostics.Process]::Start($info)
try{if(-not $child.WaitForExit(10000)){throw 'Catch fixture timed out'};Assert-Handoff ($child.ExitCode -eq 1 -and (Test-Path -LiteralPath $marker)) 'Verified-client failure entered destructive/ordinary fallback'}finally{$child.Dispose()}
Write-Output 'PASS: missing/corrupt/old host protection, natural exit handoff, healthy reuse, multiple-host refusal, bounded conflict, real catch preserves verified client without close/reopen.'
