import yaml
from pathlib import Path
from django.conf import settings

def get_primary_ip(client_ip):
    client_ip = str(client_ip)
    config_path = Path(settings.BASE_DIR) / 'cluster_nodes.yaml'
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
    except FileNotFoundError:
        return None
    
    for node in config.get('nodes', []):
        primary_ip = node.get('primary_ip')
        secondary_ips = node.get('secondary_ips', [])
        # Check if it's the primary IP or one of the secondary IPs
        if client_ip == primary_ip or client_ip in secondary_ips:
            return primary_ip
    return None