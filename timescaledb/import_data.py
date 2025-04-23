import os
import json
import psycopg2
from psycopg2.extras import Json
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# Database connection parameters
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'timescaledb')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASS = os.environ.get('DB_PASS', 'postgres')

# Log file path
LOG_FILE = os.environ.get('SERVER_DATA_DIR', './data') + '/cluster_gpu_usage.log'

def get_db_connection():
    """Create a connection to the TimescaleDB database"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def import_data():
    """Import data from log file to TimescaleDB"""
    # Check if log file exists
    if not os.path.exists(LOG_FILE):
        print(f"Log file not found: {LOG_FILE}")
        return
    
    # Read log file
    print(f"Reading log file: {LOG_FILE}")
    with open(LOG_FILE, 'r') as f:
        log_lines = f.readlines()
    
    if not log_lines:
        print("Log file is empty")
        return
    
    print(f"Found {len(log_lines)} records in log file")
    
    # Connect to database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Process records in batches
    batch_size = 1000
    total_imported = 0
    
    try:
        for i in range(0, len(log_lines), batch_size):
            batch = log_lines[i:i+batch_size]
            batch_records = []
            
            for line in batch:
                try:
                    entry = json.loads(line.strip())
                    
                    # Convert timestamp to datetime
                    timestamp = pd.to_datetime(entry['timestamp'])
                    
                    # Extract core fields
                    hostname = entry['hostname']
                    gpu_id = entry['gpu_id']
                    gpu_name = entry.get('gpu_name')
                    username = entry.get('username')
                    memory_used = entry.get('memory_used')
                    memory_total = entry.get('memory_total')
                    command = entry.get('command')
                    status = entry.get('status')
                    
                    # Create metadata JSON with any additional fields
                    metadata = {k: v for k, v in entry.items() 
                               if k not in ('timestamp', 'hostname', 'gpu_id', 'gpu_name', 
                                           'username', 'memory_used', 'memory_total', 
                                           'command', 'status')}
                    
                    batch_records.append((
                        timestamp, hostname, gpu_id, gpu_name, username,
                        memory_used, memory_total, command, status, Json(metadata)
                    ))
                    
                except json.JSONDecodeError:
                    print(f"Skipping invalid JSON: {line.strip()}")
                except Exception as e:
                    print(f"Error processing record: {e}")
            
            # Insert batch
            if batch_records:
                cursor.executemany("""
                    INSERT INTO gpu_metrics (
                        time, hostname, gpu_id, gpu_name, username,
                        memory_used, memory_total, command, status, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, batch_records)
                
                conn.commit()
                total_imported += len(batch_records)
                print(f"Imported {total_imported} records so far...")
        
        print(f"Successfully imported {total_imported} records to TimescaleDB")
    
    except Exception as e:
        conn.rollback()
        print(f"Error importing data: {e}")
    
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import_data()