# should run as a cron command
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
        for process in gpu.processes:
            entry = {
                "timestamp": timestamp,
                "hostname": hostname,
                "gpu_id": gpu.index,
                "username": process["username"],
                "memory_used": process["gpu_memory_usage"],
                "command": process["command"],
            }
            usage_data.append(entry)

    # Send to master
    try:
        requests.post(f"http://{SERVER_ADDRESS}:5000/submit", json=usage_data)
    except:
        # Fallback to local storage if network fails
        with open("gpu_usage_local.log", "a") as f:
            for entry in usage_data:
                f.write(json.dumps(entry) + "\n")
