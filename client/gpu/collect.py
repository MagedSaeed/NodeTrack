import json
from datetime import datetime
import requests
import socket
from dotenv import load_dotenv
import os
import platform
import subprocess
import base64
import sys

load_dotenv()

SERVER_ADDRESS = os.getenv("SERVER_ADDRESS")

# raise error if not SERVER_ADDRESS
if SERVER_ADDRESS is None:
    raise Exception("SERVER_ADDRESS is not set. Set it in your .env file.")


class GPUCollector:
    """Base class for GPU stats collection"""
    
    def __init__(self):
        self.hostname = socket.gethostname()
        
    def collect_stats(self):
        """Should be implemented by platform-specific classes"""
        raise NotImplementedError
        
    def send_stats(self, usage_data):
        """Send stats to server or save locally on failure"""
        try:
            response = requests.post(f"http://{SERVER_ADDRESS}:5000/gpu/submit", json=usage_data)
            response.raise_for_status()
            print(f"Successfully sent {len(usage_data)} records to server")
        except Exception as e:
            print(f"Error sending data to master: {str(e)}")
            # Fallback to local storage if network fails
            with open("gpu_usage_local.log", "a") as f:
                for entry in usage_data:
                    f.write(json.dumps(entry) + "\n")

    def collect_and_send(self):
        """Collect stats and send them"""
        usage_data = self.collect_stats()
        if usage_data:
            self.send_stats(usage_data)
        else:
            print("No GPU data collected")


class LinuxGPUCollector(GPUCollector):
    """GPU stats collector for Linux systems using gpustat"""

    def collect_stats(self):
        try:
            import gpustat
        except ImportError:
            print("gpustat not installed. Install it with: pip install gpustat")
            return []

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        stats = gpustat.GPUStatCollection.new_query()

        usage_data = []
        for gpu in stats:
            if not gpu.processes:
                # Add entry for idle GPU
                entry = {
                    "timestamp": timestamp,
                    "hostname": self.hostname,
                    "gpu_id": gpu.index,
                    "gpu_name": gpu.name,
                    "username": None,
                    "memory_used": 0,
                    "memory_total": gpu.memory_total,
                    "command": None,
                    "status": "idle",
                }
                usage_data.append(entry)
            else:
                # Add entries for active processes
                for process in gpu.processes:
                    entry = {
                        "timestamp": timestamp,
                        "hostname": self.hostname,
                        "gpu_id": gpu.index,
                        "gpu_name": gpu.name,
                        "username": process["username"],
                        "memory_used": process["gpu_memory_usage"],
                        "memory_total": gpu.memory_total,
                        "command": process["command"],
                        "status": "active",
                    }
                    usage_data.append(entry)

        return usage_data


class WindowsGPUCollector(GPUCollector):
    """GPU stats collector for Windows systems using PowerShell"""

    def _get_gpu_info(self):
        """Get basic GPU information including accurate memory"""
        try:
            # Query GPU information - use nvidia-smi for better memory reporting
            cmd = '''powershell -command "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits"'''.strip()
            output = subprocess.check_output(cmd, shell=True)
            if output:
                output = output.decode("utf-8")
            else:
                return []
            gpus = []
            for line in output.splitlines():
                gpus.append({
                    'Name': line.split(',')[0].strip(),
                    'TotalMemoryMB': line.split(',')[1].strip(),
                })

            return gpus
        except Exception as e:
            print('Error with colecting gpu info')
            return []


    def _get_process_owner(self, pid):
        """Get the owner of a process"""
        try:
            # Note: Using the pid parameter instead of hardcoded 3540
            ps_command = f'''
            Get-WmiObject -Class Win32_Process -Filter "ProcessId = {pid}" |
            Select-Object ProcessId, Name, @{{Name='Owner';Expression={{
                $owner = $_.GetOwner()
                "$($owner.Domain)\\$($owner.User)"
            }}}} | ConvertTo-Json
            '''

            # Encode the command
            encoded_bytes = ps_command.encode('utf-16le')
            encoded_command = base64.b64encode(encoded_bytes).decode('ascii')

            # Execute the encoded command
            cmd = f'powershell -EncodedCommand {encoded_command}'
            output = subprocess.check_output(cmd, shell=True)

            # Parse JSON output
            process_info = json.loads(output)
            return process_info
        except Exception as e:
            print(f"Error getting process owner: {str(e)}")
            return {"Name": "Unknown", "Owner": "Unknown", "CommandLine": "Unknown"}

    def collect_stats(self):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        usage_data = []

        try:
            # Get GPU info
            gpus = self._get_gpu_info()

            # Get GPU memory usage by process
            cmd = '''powershell -command "(Get-Counter '\GPU Process Memory(*)\Local Usage').CounterSamples | Select-Object InstanceName, CookedValue | Sort-Object -Property CookedValue -Descending | ConvertTo-Json"'''
            output = subprocess.check_output(cmd, shell=True)
            memory_data = json.loads(output)

            # If no processes are using GPU, add entries for idle GPUs
            if not memory_data:
                for i, gpu in enumerate(gpus):
                    entry = {
                        "timestamp": timestamp,
                        "hostname": self.hostname,
                        "gpu_id": i,
                        "gpu_name": gpu.get("Name", "Unknown"),
                        "username": None,
                        "memory_used": 0,
                        "memory_total": gpu.get("TotalMemoryMB", 0),
                        "command": None,
                        "status": "idle",
                    }
                    usage_data.append(entry)
                return usage_data
            # Process GPU usage information
            print(gpus)
            for entry in memory_data:
                instance_name = entry['InstanceName']
                memory_used = entry['CookedValue'] / (1024 * 1024)  # Convert to MB

                # Extract PID and GPU ID
                pid = instance_name.split('_')[1]
                gpu_id = int(instance_name.split('_')[-1])


                # Get process info
                process_info = self._get_process_owner(pid)

                # Get GPU name (match by index)
                gpu_name = "Unknown"
                if gpu_id < len(gpus):
                    gpu_name = gpus[gpu_id].get("Name", "Unknown")

                # Get memory total
                memory_total = 0
                if gpu_id < len(gpus):
                    memory_total = gpus[gpu_id].get("TotalMemoryMB", 0)

                # Parse username from Owner (Domain\User)
                username = process_info.get('Owner',"Unknown")

                entry = {
                    "timestamp": timestamp,
                    "hostname": self.hostname,
                    "gpu_id": gpu_id,
                    "gpu_name": gpu_name,
                    "username": username,
                    "memory_used": round(memory_used, 2),
                    "memory_total": memory_total,
                    "command": process_info.get("CommandLine", process_info.get("Name", "Unknown")),
                    "status": "active",
                }
                usage_data.append(entry)

            # Add entry for any idle GPUs
            used_gpu_ids = set(entry["gpu_id"] for entry in usage_data)
            for i, gpu in enumerate(gpus):
                if i not in used_gpu_ids:
                    entry = {
                        "timestamp": timestamp,
                        "hostname": self.hostname,
                        "gpu_id": i,
                        "gpu_name": gpu.get("Name", "Unknown"),
                        "username": None,
                        "memory_used": 0,
                        "memory_total": gpu.get("TotalMemoryMB", 0),
                        "command": None,
                        "status": "idle",
                    }
                    usage_data.append(entry)

        except Exception as e:
           print(f"Error collecting Windows GPU stats: {str(e)}")

        return usage_data


def get_collector():
    """Factory function to return the appropriate collector for the current OS"""
    system = platform.system()
    if system == "Linux":
        return LinuxGPUCollector()
    elif system == "Windows":
        return WindowsGPUCollector()
    else:
        print(f"Unsupported operating system: {system}")
        sys.exit(1)



def collect_gpu_stats_and_send():
    collector = get_collector()
    collector.collect_and_send()