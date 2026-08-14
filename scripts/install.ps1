[CmdletBinding()]
param([switch]$SkipScheduledUpdate, [switch]$AllowUnsignedDevelopmentBuild)

$ErrorActionPreference = "Stop"
$signature = Get-AuthenticodeSignature -LiteralPath $PSCommandPath
if ($signature.Status -ne "Valid" -and -not ($AllowUnsignedDevelopmentBuild -and $signature.Status -eq "NotSigned")) {
    throw "Installer signature validation failed: $($signature.Status)"
}

codex plugin marketplace add ifczt/crm-agent-plugin
if ($LASTEXITCODE -ne 0) { throw "Unable to add the ifczt CRM marketplace" }

if (-not $SkipScheduledUpdate) {
    $updateScript = Join-Path $PSScriptRoot "update.ps1"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy AllSigned -File `"$updateScript`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "03:30"
    Register-ScheduledTask -TaskName "ifczt CRM Agent Update" -Action $action -Trigger $trigger -Description "Refresh the ifczt CRM Agent marketplace" -Force | Out-Null
}

Write-Host "ifczt CRM Agent marketplace installed. Open ChatGPT or Codex and install the plugin."
