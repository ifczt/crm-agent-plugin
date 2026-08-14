[CmdletBinding()]
param([string]$LogPath = "$env:LOCALAPPDATA\ifczt-crm-cli\update.log")

$ErrorActionPreference = "Stop"
$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
    npm install --global github:ifczt/crm-agent-plugin#main 2>&1 |
        Tee-Object -FilePath $LogPath -Append
    if ($LASTEXITCODE -ne 0) { throw "npm install exited with $LASTEXITCODE" }

    crm-cli setup --skip-schedule --format json 2>&1 |
        Tee-Object -FilePath $LogPath -Append
    if ($LASTEXITCODE -ne 0) { throw "crm-cli setup exited with $LASTEXITCODE" }

    "$(Get-Date -Format o) update completed" | Add-Content -LiteralPath $LogPath
}
catch {
    "$(Get-Date -Format o) update failed; existing version retained: $($_.Exception.Message)" |
        Add-Content -LiteralPath $LogPath
    exit 1
}
