function Update-WallpaperPinnedIcons {
  param([Parameter(Mandatory=$true)][string]$Entry,[Parameter(Mandatory=$true)][string]$Icon,[string]$PinnedRoot=(Join-Path $env:APPDATA 'Microsoft/Internet Explorer/Quick Launch/User Pinned'))
  if(-not (Test-Path -LiteralPath $Icon -PathType Leaf)){throw 'Native icon unavailable; pinned entries preserved.'}
  if(-not (Test-Path -LiteralPath $PinnedRoot -PathType Container)){return}
  if(-not ('WallpaperNativeIconNotify' -as [type])){
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class WallpaperNativeIconNotify{[DllImport("shell32.dll",CharSet=CharSet.Unicode)]public static extern void SHChangeNotify(uint e,uint flags,string path,IntPtr unused);}'
  }
  $entryPath=[IO.Path]::GetFullPath($Entry)
  $nativeLocation=[IO.Path]::GetFullPath($Icon)+',0'
  $shell=New-Object -ComObject WScript.Shell
  # Windows can store an actual fixed entry under ImplicitAppShortcuts, not TaskBar.
  foreach($file in Get-ChildItem -LiteralPath $PinnedRoot -Filter '*.lnk' -Recurse -Force -File -ErrorAction Stop){
    $link=$shell.CreateShortcut($file.FullName)
    if(-not [string]::Equals($link.TargetPath,$entryPath,[StringComparison]::OrdinalIgnoreCase)){continue}
    $previous=@($link.TargetPath,$link.Arguments,$link.WorkingDirectory,$link.Description)
    $changed=$link.IconLocation -cne $nativeLocation
    if($changed){$link.IconLocation=$nativeLocation;$link.Save()}
    $actual=$shell.CreateShortcut($file.FullName)
    $identity=@($actual.TargetPath,$actual.Arguments,$actual.WorkingDirectory,$actual.Description)
    for($index=0;$index -lt $previous.Count;$index++){if($previous[$index] -cne $identity[$index]){throw 'Pinned shortcut identity changed during icon refresh'}}
    if($actual.IconLocation -cne $nativeLocation){throw 'Pinned native icon readback failed'}
    [WallpaperNativeIconNotify]::SHChangeNotify(0x2000,0x1005,$file.FullName,[IntPtr]::Zero)
    [pscustomobject]@{path=$file.FullName;icon=$actual.IconLocation;changed=$changed}
  }
}
