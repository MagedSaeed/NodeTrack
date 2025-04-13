import gpustat
import json
from datetime import datetime
import requests
import socket
from dotenv import load_dotenv
import os

load_dotenv()

SERVER_ADDRESS = os.getenv("SERVER_ADDRESS")

# raise error if not SERVER_ADDRESS
if SERVER_ADDRESS is None:
    raise Exception("SERVER_ADDRESS is not set. Set it in your .env file.")


def collect_gpu_stats_and_send():
    hostname = socket.gethostname()
    stats = gpustat.GPUStatCollection.new_query()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    usage_data = []
    for gpu in stats:
        if not gpu.processes:
            # Add entry for idle GPU
            entry = {
                "timestamp": timestamp,
                "hostname": hostname,
                "gpu_id": gpu.index,
                "gpu_name": gpu.name,
                "username": None,
                "memory_used": 0,
                "memory_total": gpu.memory_total,
                "command": None,
                "status": "idle"
            }
            usage_data.append(entry)
        else:
            # Add entries for active processes
            for process in gpu.processes:
                entry = {
                    "timestamp": timestamp,
                    "hostname": hostname,
                    "gpu_id": gpu.index,
                    "gpu_name": gpu.name,
                    "username": process["username"],
                    "memory_used": process["gpu_memory_usage"],
                    "memory_total": gpu.memory_total,
                    "command": process["command"],
                    "status": "active"
                }
                usage_data.append(entry)

    # Send to master
    try:
        response = requests.post(f"http://{SERVER_ADDRESS}:5000/gpu/submit", json=usage_data)
        response.raise_for_status()  # Raise an exception for bad status codes
    except Exception as e:
        print(f"Error sending data to master: {str(e)}")
        # Fallback to local storage if network fails
        with open("gpu_usage_local.log", "a") as f:
            for entry in usage_data:
                f.write(json.dumps(entry) + "\n")