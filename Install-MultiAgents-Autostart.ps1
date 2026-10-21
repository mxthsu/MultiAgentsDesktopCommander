$ErrorActionPreference='Stop'
$psScript=Join-Path $PSScriptRoot 'Start-MultiAgents-System.ps1'
if(-not (Test-Path $psScript)){throw 'Missing local start script'}
$runKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$name='MultiAgentsDesktopCommander'
$cmd='powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$psScript+'"'
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name $name -PropertyType String -Value $cmd -Force | Out-Null
$reg=(Get-ItemProperty -Path $runKey -Name $name).$name
if($reg -ne $cmd){throw 'Autostart verification failed'}
Write-Output 'MULTIAGENTS_AUTOSTART=ENABLED CURRENT_USER_ONLY'
Write-Output 'ON_LOGIN=Start backend and native loopback MCP'
