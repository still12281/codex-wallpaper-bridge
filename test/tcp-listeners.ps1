$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../windows/LaunchPolicy.ps1')
$sockets=@()
try{
  foreach($address in @([Net.IPAddress]::Loopback,[Net.IPAddress]::IPv6Loopback,[Net.IPAddress]::Any,[Net.IPAddress]::IPv6Any)){
    $listener=[Net.Sockets.TcpListener]::new($address,0)
    if($address.AddressFamily -eq 'InterNetworkV6'){$listener.Server.DualMode=$false}
    $listener.Start();$sockets+=@($listener);$port=$listener.LocalEndpoint.Port
    $rows=@(Get-WallpaperTcpListeners $port)
    if(-not @($rows|Where-Object {$_.OwningProcess -eq $PID -and $_.LocalAddress -ceq $address.ToString() -and $_.LocalPort -eq $port}).Count){throw ('Native listener identity mismatch: '+$address)}
    $listener.Stop()
    if(@(Get-WallpaperTcpListeners $port|Where-Object OwningProcess -eq $PID).Count){throw 'Closed fixture listener remained cached'}
  }
  $failed=$false;try{Get-WallpaperTcpListeners 0}catch{$failed=$true};if(-not $failed){throw 'Invalid port accepted'}
  Write-Output 'PASS: real IPv4/IPv6 loopback and wildcard PID/address/port; closed listeners are not cached; invalid port rejected.'
}finally{foreach($listener in $sockets){$listener.Stop()}}
