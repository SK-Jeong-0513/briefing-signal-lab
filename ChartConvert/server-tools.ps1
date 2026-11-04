# Shared helpers for run.ps1 and stop.ps1. ASCII only (global rule 15).

$script:AppDir = $PSScriptRoot
$script:Port = [int](Get-Content (Join-Path $AppDir 'config.json') -Raw | ConvertFrom-Json).port

function Get-ProcessTree([int]$RootId) {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootId"
    foreach ($child in $children) { Get-ProcessTree $child.ProcessId }
    $RootId
}

function Test-OwnProcess([int]$ProcessId) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
    if (-not $proc) { return $false }
    if ($proc.CommandLine -and $proc.CommandLine -like '*app.py*') {
        $cwdMatch = $proc.CommandLine -like "*$AppDir*"
        if ($cwdMatch) { return $true }
    }
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)"
    return [bool]($parent -and $parent.CommandLine -and $parent.CommandLine -like "*$AppDir*")
}

# Stops this app's server only. Returns $false when another app owns the port.
function Stop-AppServer {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($id in $listeners) {
        if (-not (Test-OwnProcess $id)) {
            $path = (Get-CimInstance Win32_Process -Filter "ProcessId=$id").ExecutablePath
            Write-Host "[ERROR] Port $Port is used by another app (PID $id, $path)"
            return $false
        }
    }
    foreach ($id in $listeners) {
        foreach ($treeId in (Get-ProcessTree $id)) {
            Stop-Process -Id $treeId -Force -ErrorAction SilentlyContinue
        }
    }
    return $true
}

function Wait-PortFree {
    for ($i = 0; $i -lt 10; $i++) {
        if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}
