function Copy-WallpaperOfficialIcon([object]$Codex,[string]$Destination) {
  # Windows uses the manifest's unplated assets. The Electron resource ICO is
  # a different, glossy design and must never overwrite the native icon again.
  $packageRoot=Split-Path -Parent (Split-Path -Parent $Codex.Executable)
  $manifestPath=Join-Path $packageRoot 'AppxManifest.xml'
  [xml]$manifest=Get-Content -LiteralPath $manifestPath -Raw -ErrorAction Stop
  $visual=$manifest.SelectSingleNode("//*[local-name()='VisualElements']")
  if($null -eq $visual){throw 'Official Windows visual identity unavailable; existing icons preserved.'}
  $logoPath=Join-Path $packageRoot $visual.GetAttribute('Square44x44Logo')
  $assetRoot=Split-Path -Parent $logoPath
  $stem=[IO.Path]::GetFileNameWithoutExtension($logoPath)
  $frames=@(foreach($size in @(16,20,24,32,40,48,64,256)){
    $source=Join-Path $assetRoot ($stem+'.targetsize-'+$size+'_altform-unplated.png')
    $bytes=[IO.File]::ReadAllBytes($source)
    if($bytes.Length -lt 24 -or [BitConverter]::ToString($bytes,0,8) -ne '89-50-4E-47-0D-0A-1A-0A'){throw 'Invalid official Windows icon frame'}
    [pscustomobject]@{size=$size;source=$source;bytes=$bytes;sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256 -ErrorAction Stop).Hash}
  })
  # ICO directory only: every PNG payload remains byte-for-byte official.
  $stream=[IO.MemoryStream]::new();$writer=[IO.BinaryWriter]::new($stream)
  try{
    $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
    $offset=6+16*$frames.Count
    foreach($frame in $frames){$dimension=if($frame.size -eq 256){0}else{$frame.size};$writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.bytes.Length);$writer.Write([uint32]$offset);$offset+=$frame.bytes.Length}
    foreach($frame in $frames){$writer.Write([byte[]]$frame.bytes)}
    $writer.Flush();$iconBytes=$stream.ToArray()
  }finally{$writer.Dispose();$stream.Dispose()}
  $dataRoot=Split-Path -Parent $Destination
  $nativeRoot=Join-Path $dataRoot 'icons'
  [IO.Directory]::CreateDirectory($nativeRoot) | Out-Null
  $canonical=Join-Path $nativeRoot 'Codex-Native.ico'
  foreach($output in @($Destination,$canonical)){
    [IO.File]::WriteAllBytes($output+'.next',$iconBytes);[IO.File]::Move($output+'.next',$output,$true)
  }
  [ordered]@{policy='windows-manifest-unplated';packageRoot=$packageRoot;icon=$canonical;frames=@($frames | Select-Object size,source,sha256)} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $dataRoot 'native-icon-source.json') -Encoding utf8 -ErrorAction Stop
  return $logoPath
}
