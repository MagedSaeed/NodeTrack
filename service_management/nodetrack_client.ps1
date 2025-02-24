# Set-ExecutionPolicy ExecutionPolicy Bypass -Scope Process

# Get the directory one level above the current script
$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $currentDir


# Build paths relative to the root directory
$venvPython = Join-Path $rootDir "venv\Scripts\python.exe"
$serviceScript = Join-Path $currentDir "service_manager.py"
$clientScript = Join-Path $rootDir "client\collect.py"

# Verify all required files exist
$requiredFiles = @{
    "Python executable" = $venvPython
    "Service manager script" = $serviceScript
    "Client script" = $clientScript
}

foreach ($file in $requiredFiles.GetEnumerator()) {
    if (-Not (Test-Path $file.Value)) {
        Write-Error "Could not find $($file.Key) at: $($file.Value)"
        Exit 1
    }
}

# Start the service with dynamic paths
$arguments = @(
    "`"$serviceScript`"",
    "start",
    "client_daemon",
    "--script",
    "`"$clientScript`"",
    "--log-dir",
    "`"$rootDir`""
)

Start-Process -FilePath $venvPython -ArgumentList $arguments -NoNewWindow -Wait