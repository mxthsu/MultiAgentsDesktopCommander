$root = $PSScriptRoot
$pidFile = Join-Path $root 'runtime\native-http.pid'
$status = 'STOPPED'
$pidValue = 0
if (Test-Path $pidFile) {
  $pidValue = [int](Get-Content $pidFile -Raw)
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction SilentlyContinue
  if ($p -and $p.CommandLine -match 'native-http.js') { $status='RUNNING' }
}
$ok = $false
try { $ok = [bool]((Invoke-RestMethod -Uri 'http://127.0.0.1:8877/health' -TimeoutSec 3).ok) } catch {}
Write-Output ("MULTIAGENTS_NATIVE_HTTP="+$status+" PID="+$pidValue+" HEALTH="+$ok)
if ($status -ne 'RUNNING' -or -not $ok) { exit 1 }
