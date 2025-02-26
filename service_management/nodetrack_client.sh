#!/bin/bash

# Get the directory of the current script
current_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(dirname "$current_dir")"

# Build paths relative to the root directory
venv_python="$root_dir/venv/bin/python"
service_script="$current_dir/service_manager.py"
client_script="$root_dir/client/collect.py"

# Verify all required files exist
declare -A required_files=(
    ["Python executable"]="$venv_python"
    ["Service manager script"]="$service_script"
    ["Client script"]="$client_script"
)

for key in "${!required_files[@]}"; do
    if [ ! -f "${required_files[$key]}" ]; then
        echo "Error: Could not find $key at: ${required_files[$key]}" >&2
        exit 1
    fi
done

# Start the service with dynamic paths
"$venv_python" "$service_script" start client_daemon --script "$client_script" --log-dir "$root_dir"