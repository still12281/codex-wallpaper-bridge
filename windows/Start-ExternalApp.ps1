[CmdletBinding()]
param([Parameter(Mandatory)][string]$FilePath,[string[]]$ArgumentList=@(),[string]$WorkingDirectory)
$ErrorActionPreference='Stop'
if(-not [IO.Path]::IsPathFullyQualified($FilePath)){throw 'Provide the absolute executable path.'}
. (Join-Path $PSScriptRoot 'CleanProcess.ps1')
$child=Start-WallpaperCleanProcess -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory
try{[pscustomobject]@{processId=$child.Id;socketInheritance=$false}}finally{$child.Dispose()}
