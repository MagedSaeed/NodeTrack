# collector_server.py
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

# Add excluded users
EXCLUDED_USERS = {'gdm'}

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
        df = pd.DataFrame([json.loads(line) for line in open(LOG_FILE)])
        df = df[~df['username'].isin(EXCLUDED_USERS)]
        
        current_time = datetime.now()
        last_month = current_time - timedelta(days=30)
        recent_df = df[pd.to_datetime(df['timestamp']) > last_month]
        
        date_range = {
            'start': last_month.strftime('%Y-%m-%d %H:%M:%S'),
            'end': current_time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        per_user = df.groupby('username').agg({
            'memory_used': ['mean', 'max', 'count'],
            'hostname': 'nunique',
            'gpu_id': 'nunique'
        })
        
        per_user.columns = ['avg_memory', 'max_memory', 'usage_count', 'nodes_used', 'gpus_used']
        
        per_node = df.groupby('hostname').agg({
            'username': 'nunique',
            'memory_used': 'mean'
        })
        per_node.columns = ['unique_users', 'avg_memory']
        
        monthly_stats = recent_df.groupby(['username', 'hostname']).agg({
            'memory_used': 'mean',
            'gpu_id': 'nunique'
        }).reset_index()
        
        monthly_dict = {}
        for _, row in monthly_stats.iterrows():
            key = f"{row['username']}_{row['hostname']}"
            monthly_dict[key] = {
                'avg_memory': float(row['memory_used']),
                'gpus_used': int(row['gpu_id']),
                'username': row['username'],
                'hostname': row['hostname']
            }

        reports = {
            'date_range': date_range,
            'per_user': per_user.to_dict(orient='index'),
            'per_node': per_node.to_dict(orient='index'),
            'last_month': monthly_dict
        }
        
        # Clean NaN values before sending response
        cleaned_reports = clean_nan_values(reports)
        return jsonify(cleaned_reports)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)