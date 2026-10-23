param([string]$InitialPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
$dialog.Description = '选择 Wallpaper Engine 壁纸或壁纸库文件夹'
$dialog.UseDescriptionForTitle = $true
$dialog.ShowNewFolderButton = $false
if ($InitialPath -and (Test-Path -LiteralPath $InitialPath -PathType Container)) { $dialog.SelectedPath = $InitialPath }
try { if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { @{folder=$dialog.SelectedPath}|ConvertTo-Json -Compress } else { @{cancelled=$true}|ConvertTo-Json -Compress } } finally { $dialog.Dispose() }
