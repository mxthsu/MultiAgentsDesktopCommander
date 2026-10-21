$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $root 'runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$pidFile = Join-Path $runtime 'native-http.pid'
if (Test-Path $pidFile) {
  $oldId = [int](Get-Content $pidFile -Raw)
  $old = Get-CimInstance Win32_Process -Filter "ProcessId=$oldId" -ErrorAction SilentlyContinue
  if ($old -and $old.CommandLine -match 'native-http.js') {
    Write-Output ("MULTIAGENTS_NATIVE_HTTP=RUNNING PID="+$oldId)
    exit 0
  }
}
$existing = Get-NetTCPConnection -LocalPort 8877 -State Listen -ErrorAction SilentlyContinue
if ($existing) { throw "Port 8877 already occupied. No change made." }
$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path (Join-Path $root 'dist\native-http.js'))) { throw 'Native HTTP build missing.' }
$log = Join-Path $runtime 'native-http.stdout.log'
$err = Join-Path $runtime 'native-http.stderr.log'
$p = Start-Process -FilePath $node -ArgumentList 'dist/native-http.js' -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err
Set-Content -Path $pidFile -Value $p.Id -Encoding ascii
Start-Sleep -Seconds 3
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8877/health' -TimeoutSec 5
  if (-not $health.ok) { throw 'Server health failed' }
  Write-Output ("MULTIAGENTS_NATIVE_HTTP=RUNNING PID="+$p.Id)
  Write-Output 'URL=http://127.0.0.1:8877/mcp AUTH=BEARER_REQUIRED LOOPBACK_ONLY'
} catch {
  if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  Get-Content $err -Tail 15 -ErrorAction SilentlyContinue
  throw
}
