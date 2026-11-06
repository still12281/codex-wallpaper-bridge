# Optional local compilation cache. Hashes bind cache consistency, not trust.
function Import-WallpaperStartupSupport([string]$TypeName) {
  if($TypeName -as [type]){return $true}
  # Do not mix a combined assembly with one helper already compiled separately.
  if(('WallpaperCleanProcess' -as [type]) -or ('CodexWallpaperBridge.TcpListeners' -as [type])){return $false}
  try{
    $root=if($env:CODEX_WALLPAPER_DATA_DIR){$env:CODEX_WALLPAPER_DATA_DIR}else{Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodexWallpaperBridge'}
    if(-not [IO.Path]::IsPathFullyQualified($root)){return $false}
    $folder=Join-Path $root 'startup-support';$record=Get-Content -LiteralPath (Join-Path $folder 'cache.json') -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop
    if($record.schemaVersion -ne 1){return $false}
    foreach($file in @('CleanProcess.cs','TcpListeners.cs')){
      if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $file) -Algorithm SHA256 -ErrorAction Stop).Hash -cne $record.sources.$file){return $false}
    }
    $dll=Join-Path $folder 'StartupSupport.dll'
    if((Get-FileHash -LiteralPath $dll -Algorithm SHA256 -ErrorAction Stop).Hash -cne $record.dllSha256){return $false}
    Add-Type -LiteralPath $dll -ErrorAction Stop
    return $null -ne ($TypeName -as [type])
  }catch{return $false}
}

function Build-WallpaperStartupSupport([string]$Root) {
  $folder=Join-Path $Root 'startup-support';[void][IO.Directory]::CreateDirectory($folder)
  $compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
  $sources=[ordered]@{};foreach($file in @('CleanProcess.cs','TcpListeners.cs')){$sources[$file]=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $file) -Algorithm SHA256 -ErrorAction Stop).Hash}
  $temporary=Join-Path $folder ('StartupSupport-'+[guid]::NewGuid().ToString('N')+'.dll')
  & $compiler /nologo /target:library /platform:x64 ('/out:'+$temporary) (Join-Path $PSScriptRoot 'CleanProcess.cs') (Join-Path $PSScriptRoot 'TcpListeners.cs')
  if($LASTEXITCODE -ne 0){throw 'Startup support compilation failed; existing cache was preserved'}
  foreach($file in $sources.Keys){if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $file) -Algorithm SHA256 -ErrorAction Stop).Hash -cne $sources[$file]){throw 'Startup helper source changed during compilation'}}
  $record=[ordered]@{schemaVersion=1;sources=$sources;dllSha256=(Get-FileHash -LiteralPath $temporary -Algorithm SHA256 -ErrorAction Stop).Hash}
  $next=Join-Path $folder 'cache.next.json';[IO.File]::WriteAllText($next,($record|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
  # A locked destination leaves the existing DLL/record intact. If publication
  # stops between these moves, runtime hash mismatch safely falls back to source.
  [IO.File]::Move($temporary,(Join-Path $folder 'StartupSupport.dll'),$true)
  [IO.File]::Move($next,(Join-Path $folder 'cache.json'),$true)
}
