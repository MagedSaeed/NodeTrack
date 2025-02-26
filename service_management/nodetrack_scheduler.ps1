# Self-elevate the script if required
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    if ([int](Get-CimInstance -Class Win32_OperatingSystem | Select-Object -ExpandProperty BuildNumber) -ge 6000) {
        $CommandLine = "-File `"" + $MyInvocation.MyCommand.Path + "`" " + $MyInvocation.UnboundArguments
        Start-Process -FilePath PowerShell.exe -Verb Runas -ArgumentList $CommandLine
        Exit
    }
}

# Get current username
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# Get the directory of the current script
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

# Build the path to nodetrack_client.ps1
$clientScriptPath = Join-Path $scriptDirectory "nodetrack_client.ps1"

# Verify the client script exists
if (-Not (Test-Path $clientScriptPath)) {
    Write-Error "Could not find nodetrack_client.ps1 in the same directory as this script"
    Exit 1
}

# Script to create NodeTrack scheduled task
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "`"$clientScriptPath`""

$trigger = New-ScheduledTaskTrigger -AtStartup

# Updated principal to use current user but run whether logged in or not
$principal = New-ScheduledTaskPrincipal `
    -UserID $currentUser `
    -LogonType S4U `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName "NodeTrackTask" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Description "Runs NodeTrack script at system startup" `
    -Force