import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
import psutil
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import get_first_non_loopback_ip, get_hostname

load_dotenv()

SERVER_ADDRESS = os.getenv("SERVER_ADDRESS")

# raise error if not SERVER_ADDRESS
if SERVER_ADDRESS is None:
    raise Exception("SERVER_ADDRESS is not set. Set it in your .env file.")


class CPUCollector:
    """CPU stats collector using psutil (works on both Linux and Windows)"""

    def __init__(self):
        self.hostname = get_hostname()
        self.ip_address = get_first_non_loopback_ip()

    def collect_stats(self):
        """Collect CPU statistics by user"""
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Get overall CPU metrics
            overall_cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()

            # Get CPU usage by user
            user_cpu = {}
            for proc in psutil.process_iter(['username', 'cpu_percent']):
                try:
                    proc_info = proc.info
                    username = proc_info['username']
                    cpu_percent = proc_info['cpu_percent']

                    if username and cpu_percent:
                        if username in user_cpu:
                            user_cpu[username] += cpu_percent
                        else:
                            user_cpu[username] = cpu_percent
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass

            usage_data = []

            # Create records for users with significant CPU usage (>0.1%)
            for username, cpu_percent in user_cpu.items():
                if cpu_percent > 0.1:
                    usage_data.append({
                        "timestamp": timestamp,
                        "hostname": self.hostname,
                        "ip_address": self.ip_address,
                        "username": username,
                        "cpu_usage_percent": round(cpu_percent, 2),
                        "cpu_cores": cpu_count,
                        "cpu_frequency_mhz": cpu_freq.current if cpu_freq else None
                    })

            # If no users have significant usage, create one record with system usage
            if not usage_data:
                usage_data.append({
                    "timestamp": timestamp,
                    "hostname": self.hostname,
                    "ip_address": self.ip_address,
                    "username": "system",
                    "cpu_usage_percent": overall_cpu_percent,
                    "cpu_cores": cpu_count,
                    "cpu_frequency_mhz": cpu_freq.current if cpu_freq else None
                })

            return usage_data

        except Exception as e:
            print(f"Error collecting CPU stats: {str(e)}")
            return []

    def send_stats(self, usage_data):
        """Send stats to server or save locally on failure"""
        try:
            response = requests.post(f"http://{SERVER_ADDRESS}:5000/cpu/submit", json=usage_data)
            response.raise_for_status()
            print(f"Successfully sent {len(usage_data)} CPU records to server")
        except Exception as e:
            print(f"Error sending CPU data to master: {str(e)}")
            # Fallback to local storage if network fails
            with open("cpu_usage_local.log", "a") as f:
                for entry in usage_data:
                    f.write(json.dumps(entry) + "\n")

    def collect_and_send(self):
        """Collect stats and send them"""
        usage_data = self.collect_stats()
        if usage_data:
            self.send_stats(usage_data)
        else:
            print("No CPU data collected")


def collect_cpu_stats_and_send():
    collector = CPUCollector()
    collector.collect_and_send()