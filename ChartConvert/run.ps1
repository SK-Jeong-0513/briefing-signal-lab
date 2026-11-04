# Starts ChartConvert. ASCII only (global rule 15).
. (Join-Path $PSScriptRoot 'server-tools.ps1')

$Host.UI.RawUI.WindowTitle = "ChartConvert server :$Port"
Set-Location $AppDir

if (-not (Stop-AppServer)) { exit 1 }
if (-not (Wait-PortFree)) {
    Write-Host "[ERROR] Port $Port did not become free within 5 seconds"
    exit 1
}
if (-not (Test-Path (Join-Path $AppDir 'node_modules\mermaid\dist\mermaid.min.js'))) {
    Write-Host "First run: installing the local chart renderer..."
    & npm.cmd install --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] npm install failed"; exit 1 }
}

Write-Host "Keep this window open while using the app. Closing it stops the app."
& python (Join-Path $AppDir 'app.py')
exit $LASTEXITCODE
