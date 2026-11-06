function Import-WallpaperCleanProcess {
  if(-not ('WallpaperCleanProcess' -as [type])){
    $cached=(Get-Command Import-WallpaperStartupSupport -ErrorAction SilentlyContinue) -and (Import-WallpaperStartupSupport 'WallpaperCleanProcess')
    if(-not $cached){Add-Type -Path (Join-Path $PSScriptRoot 'CleanProcess.cs') -ErrorAction Stop}
  }
}
function Start-WallpaperCleanProcess {
  param([Parameter(Mandatory)][string]$FilePath,[string[]]$ArgumentList=@(),[string]$WorkingDirectory,[switch]$Hidden,[string]$StandardOutput,[string]$StandardError)
  Import-WallpaperCleanProcess
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=[IO.Path]::GetFullPath($FilePath);$info.UseShellExecute=$false;$info.CreateNoWindow=$Hidden.IsPresent
  $info.Arguments=[WallpaperCleanProcess]::Arguments($ArgumentList)
  if($WorkingDirectory){$info.WorkingDirectory=$WorkingDirectory}
  $outFile=if($StandardOutput){$StandardOutput}else{$null}
  $errFile=if($StandardError){$StandardError}else{$null}
  [WallpaperCleanProcess]::Start($info,$outFile,$errFile)
}
function Start-WallpaperCodexDirect {
  param([Parameter(Mandatory)]$Codex,[Parameter(Mandatory)][AllowEmptyCollection()][string[]]$Arguments)
  Assert-DreamSkinCodexDirectLaunchTarget -Codex $Codex
  $child=Start-WallpaperCleanProcess -FilePath "$($Codex.Executable)" -ArgumentList $Arguments
  try{return $child.Id}finally{$child.Dispose()}
}
