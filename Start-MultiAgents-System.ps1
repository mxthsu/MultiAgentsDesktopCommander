$ErrorActionPreference = 'Stop'
$backend = Join-Path $HOME 'Documents\MultiAgentsDesktopCommander\Start-All-MultiAgents.ps1'
if (-not (Test-Path $backend)) {throw 'MultiAgents coordination backend not installed'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backend
if ($LASTEXITCODE -ne 0) {throw 'Coordinator backend failed to start'}
& (Join-Path $PSScriptRoot 'Start-MultiAgents-Native.ps1')
if ($LASTEXITCODE -ne 0) {throw 'Native MCP server failed to start'}
Write-Output 'MULTIAGENTS_SYSTEM=STARTED'

# Enable private tunnel after the owner has supplied and encrypted credentials.
# Without authorization the existing local services continue normally.
$tunnelSecret = Join-Path $PSScriptRoot 'runtime\tunnel\platform-key.dpapi'
if(Test-Path $tunnelSecret){
  & (Join-Path $PSScriptRoot 'Start-MultiAgents-Tunnel.ps1')
}
