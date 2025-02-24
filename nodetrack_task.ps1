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

# Script to create NodeTrack scheduled task
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument '"C:\Users\ondemand_admin\Desktop\Projects\NodeTrack\nodetrack_script.ps1"'

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