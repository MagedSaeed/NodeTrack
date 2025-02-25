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
# EXCLUDED_USERS = {'gdm', '?', 'NT AUTHORITY\SYSTEM'}

def clean_nan_values(obj):
    """Clean NaN values from the data structure"""
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

def get_time_series_data(df, period='hour'):
    """
    Generate time series data with specified aggregation period, aggregating by node
    
    Parameters:
    df (pandas.DataFrame): DataFrame with GPU usage data
    period (str): Aggregation period ('minute', 'hour', 'day', 'week', 'month')
    
    Returns:
    dict: Dictionary containing nodes_timeseries and summary statistics
    """
    # Convert timestamp to datetime if not already
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Define aggregation periods
    period_map = {
        'hour': '1h',
        'day': '1D',
        'week': '1W',
        'month': '1M'
    }
    
    # Calculate memory usage and total capacity per node per timestamp
    gpu_data = df.groupby(['timestamp', 'hostname', 'gpu_id']).agg({
        'memory_used': 'sum',
        'memory_total': 'first'  # Take first since it should be constant per GPU
    }).reset_index()
    
    # Resample to specified period
    gpu_data['period'] = gpu_data['timestamp'].dt.floor(period_map[period])
    
    # Calculate period average per GPU
    period_gpu = gpu_data.groupby(['period', 'hostname', 'gpu_id']).agg({
        'memory_used': 'mean',
        'memory_total': 'first'  # Take first since it should be constant per GPU
    }).reset_index()
    
    # Sum across all GPUs for each node per period
    node_totals = period_gpu.groupby(['period', 'hostname']).agg({
        'memory_used': 'sum',
        'memory_total': 'sum'  # Sum total memory across GPUs per node
    }).reset_index()
    
    # Create the time series for each node
    nodes_timeseries = []
    for hostname in sorted(node_totals['hostname'].unique()):
        node_data = node_totals[node_totals['hostname'] == hostname]
        timeseries = [
            {
                'timestamp': row['period'].isoformat(),
                'memory_used': float(row['memory_used'] / 1024),  # Convert to GB
                'memory_total': float(row['memory_total'] / 1024)  # Convert to GB
            }
            for _, row in node_data.iterrows()
        ]
        nodes_timeseries.append({
            f'node_{hostname}': timeseries
        })
    
    # Count total unique GPUs by considering hostname and gpu_id combinations
    # This ensures we count each physical GPU rather than just unique gpu_id values
    total_gpus = df.drop_duplicates(['hostname', 'gpu_id']).shape[0]
    
    # Calculate summary statistics
    summary = {
        'total_capacity_gb': float(node_totals.groupby('period')['memory_total'].mean().mean() / 1024),
        'total_gpus': int(total_gpus),
        'total_nodes': int(df['hostname'].nunique()),
        'time_range': {
            'start': node_totals['period'].min().isoformat(),
            'end': node_totals['period'].max().isoformat()
        }
    }
    
    return {
        'nodes_timeseries': nodes_timeseries,
        'summary': summary
    }

@app.route('/submit', methods=['POST'])
def submit_data():
    """Handle data submission endpoint"""
    data = request.get_json()
    with open(LOG_FILE, 'a') as f:
        for entry in data:
            f.write(json.dumps(entry) + '\n')
    return 'OK'

@app.route('/report', methods=['GET'])
def generate_report():
    """Generate comprehensive usage report"""
    try:
        # Get date range from query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        period = request.args.get('period', 'hour')
        
        # Read data
        df = pd.DataFrame([json.loads(line) for line in open(LOG_FILE)])
        # df = df[~df['username'].isin(EXCLUDED_USERS)]
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
        
        # Generate time series data with new structure
        time_series_data = get_time_series_data(df, period)
        
        # Generate per-user statistics
        per_user = df.groupby('username').agg({
            'memory_used': 'sum',
            'hostname': 'nunique',
            'gpu_id': 'nunique'
        })
        per_user.columns = ['total_memory', 'nodes_used', 'gpus_used']
        
        # Generate per-node statistics
        per_node = df.groupby(['hostname', 'timestamp']).agg({
            'memory_used': 'sum',
            'memory_total': 'sum',
            'username': 'nunique',
            'gpu_id': 'nunique'
        }).reset_index()
        
        # Calculate final per-node statistics
        per_node_stats = per_node.groupby('hostname').agg({
            'memory_used': ['mean', 'max', 'min'],
            'memory_total': 'max',
            'username': 'max',
            'gpu_id': 'max'
        })
        per_node_stats.columns = ['avg_memory', 'max_memory', 'min_memory', 'total_capacity', 'max_users', 'total_gpus']
        
        reports = {
            'date_range': {
                'start': start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end': end_time.strftime('%Y-%m-%d %H:%M:%S')
            },
            'time_series': time_series_data,
            'per_user': per_user.to_dict(orient='index'),
            'per_node': per_node_stats.to_dict(orient='index'),
            'summary': time_series_data['summary']
        }
        
        # Clean NaN values before sending response
        cleaned_reports = clean_nan_values(reports)
        return jsonify(cleaned_reports)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)