param(
    [Parameter(Mandatory=$true)][string]$DataDirectory,
    [Parameter(Mandatory=$true)][string]$BrowserId,
    [Parameter(Mandatory=$true)][int]$Port
)
$ErrorActionPreference='Stop'
$binding=Get-Content -Raw -LiteralPath (Join-Path $DataDirectory 'main-window.json') | ConvertFrom-Json
if($binding.schemaVersion -ne 2 -or $binding.browserId -cne $BrowserId -or
   $binding.executable -notmatch '\\WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\ChatGPT\.exe$'){
    throw 'Current Codex window binding is unavailable.'
}
$listener=@(Get-NetTCPConnection -LocalPort $Port -LocalAddress '127.0.0.1' -State Listen -ErrorAction Stop)
if($listener.Count -ne 1 -or $listener[0].OwningProcess -ne $binding.clientId){
    throw 'Codex listener ownership changed.'
}
Add-Type -Path (Join-Path $PSScriptRoot '../../windows/ClientWindow.cs')
$started=([DateTimeOffset]$binding.startedAt).UtcDateTime.Ticks
[WallpaperClientWindow]::Activate($binding.handle,$binding.clientId,$binding.executable,$started,[long]$binding.cookie)
if(-not [WallpaperClientWindow]::Foreground($binding.handle)){
    $shell=New-Object -ComObject WScript.Shell
    [void]$shell.AppActivate([int]$binding.clientId)
    [WallpaperClientWindow]::Activate($binding.handle,$binding.clientId,$binding.executable,$started,[long]$binding.cookie)
}
