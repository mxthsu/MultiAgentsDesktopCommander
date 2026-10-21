$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$pidFile=Join-Path $root 'runtime\tunnel\tunnel.pid'
if(-not(Test-Path $pidFile)){Write-Output 'MULTIAGENTS_TUNNEL=STOPPED';exit 0}
$id=[int](Get-Content $pidFile -Raw)
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
if($p -and $p.Name -eq 'tunnel-client.exe'){
 Stop-Process -Id $id -Force
 Write-Output ("MULTIAGENTS_TUNNEL=STOPPED PID="+$id)
}
Remove-Item $pidFile -Force
