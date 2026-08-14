[CmdletBinding()]
param([string]$LogPath = "$env:LOCALAPPDATA\ifczt-crm-agent\update.log")

$ErrorActionPreference = "Stop"
$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
    codex plugin marketplace upgrade ifczt-crm 2>&1 | Tee-Object -FilePath $LogPath -Append
    if ($LASTEXITCODE -ne 0) { throw "marketplace upgrade exited with $LASTEXITCODE" }
    "$(Get-Date -Format o) update completed" | Add-Content -LiteralPath $LogPath
}
catch {
    "$(Get-Date -Format o) update failed; existing cached version retained: $($_.Exception.Message)" | Add-Content -LiteralPath $LogPath
    exit 1
}
