import os
from flask import Flask, request, jsonify
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend/dashboard/dist')
CORS(app)

DATA_DIR = os.environ.get('SERVER_DATA_DIR')
if not DATA_DIR:
    DATA_DIR = './data'

LOG_FILE = f'{DATA_DIR}/cluster_gpu_usage.log'
EXCLUDED_USERS = {'gdm'}

# Add excluded users
EXCLUDED_USERS = {'gdm','?','NT AUTHORITY\SYSTEM',}

def clean_nan_values(obj):
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(x) for x in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return 0.0 if np.isnan(obj) else float(obj)
    elif pd.isna(obj):
        return 0.0
    return obj

def get_time_series_data(df, period='minute'):
    """
    Generate time series data with specified aggregation period
    """
    # Ensure timestamp is datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Define aggregation periods
    period_map = {
        'minute': '1min',
        'hour': '1h',
        'day': '1D',
        'week': '1W',
        'month': '1M'
    }
    
    # Resample and aggregate data
    resampled = df.resample(period_map[period], on='timestamp').agg({
        'memory_used': ['mean', 'max', 'min'],
        'gpu_id': 'nunique',
        'username': 'nunique'
    }).reset_index()
    
    # Flatten column names
    resampled.columns = ['timestamp', 'avg_memory', 'max_memory', 'min_memory', 'gpus_used', 'unique_users']
    
    return resampled.to_dict(orient='records')

@app.route('/submit', methods=['POST'])
def submit_data():
    data = request.get_json()
    with open(LOG_FILE, 'a') as f:
        for entry in data:
            f.write(json.dumps(entry) + '\n')
    return 'OK'

@app.route('/report', methods=['GET'])
def generate_report():
    try:
        # Get date range from query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        period = request.args.get('period', 'hour')
        
        # Read data
        df = pd.DataFrame([json.loads(line) for line in open(LOG_FILE)])
        df = df[~df['username'].isin(EXCLUDED_USERS)]
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Filter by date range if provided
        if start_date and end_date:
            start_time = pd.to_datetime(start_date)
            end_time = pd.to_datetime(end_date)
            df = df[(df['timestamp'] >= start_time) & (df['timestamp'] <= end_time)]
        else:
            # Default to last 30 days
            end_time = datetime.now()
            start_time = end_time - timedelta(days=30)
            df = df[df['timestamp'] >= start_time]
        
        # Generate time series data
        time_series = get_time_series_data(df, period)
        
        # Generate summary statistics
        per_user = df.groupby('username').agg({
            'memory_used': ['mean', 'max', 'min'],
            'hostname': 'nunique',
            'gpu_id': 'nunique'
        })
        per_user.columns = ['avg_memory', 'max_memory', 'min_memory', 'nodes_used', 'gpus_used']
        
        per_node = df.groupby('hostname').agg({
            'username': 'nunique',
            'memory_used': ['mean', 'max', 'min'],
            'gpu_id': 'nunique'  # Add GPU count per node
        })
        per_node.columns = ['unique_users', 'avg_memory', 'max_memory', 'min_memory', 'total_gpus']
        
        # Calculate total GPUs
        total_gpus = per_node['total_gpus'].sum()
        
        reports = {
            'date_range': {
                'start': start_time.strftime('%Y-%m-%d %h:%M:%S'),
                'end': end_time.strftime('%Y-%m-%d %h:%M:%S')
            },
            'time_series': time_series,
            'per_user': per_user.to_dict(orient='index'),
            'per_node': per_node.to_dict(orient='index'),
            'summary': {
                'total_memory': float(df['memory_used'].sum()),
                'avg_memory': float(df['memory_used'].mean()),
                'max_memory': float(df['memory_used'].max()),
                'min_memory': float(df['memory_used'].min()),
                'total_users': int(df['username'].nunique()),
                'total_nodes': int(df['hostname'].nunique()),
                'total_gpus': int(total_gpus)
            }
        }
        
        # Clean NaN values before sending response
        cleaned_reports = clean_nan_values(reports)
        return jsonify(cleaned_reports)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)