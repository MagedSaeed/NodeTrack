import time
import os
from gpu.collect import collect_gpu_stats_and_send

UPDATE_INTERVAL = os.getenv("UPDATE_INTERVAL")
if not UPDATE_INTERVAL:
    UPDATE_INTERVAL = 5
else:
    UPDATE_INTERVAL = int(UPDATE_INTERVAL)


while True:
    collect_gpu_stats_and_send()
    time.sleep(UPDATE_INTERVAL)
