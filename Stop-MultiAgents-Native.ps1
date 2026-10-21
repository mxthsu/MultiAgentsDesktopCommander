$ErrorActionPreference='Stop'
$pidFile=Join-Path $PSScriptRoot 'runtime\native-http.pid'
if(-not(Test-Path $pidFile)){Write-Output 'MULTIAGENTS_NATIVE_HTTP=NOT_RUNNING';exit 0}
$serverId=[int](Get-Content $pidFile -Raw)
$proc=Get-CimInstance Win32_Process -Filter "ProcessId=$serverId" -ErrorAction SilentlyContinue
if($proc -and $proc.CommandLine -match 'native-http.js'){
  Stop-Process -Id $serverId -Force
  Write-Output ("MULTIAGENTS_NATIVE_HTTP=STOPPED PID="+$serverId)
}else{Write-Output "MULTIAGENTS_NATIVE_HTTP=STALE_PID"}
Remove-Item $pidFile -Force
