$ErrorActionPreference = 'Stop'
$root=$PSScriptRoot
$runtime=Join-Path $root 'runtime\tunnel'
$exe=Join-Path $runtime 'bin\tunnel-client.exe'
$keyFile=Join-Path $runtime 'platform-key.dpapi'
$profileDir=Join-Path $runtime 'profiles'
$pidFile=Join-Path $runtime 'tunnel.pid'
$log=Join-Path $runtime 'tunnel.stdout.log'
$err=Join-Path $runtime 'tunnel.stderr.log'
if(-not(Test-Path $exe)){throw 'tunnel-client missing'}
if(-not(Test-Path $keyFile)){throw 'Tunnel not configured. Use Setup-MultiAgents-Tunnel.ps1 locally'}
if(-not(Test-Path $profileDir)){throw 'Tunnel profile missing'}
if(Test-Path $pidFile){
  $oldId=[int](Get-Content $pidFile -Raw)
  $old=Get-CimInstance Win32_Process -Filter "ProcessId=$oldId" -ErrorAction SilentlyContinue
  if($old -and $old.Name -eq 'tunnel-client.exe'){
    Write-Output ("MULTIAGENTS_TUNNEL=RUNNING PID="+$oldId)
    exit 0
  }
}
if(Get-NetTCPConnection -State Listen -LocalPort 8878 -ErrorAction SilentlyContinue){throw 'Health port 8878 in use'}
# DPAPI decryption only succeeds as the same Windows user who stored the key.
$encrypted=(Get-Content -Path $keyFile -Raw -ErrorAction Stop).Trim()
$secure=ConvertTo-SecureString -String $encrypted -ErrorAction Stop
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:CONTROL_PLANE_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
try {
  $params=@('run','--profile','multiagents-readonly','--profile-dir',$profileDir)
  $proc=Start-Process -FilePath $exe -ArgumentList $params -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err
} finally {
  Remove-Item Env:\CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
}
$proc.Id | Set-Content $pidFile -Encoding ascii
Start-Sleep -Seconds 3
$proc.Refresh()
if($proc.HasExited){
  Write-Output 'MULTIAGENTS_TUNNEL=FAILED (check local log file)'
  throw ('Tunnel client stopped (exit '+$proc.ExitCode+')')
}
$health=$null
try{$health=Invoke-WebRequest -Uri 'http://127.0.0.1:8878/healthz' -TimeoutSec 3 -UseBasicParsing}catch{}
Write-Output ("MULTIAGENTS_TUNNEL=STARTED PID="+$proc.Id)
Write-Output ("LOCAL_HEALTH="+[bool]($health -and $health.StatusCode -eq 200))
Write-Output 'CREDENTIALS=DPAPI PROTECTED; TRANSPORT=OUTBOUND ONLY'
Write-Output 'READINESS=Must verify tunnel-client doctor /readyz and ChatGPT tool call'
