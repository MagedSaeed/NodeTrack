#!/bin/bash

# Get the directory of the current script
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build the path to the client script
client_script="$script_dir/nodetrack_client.sh"

# Verify the client script exists
if [ ! -f "$client_script" ]; then
  echo "Error: Could not find nodetrack_client.sh in the same directory as this script"
  exit 1
fi

# Make the client script executable
chmod +x "$client_script"

# Get current username
current_user=$(whoami)

# Create a temporary file for the crontab
temp_crontab=$(mktemp)

# Export current crontab to the temporary file
crontab -l > "$temp_crontab" 2>/dev/null || echo "" > "$temp_crontab"

# Check if the entry already exists to avoid duplicates
if ! grep -q "@reboot $client_script" "$temp_crontab"; then
  # Add the new entry to run at system startup
  echo "@reboot $client_script" >> "$temp_crontab"
  
  # Install the new crontab
  crontab "$temp_crontab"
  
  echo "Successfully scheduled client_daemon.sh to run at system startup"
else
  echo "Task already exists in crontab"
fi

# Clean up
rm -f "$temp_crontab"