from django.db.models import Sum, Avg, Max, Min, Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from datetime import datetime, timedelta
from ipware.ip import get_client_ip
from django.utils import timezone  # Import timezone module

from core.models import Node
from core.permissions import HasAPIToken
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
    for item in bulk_data:
        if not item.get('memory_used'):
            item['memory_used'] = 0
        # add ip address from the request
        item['ip_address'] = clien_ip
    created_count = 0
    
    for entry in bulk_data:
        serializer = GPUUsageSubmitSerializer(data=entry)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # Get or create node
            node, _ = Node.objects.get_or_create(
                ip_address=data['ip_address'],
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
        
        # Filter usage data by date range - note the use of 'time' instead of 'timestamp'
        usage_data = GPUUsage.timescale.filter(
            time__gte=start_time,
            time__lte=end_time
        ).distinct().select_related('gpu__node')
        
        # Get time series data
        time_series_data = get_gpu_time_series_data(usage_data, period, start_time, end_time)
        
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

def get_gpu_time_series_data(usage_data, period='hour', start_time=None, end_time=None, grace_period_minutes=15):
    # Convert period to TimescaleDB time_bucket interval format
    period_map = {
        'hour': '1 hour',
        'day': '1 day',
        'week': '1 week',
        'month': '1 month'
    }
    bucket_interval = period_map[period]
    
    # Define grace period based on the parameter
    grace_period = timedelta(minutes=grace_period_minutes)
    
    # Ensure start_time and end_time are timezone aware
    if start_time and timezone.is_naive(start_time):
        start_time = timezone.make_aware(start_time)
    if end_time and timezone.is_naive(end_time):
        end_time = timezone.make_aware(end_time)
        
    # Get all nodes - not just nodes with usage data
    nodes = Node.objects.all().distinct()
    
    # Get memory total for all GPUs
    memory_total = GPU.objects.all().distinct().aggregate(total=Sum('memory_total'))['total'] or 0
    
    # Function to truncate timestamps to the appropriate precision
    def truncate_timestamp(ts):
        return ts.replace(minute=0, second=0, microsecond=0)
        # if period == 'hour':
        #     return ts.replace(minute=0, second=0, microsecond=0)
        # elif period == 'day':
        #     return ts.replace(hour=0, minute=0, second=0, microsecond=0)
        # elif period == 'week':
        #     # For weekly, truncate to the start of the week (assuming Monday is the first day)
        #     days_since_monday = ts.weekday()
        #     return (ts - timedelta(days=days_since_monday)).replace(
        #         hour=0, minute=0, second=0, microsecond=0)
        # elif period == 'month':
        #     # For monthly, truncate to the first day of the month
        #     return ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # return ts
    
    # Get time series data per node
    nodes_timeseries = []
    
    for node in nodes:
        # Get node-specific data in single query
        node_memory_total = GPU.objects.filter(
            node=node
        ).aggregate(total=Sum('memory_total'))['total'] or 0
        
        # Get the raw data points for this node
        raw_node_data = GPUUsage.timescale.filter(
            gpu__node=node,
            time__lte=end_time,
            time__gte=start_time,
        ).values('time').annotate(
            total_memory_used=Sum('memory_used')
        ).order_by('time')

        # Now process in Python to bucket by time
        from collections import defaultdict
        time_buckets = defaultdict(list)

        for entry in raw_node_data:
            # Determine which bucket this timestamp belongs to
            bucket_time = truncate_timestamp(entry['time'])
            time_buckets[bucket_time].append(entry['total_memory_used'])

        # Calculate the average for each bucket
        node_data = []
        for bucket_time, values in time_buckets.items():
            avg_memory_used = sum(values) / len(values) if values else 0
            node_data.append({
                'bucket': bucket_time,
                'memory_used': avg_memory_used
            })

        # Sort by bucket time
        node_data.sort(key=lambda x: x['bucket'])
        
        # Pre-fetch ALL raw data points for this node within the timeframe (plus grace periods)
        # This eliminates the need for multiple individual queries later
        extended_start = start_time - grace_period if start_time else None
        extended_end = end_time + grace_period if end_time else None
        
        # Get all activity timestamps in one query
        all_activity_times = list(GPUUsage.timescale.filter(
            gpu__node=node,
            time__lte=extended_end,
            time__gte=extended_start,
        ).values_list('time', flat=True).distinct().order_by('time'))
        
        # Create activity lookup dictionary for efficient checks
        # Key: truncated timestamp, Value: set of all activity timestamps within that bucket
        activity_by_bucket = {}
        
        for activity_time in all_activity_times:
            truncated = truncate_timestamp(activity_time)
            if truncated not in activity_by_bucket:
                activity_by_bucket[truncated] = set()
            activity_by_bucket[truncated].add(activity_time)
        
        # Build the timeseries
        timeseries = []
        
        # Process the bucketed data points first
        data_by_truncated_bucket = {}
        for data_point in node_data:
            bucket = data_point['bucket']
            truncated_bucket = truncate_timestamp(bucket)
            data_by_truncated_bucket[truncated_bucket] = data_point['memory_used'] or 0
            
            timeseries.append({
                'timestamp': bucket.isoformat(),
                'memory_total': float(node_memory_total/1024),  # Convert to GB
                'memory_used': float(data_point['memory_used'] or 0) / 1024,  # Convert to GB
                'is_active': True  # We know this point has data
            })
        
        # Generate missing time buckets
        if start_time and end_time:
            current_bucket = truncate_timestamp(start_time)
            end_truncated = truncate_timestamp(end_time)
            
            while current_bucket <= end_truncated:
                # Only process if not already in our data
                if current_bucket not in data_by_truncated_bucket:
                    # Define grace period window
                    grace_start = current_bucket - grace_period
                    grace_end = current_bucket + grace_period
                    
                    # Efficiently check if there's activity in grace period
                    is_active = False
                    
                    # Check the current bucket and adjacent buckets that might overlap with grace period
                    possible_buckets = [current_bucket]
                    
                    # Add previous bucket if it could contain activity within grace period
                    if period == 'hour':
                        prev_bucket = current_bucket - timedelta(hours=1)
                        next_bucket = current_bucket + timedelta(hours=1)
                    elif period == 'day':
                        prev_bucket = current_bucket - timedelta(days=1)
                        next_bucket = current_bucket + timedelta(days=1)
                    elif period == 'week':
                        prev_bucket = current_bucket - timedelta(weeks=1)
                        next_bucket = current_bucket + timedelta(weeks=1)
                    else:  # month
                        # Approximate
                        prev_bucket = (current_bucket.replace(day=1) - timedelta(days=1)).replace(day=1)
                        # Next month (approximate)
                        if current_bucket.month == 12:
                            next_bucket = current_bucket.replace(year=current_bucket.year+1, month=1, day=1)
                        else:
                            next_bucket = current_bucket.replace(month=current_bucket.month+1, day=1)
                    
                    possible_buckets.extend([prev_bucket, next_bucket])
                    
                    # Check each possible bucket for activity within grace period
                    for check_bucket in possible_buckets:
                        if check_bucket in activity_by_bucket:
                            # Check each timestamp in this bucket
                            for timestamp in activity_by_bucket[check_bucket]:
                                if grace_start <= timestamp <= grace_end:
                                    is_active = True
                                    break
                        if is_active:
                            break
                    
                    # Add entry with correct active status
                    timeseries.append({
                        'timestamp': current_bucket.isoformat(),
                        'memory_total': float(node_memory_total/1024),  # Convert to GB
                        'memory_used': 0.0,
                        'is_active': is_active
                    })
                
                # Increment the bucket based on the period
                if period == 'hour':
                    current_bucket += timedelta(hours=1)
                elif period == 'day':
                    current_bucket += timedelta(days=1)
                elif period == 'week':
                    current_bucket += timedelta(weeks=1)
                elif period == 'month':
                    # Properly increment to next month
                    if current_bucket.month == 12:
                        current_bucket = current_bucket.replace(year=current_bucket.year+1, month=1, day=1)
                    else:
                        current_bucket = current_bucket.replace(month=current_bucket.month+1, day=1)
            
            # Sort the combined timeseries by timestamp
            timeseries.sort(key=lambda x: x['timestamp'])
        
        nodes_timeseries.append({
            f'node_{node.hostname}': timeseries
        })
    
    # Calculate summary statistics
    total_gpus = GPU.objects.all().distinct().count()
    total_nodes = nodes.count()
    total_capacity = memory_total
    
    # Get time range from actual data
    time_range = usage_data.aggregate(
        start=Min('time'),
        end=Max('time')
    )
    
    summary = {
        'total_capacity_gb': float(total_capacity / 1024),
        'total_gpus': total_gpus,
        'total_nodes': total_nodes,
        'time_range': {
            'start': time_range['start'].isoformat() if time_range['start'] else None,
            'end': time_range['end'].isoformat() if time_range['end'] else None
        }
    }
    
    return {
        'nodes_timeseries': nodes_timeseries,
        'summary': summary
    }