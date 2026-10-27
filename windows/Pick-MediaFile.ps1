$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = [System.Windows.Forms.OpenFileDialog]::new()
$dialog.Title = '选择本机图片或视频（支持大视频文件）'
$dialog.Filter = '图片和视频|*.mp4;*.webm;*.gif;*.jpg;*.jpeg;*.png;*.webp'
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
try {
 if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { @{file=$dialog.FileName}|ConvertTo-Json -Compress }
 else { @{cancelled=$true}|ConvertTo-Json -Compress }
} finally { $dialog.Dispose() }
