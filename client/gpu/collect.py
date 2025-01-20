import gpustat
import json
from datetime import datetime
import requests
import socket
import time
from dotenv import load_dotenv
import os

load_dotenv()

SERVER_ADDERSS = os.getenv("SERVER_ADDERSS")
UPDATE_INTERVAL = int(os.getenv("UPDATE_INTERVAL"))

# raise error if not SERVER_ADDRESS
if SERVER_ADDERSS is None:
    raise Exception("SERVER_ADDERSS is not set. Set it in your .env file.")


def collect_and_send():
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
        requests.post(f"http://{SERVER_ADDERSS}:5000/submit", json=usage_data)
    except:
        # Fallback to local storage if network fails
        with open("gpu_usage_local.log", "a") as f:
            for entry in usage_data:
                f.write(json.dumps(entry) + "\n")


while True:
    collect_and_send()
    time.sleep(UPDATE_INTERVAL)