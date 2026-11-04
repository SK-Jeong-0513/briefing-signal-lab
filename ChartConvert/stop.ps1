# Stops ChartConvert when its window is already gone. ASCII only (global rule 15).
. (Join-Path $PSScriptRoot 'server-tools.ps1')

if (-not (Stop-AppServer)) { exit 1 }
if (Wait-PortFree) { Write-Host "ChartConvert stopped (port $Port is free)" } else { exit 1 }
