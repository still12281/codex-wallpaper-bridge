$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
function Assert-Policy($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Client($Version,$Id,$Session=1,$Command=''){
  [pscustomobject]@{Name='ChatGPT.exe';ExecutablePath="C:\Program Files\WindowsApps\OpenAI.Codex_${Version}_x64__2p2nqsd0c76g0\app\ChatGPT.exe";ProcessId=$Id;SessionId=$Session;CommandLine=$Command}
}
$old=Client '26.1016.8622.0' 101
$new=Client '26.1021.3705.0' 102
$child=Client '26.1021.3705.0' 103 1 '--type=renderer'
$foreign=Client '26.1021.3705.0' 104 2
$untrusted=[pscustomobject]@{Name='ChatGPT.exe';ExecutablePath='C:\Downloads\ChatGPT.exe';ProcessId=105;SessionId=1;CommandLine=''}
$selected=@(Select-WallpaperCodexProcesses @($old,$new,$child,$foreign,$untrusted) 1)
Assert-Policy ($selected.Count -eq 3) 'Cross-version/session/path selection failed'
Assert-Policy ($selected.ProcessId -contains 101 -and $selected.ProcessId -contains 102) 'Old/new root omitted'
foreach($client in @($old,$new)){
  $blocked=$false;try{Assert-WallpaperClientAbsent @($client)}catch{$blocked=$true}
  Assert-Policy $blocked 'Existing main process was not blocked'
}
Assert-WallpaperClientAbsent @($child)
Assert-WallpaperClientAbsent @()
Assert-WallpaperClientAbsent @($old,$child) 101
$blocked=$false;try{Assert-WallpaperClientAbsent @($old,$new,$child) 101}catch{$blocked=$true}
Assert-Policy $blocked 'CDP owner reuse hid a second root'
$unknown=Client '26.1021.3705.0' 106
$unknown.ExecutablePath=$null
$blocked=$false;try{Select-WallpaperCodexProcesses @($unknown) 1}catch{$blocked=$true}
Assert-Policy $blocked 'Unreadable identity was ignored'
$arguments=@(Get-WallpaperDebugArguments 9335)
Assert-Policy ($arguments.Count -eq 2 -and -not ($arguments -match '--user-data-dir')) 'Independent profile reintroduced'
Write-Output 'PASS: old/new roots blocked; renderer allowed; foreign session/path excluded; official default profile retained.'
