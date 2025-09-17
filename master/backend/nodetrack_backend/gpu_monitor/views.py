from django.db.models import Sum, Avg, Max, Min, Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from datetime import datetime, timedelta
from ipware.ip import get_client_ip
from django.utils import timezone  # Import timezone module
from collections import defaultdict
from django.db.models.functions import TruncHour, TruncWeek, TruncMonth, TruncDay
from django.http import Http404
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from core.models import Node
from core.permissions import HasAPIToken
from core.utils import get_primary_ip
from gpu_monitor.models import GPU, GPUUsage
from gpu_monitor.serializers import GPUUsageSubmitSerializer

@api_view(['POST'])
def submit_gpu_data(request):
    """Handle GPU usage data submission"""
    bulk_data = request.data
    clien_ip, is_routable = get_client_ip(request)
    if not clien_ip:
        return Response({
            'status': 'error', 
            'message': 'IP address not found in request'
        })
    
    # Validate IP and get primary IP mapping
    primary_ip = get_primary_ip(clien_ip)
    if not primary_ip:
        raise Http404("IP address is Not found/Not trusted")
    for item in bulk_data:
        if not item.get('memory_used'):
            item['memory_used'] = 0
        # add ip address from the request
        # item['ip_address'] = clien_ip # no need as we are now getting it from the  client itself
    created_count = 0
    
    for entry in bulk_data:
        serializer = GPUUsageSubmitSerializer(data=entry)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # Get or create node using primary IP
            node, _ = Node.objects.get_or_create(
                ip_address=primary_ip,
                defaults={'hostname': data['hostname']},
            )
            
            # Get or create GPU
            gpu, _ = GPU.objects.get_or_create(
                node=node,
                gpu_id=data['gpu_id'],
                defaults={'memory_total': data['memory_total']}
            )
            
            # Create usage record - ensure timestamp is timezone aware
            timestamp = data['timestamp']
            if timezone.is_naive(timestamp):
                timestamp = timezone.make_aware(timestamp)
                
            if data.get('username'): # consider only the usage when the GPU is not idle (there is a process asssociated with the GPU)
                GPUUsage.objects.create(
                    gpu=gpu,
                    username=data['username'],
                    memory_used=data['memory_used'],
                    time=timestamp  # Use timezone-aware timestamp
                )
                created_count += 1
            
    return Response({
        'status': 'success', 
        'message': f'Created {created_count} GPU usage records'
    })

@api_view(['GET'])
@permission_classes([HasAPIToken])
@cache_page(120)  # Cache for 2 minutes (120 seconds)
@vary_on_headers('Authorization')  # Vary cache based on Authorization header
def generate_gpu_report(request):
    try:
        # Get date range from query parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        period = request.query_params.get('period', 'hour')
        
        # Set default date range if not provided
        if not start_date or not end_date:
            end_time = timezone.now() + timedelta(days=1)
            start_time = end_time - timedelta(days=30)
        else:
            # Parse ISO format strings and ensure they're timezone aware
            start_time = datetime.fromisoformat(start_date)
            end_time = datetime.fromisoformat(end_date)
            
            # Make timezone aware if they're naive
            if timezone.is_naive(start_time):
                start_time = timezone.make_aware(start_time)
            if timezone.is_naive(end_time):
                end_time = timezone.make_aware(end_time)
        
        
        # Get time series data
        time_series_data = get_gpu_time_series_data(period, start_time, end_time)
        
        # Get per-user statistics - using TimescaleDB's time_bucket for aggregation
        per_user = {}
        user_stats = GPUUsage.timescale.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values('username').annotate(
            total_memory=Sum('memory_used'),
            nodes_used=Count('gpu__node', distinct=True),
            gpus_used=Count('gpu', distinct=True)
        )
        
        for stat in user_stats:
            per_user[stat['username']] = {
                'total_memory': stat['total_memory'],
                'nodes_used': stat['nodes_used'],
                'gpus_used': stat['gpus_used']
            }
        
        # Get per-node statistics - using TimescaleDB's time_bucket for aggregation
        per_node = {}
        node_stats = GPUUsage.timescale.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values('gpu__node__hostname').annotate(
            avg_memory=Avg('memory_used'),
            max_memory=Max('memory_used'),
            min_memory=Min('memory_used'),
            total_capacity=Sum('gpu__memory_total'),
            max_users=Count('username', distinct=True),
            total_gpus=Count('gpu', distinct=True)
        )
        
        for stat in node_stats:
            hostname = stat['gpu__node__hostname']
            per_node[hostname] = {
                'avg_memory': float(stat['avg_memory']) if stat['avg_memory'] else 0.0,
                'max_memory': float(stat['max_memory']) if stat['max_memory'] else 0.0,
                'min_memory': float(stat['min_memory']) if stat['min_memory'] else 0.0,
                'total_capacity': float(stat['total_capacity']) if stat['total_capacity'] else 0.0,
                'max_users': stat['max_users'],
                'total_gpus': stat['total_gpus']
            }
        
        reports = {
            'date_range': {
                'start': start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end': end_time.strftime('%Y-%m-%d %H:%M:%S')
            },
            'time_series': time_series_data,
            'per_user': per_user,
            'per_node': per_node,
            'summary': time_series_data['summary']
        }
        
        return Response(reports)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def get_gpu_time_series_data(period='hour', start_time=None, end_time=None):
    
    assert start_time and end_time, "Start and end time must be provided"
    
    trunc_function = {
        'hour': TruncHour,
        'day': TruncDay,
        'week': TruncWeek,
        'month': TruncMonth
    }    
    
    # Fetch all nodes in a single query
    nodes = list(Node.objects.all().distinct())
    
    # Fetch all node memory totals in a single query
    node_memory_totals = {
        node_data['node']: node_data['total'] or 0
        for node_data in GPU.objects.values('node').annotate(total=Sum('memory_total'))
    }
    
    # Fetch all GPU usage data for all nodes in a single query
    all_node_data = (
        GPUUsage.timescale.filter(
            gpu__node__in=nodes,
            time__range=(start_time, end_time),
        )
        .values("gpu__node", "time")
        .annotate(total_memory_used=Sum("memory_used"))
        .annotate(truncated_time=trunc_function[period]("time"))
        .order_by("gpu__node", "time")
    )
    
    # Group the data by node
    data_by_node = defaultdict(list)
    for entry in all_node_data:
        node_id = entry['gpu__node']
        data_by_node[node_id].append({
            'truncated_time': entry['truncated_time'],
            'total_memory_used': entry['total_memory_used']
        })
    
    # Function to truncate timestamps to the appropriate precision
    truncate_timestamp = lambda ts: ts.replace(minute=0, second=0, microsecond=0) # noqa: E731
    
    nodes_timeseries = []
    
    # Calculate the time increment based on the period
    time_increments = {
        'hour': timedelta(hours=1),
        'day': timedelta(days=1),
        'week': timedelta(weeks=1),
        'month': timedelta(days=30)  # Approximate month increment
    }
    time_increment = time_increments[period]
    
    # Process data for each node
    for node in nodes:
        node_memory_total = node_memory_totals.get(node.id, 0)
        node_data = data_by_node.get(node.id, [])
        
        # Group by time bucket and calculate averages
        time_buckets = defaultdict(list)
        for entry in node_data:
            bucket_time = entry['truncated_time']
            time_buckets[bucket_time].append(entry['total_memory_used'])
        
        processed_data = {
            bucket_time: (sum(values) / len(values) if values else 0)
            for bucket_time, values in time_buckets.items()
        }
        
        # Generate complete time series with missing buckets filled in
        timeseries = []
        current_bucket = truncate_timestamp(start_time)
        end_truncated = truncate_timestamp(end_time)
        
        while current_bucket <= end_truncated:
            memory_used = processed_data.get(current_bucket, 0.0)
            timeseries.append({
                'timestamp': current_bucket.isoformat(),
                'memory_total': float(node_memory_total/1024),  # Convert to GB
                'memory_used': float(memory_used or 0) / 1024,  # Convert to GB
                'is_active': current_bucket in processed_data
            })
            current_bucket += time_increment
            
        timeseries.sort(key=lambda x: x['timestamp'])
        nodes_timeseries.append({
            f'node_{node.hostname}': timeseries
        })
    
    # Calculate summary statistics
    total_nodes = len(nodes)
    total_gpus = GPU.objects.all().distinct().count()
    total_capacity = sum(node_memory_totals.values())
    
    summary = {
        'total_capacity_gb': float(total_capacity / 1024),
        'total_gpus': total_gpus,
        'total_nodes': total_nodes,
        'time_range': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat()
        }
    }
    
    return {
        'nodes_timeseries': nodes_timeseries,
        'summary': summary
    }