$root=$PSScriptRoot
$pidFile=Join-Path $root 'runtime\tunnel\tunnel.pid'
$id=0
$running=$false
if(Test-Path $pidFile){
 $id=[int](Get-Content $pidFile -Raw)
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
 $running=[bool]($proc -and $proc.Name -eq 'tunnel-client.exe')
}
$ready=$false
if($running){ try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8878/readyz' -TimeoutSec 3;$ready=$r.StatusCode -eq 200}catch{}}
Write-Output ("MULTIAGENTS_TUNNEL_RUNNING="+$running+" PID="+$id)
Write-Output ("MULTIAGENTS_TUNNEL_READY="+$ready)
Write-Output ("TUNNEL_CONFIGURED="+[bool](Test-Path (Join-Path $root 'runtime\tunnel\platform-key.dpapi')))
