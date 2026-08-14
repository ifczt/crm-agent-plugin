[CmdletBinding()]
param([switch]$SkipScheduledUpdate)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

npm install --global $repositoryRoot
if ($LASTEXITCODE -ne 0) { throw "Unable to install @ifczt/crm-cli" }

$setupArgs = @("setup", "--format", "json")
if ($SkipScheduledUpdate) { $setupArgs += "--skip-schedule" }
& crm-cli @setupArgs
if ($LASTEXITCODE -ne 0) { throw "Unable to configure the global CRM skill" }

Write-Host "CRM CLI installed. Run 'crm-cli auth login', then restart ChatGPT desktop."
