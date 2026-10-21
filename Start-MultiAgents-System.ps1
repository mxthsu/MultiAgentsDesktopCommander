$ErrorActionPreference = 'Stop'
$backend = Join-Path $HOME 'Documents\MultiAgentsDesktopCommander\Start-All-MultiAgents.ps1'
if (-not (Test-Path $backend)) {throw 'MultiAgents coordination backend not installed'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backend
if ($LASTEXITCODE -ne 0) {throw 'Coordinator backend failed to start'}
& (Join-Path $PSScriptRoot 'Start-MultiAgents-Native.ps1')
if ($LASTEXITCODE -ne 0) {throw 'Native MCP server failed to start'}
Write-Output 'MULTIAGENTS_SYSTEM=STARTED'
