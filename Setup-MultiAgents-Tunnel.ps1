param(
  [Parameter(Mandatory=$false)][string]$TunnelId
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $root 'runtime\tunnel'
$exe = Join-Path $runtime 'bin\tunnel-client.exe'
$node = (Get-Command node -ErrorAction Stop).Source
$entry = Join-Path $root 'dist\private-stdio.js'
if(-not(Test-Path $exe)){throw 'Official tunnel-client not installed'}
if(-not(Test-Path $entry)){throw 'Compile the fork before configuring a tunnel'}
if(-not $TunnelId){
  $savedId=Join-Path $runtime 'tunnel-id.txt'
  if(Test-Path $savedId){$TunnelId=(Get-Content -Path $savedId -Raw).Trim()}
  else{$TunnelId=Read-Host 'Tunnel ID obtained from OpenAI Platform'}
}
if($TunnelId -notmatch '^tunnel_[a-zA-Z0-9_-]{16,100}$'){throw 'Invalid tunnel ID format'}
$profileDir=Join-Path $runtime 'profiles'
$profile='multiagents-readonly'
$secretFile=Join-Path $runtime 'platform-key.dpapi'
if(Test-Path $secretFile){
  Write-Output 'Existing encrypted key found; keeping it'
}else{
  $secret=Read-Host 'OpenAI Platform tunnel runtime API key (will not display)' -AsSecureString
  if(-not $secret -or $secret.Length -lt 20){throw 'Key too short'}
  $secret|ConvertFrom-SecureString|Set-Content -Path $secretFile -Encoding ascii
  # This blob is DPAPI encrypted and bound to this Windows account.
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $secretFile /inheritance:r "/grant:r" ("${identity}:R") | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Unable to restrict access to the encrypted credential file'}
  Write-Output 'Platform runtime key saved encrypted for current Windows user'
}
New-Item -Path $profileDir -ItemType Directory -Force |Out-Null
$nodeArg=$node.Replace('\','/')
$entryArg=$entry.Replace('\','/')
$command='"'+$nodeArg+'" "'+$entryArg+'"'
& $exe init --sample sample_mcp_stdio_local --profile $profile --profile-dir $profileDir --tunnel-id $TunnelId --mcp-command $command --health-listen-addr '127.0.0.1:8878' --force
if($LASTEXITCODE -ne 0){throw 'Tunnel profile initialization failed'}
Write-Output 'TUNNEL_PROFILE_CONFIGURED=YES'
Write-Output 'NEXT=Run Start-MultiAgents-Tunnel.ps1, then add custom MCP with Tunnel connection in ChatGPT Plugins'
