import time
from dotenv import load_dotenv
import os
from gpu.collect import collect_gpu_stats_and_send

load_dotenv()

UPDATE_INTERVAL = os.getenv("UPDATE_INTERVAL")
if not UPDATE_INTERVAL:
    UPDATE_INTERVAL = 5
else:
    UPDATE_INTERVAL = int(UPDATE_INTERVAL)


while True:
    collect_gpu_stats_and_send()
    time.sleep(UPDATE_INTERVAL)
