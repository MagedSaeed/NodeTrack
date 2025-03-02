import time
from dotenv import load_dotenv
import os
import traceback
from gpu.collect import collect_gpu_stats_and_send

load_dotenv()

UPDATE_INTERVAL = os.getenv("UPDATE_INTERVAL")
if not UPDATE_INTERVAL:
    raise ValueError("UPDATE_INTERVAL env var should be set")
else:
    UPDATE_INTERVAL = int(UPDATE_INTERVAL)


while True:
    try:
        collect_gpu_stats_and_send()
    except Exception as e:
        print(f"Cannot send data to server at {time.strftime('%Y-%m-%d %H:%M:%S')}. The error is: ",e)
        print("Traceback:")
        traceback.print_exc()
        print('-'*120)
    time.sleep(UPDATE_INTERVAL)