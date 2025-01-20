# collector_server.py
from flask import Flask, request, jsonify
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_cors import CORS  # Add this import

app = Flask(__name__, static_folder='../frontend/dashboard/dist')
CORS(app)
LOG_FILE = 'cluster_gpu_usage.log'

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
        # Read and parse log file
        df = pd.DataFrame([json.loads(line) for line in open(LOG_FILE)])
        
        # Generate various reports
        current_time = datetime.now()
        last_24h = current_time - timedelta(days=1)
        
        recent_df = df[pd.to_datetime(df['timestamp']) > last_24h]
        
        # Format reports to be JSON serializable
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
        
        # Fix the last_24h stats by creating a compound key
        last_24h_stats = recent_df.groupby(['username', 'hostname']).agg({
            'memory_used': 'mean',
            'gpu_id': 'nunique'
        }).reset_index()
        
        # Convert to dictionary with proper string keys
        last_24h_dict = {}
        for _, row in last_24h_stats.iterrows():
            key = f"{row['username']}_{row['hostname']}"
            last_24h_dict[key] = {
                'avg_memory': float(row['memory_used']),
                'gpus_used': int(row['gpu_id']),
                'username': row['username'],
                'hostname': row['hostname']
            }

        reports = {
            'per_user': per_user.to_dict(orient='index'),
            'per_node': per_node.to_dict(orient='index'),
            'last_24h': last_24h_dict
        }
        
        # Convert numeric types to native Python types
        for section in reports:
            if isinstance(reports[section], dict):
                for key in reports[section]:
                    if isinstance(reports[section][key], dict):
                        for subkey in reports[section][key]:
                            if isinstance(reports[section][key][subkey], np.int64):
                                reports[section][key][subkey] = int(reports[section][key][subkey])
                            elif isinstance(reports[section][key][subkey], np.float64):
                                reports[section][key][subkey] = float(reports[section][key][subkey])

        return jsonify(reports)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=5000, debug=True)
    app.run(host='0.0.0.0', port=5000, debug=False)