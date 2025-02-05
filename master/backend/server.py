import os
from flask import Flask, request, jsonify
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend/dashboard-app/dist')
CORS(app)

DATA_DIR = os.environ.get('SERVER_DATA_DIR')
if not DATA_DIR:
    DATA_DIR = './data'

LOG_FILE = f'{DATA_DIR}/cluster_gpu_usage.log'

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
    Generate time series data with specified aggregation period, aggregating by node
    """
    # Ensure timestamp is datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # First, aggregate memory per node per timestamp
    node_memory = df.groupby(['timestamp', 'hostname'])['memory_used'].sum().reset_index()
    
    # Define aggregation periods
    period_map = {
        'minute': '1min',
        'hour': '1h',
        'day': '1D',
        'week': '1W',
        'month': '1M'
    }
    
    # Calculate overall statistics
    time_stats = node_memory.groupby('timestamp').agg({
        'memory_used': ['mean', 'max', 'min']
    }).resample(period_map[period]).agg({
        ('memory_used', 'mean'): 'mean',
        ('memory_used', 'max'): 'max',
        ('memory_used', 'min'): 'min'
    })
    
    # Flatten the column names
    time_stats.columns = ['avg_memory', 'max_memory', 'min_memory']
    time_stats = time_stats.reset_index()
    
    # Calculate per-node time series
    node_time_series = {}
    for hostname in df['hostname'].unique():
        node_data = node_memory[node_memory['hostname'] == hostname]
        resampled_node = node_data.set_index('timestamp').resample(period_map[period])['memory_used'].mean()
        node_time_series[hostname] = resampled_node
    
    # Combine all node data with the main time series
    for timestamp in time_stats['timestamp']:
        for hostname, series in node_time_series.items():
            if timestamp in series.index:
                time_stats[f'node_{hostname}'] = series[timestamp]
    
    # Calculate GPU and node counts
    gpu_node_counts = df.groupby('timestamp').agg({
        'gpu_id': 'nunique',
        'hostname': 'nunique'
    }).resample(period_map[period]).agg({
        'gpu_id': 'max',
        'hostname': 'max'
    }).reset_index()
    
    # Merge the results
    resampled = time_stats.merge(gpu_node_counts, on='timestamp')
    resampled.columns = ['timestamp', 'avg_memory', 'max_memory', 'min_memory'] + \
                       [f'node_{hostname}' for hostname in df['hostname'].unique()] + \
                       ['gpus_used', 'total_nodes']
    
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
        
        # First aggregate memory by node and timestamp
        node_memory = df.groupby(['timestamp', 'hostname'])['memory_used'].sum().reset_index()
        
        # Generate per-user statistics (keeping this for user tracking)
        per_user = df.groupby('username').agg({
            'memory_used': 'sum',  # Changed to sum to get total memory used
            'hostname': 'nunique',
            'gpu_id': 'nunique'
        })
        per_user.columns = ['total_memory', 'nodes_used', 'gpus_used']
        
        # Generate per-node statistics
        per_node = df.groupby(['hostname', 'timestamp']).agg({
            'memory_used': 'sum',
            'username': 'nunique',
            'gpu_id': 'nunique'
        }).reset_index()
        
        # Calculate final per-node statistics
        per_node_stats = per_node.groupby('hostname').agg({
            'memory_used': ['mean', 'max', 'min'],
            'username': 'max',  # Max number of concurrent users
            'gpu_id': 'max'  # Total GPUs per node
        })
        per_node_stats.columns = ['avg_memory', 'max_memory', 'min_memory', 'max_users', 'total_gpus']
        
        # Calculate total GPUs and overall node statistics
        total_gpus = per_node_stats['total_gpus'].sum()
        
        # Calculate node-level summary statistics
        node_level_summary = node_memory.groupby('timestamp')['memory_used'].agg(['mean', 'max', 'min']).mean()
        
        reports = {
            'date_range': {
                'start': start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end': end_time.strftime('%Y-%m-%d %H:%M:%S')
            },
            'time_series': time_series,
            'per_user': per_user.to_dict(orient='index'),
            'per_node': per_node_stats.to_dict(orient='index'),
            'summary': {
                'avg_memory_per_node': float(node_level_summary['mean']),
                'max_memory_per_node': float(node_level_summary['max']),
                'min_memory_per_node': float(node_level_summary['min']),
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