from django.db.models import Sum, Avg, Max, Min, Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from datetime import datetime, timedelta
from ipware.ip import get_client_ip
from django.utils import timezone
from collections import defaultdict
from django.db.models.functions import TruncHour, TruncWeek, TruncMonth, TruncDay
from django.http import Http404
from core.models import Node
from core.permissions import HasAPIToken
from core.utils import get_primary_ip
from cpu_monitor.models import CPUUsage
from cpu_monitor.serializers import CPUUsageSubmitSerializer

@api_view(['POST'])
def submit_cpu_data(request):
    """Handle CPU usage data submission"""
    bulk_data = request.data
    client_ip, is_routable = get_client_ip(request)
    if not client_ip:
        return Response({
            'status': 'error',
            'message': 'IP address not found in request'
        })

    # Validate IP and get primary IP mapping
    primary_ip = get_primary_ip(client_ip)
    if not primary_ip:
        raise Http404("IP address is Not found/Not trusted")

    created_count = 0

    for entry in bulk_data:
        serializer = CPUUsageSubmitSerializer(data=entry)
        if serializer.is_valid():
            data = serializer.validated_data

            # Get or create node using primary IP
            node, _ = Node.objects.get_or_create(
                ip_address=primary_ip,
                defaults={'hostname': data['hostname']},
            )

            # Create usage record - ensure timestamp is timezone aware
            timestamp = data['timestamp']
            if timezone.is_naive(timestamp):
                timestamp = timezone.make_aware(timestamp)

            CPUUsage.objects.create(
                node=node,
                username=data['username'],
                usage_percent=data['cpu_usage_percent'],
                cores=data['cpu_cores'],
                frequency_mhz=data.get('cpu_frequency_mhz'),
                time=timestamp
            )
            created_count += 1

    return Response({
        'status': 'success',
        'message': f'Created {created_count} CPU usage records'
    })

@api_view(['GET'])
@permission_classes([HasAPIToken])
def generate_cpu_report(request):
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
        time_series_data = get_cpu_time_series_data(period, start_time, end_time)

        # Get per-user statistics
        per_user = {}
        user_stats = CPUUsage.timescale.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values('username').annotate(
            avg_usage=Avg('usage_percent'),
            max_usage=Max('usage_percent'),
            nodes_used=Count('node', distinct=True)
        )

        for stat in user_stats:
            per_user[stat['username']] = {
                'avg_usage': float(stat['avg_usage']) if stat['avg_usage'] else 0.0,
                'max_usage': float(stat['max_usage']) if stat['max_usage'] else 0.0,
                'nodes_used': stat['nodes_used']
            }

        # Get per-node statistics
        per_node = {}
        node_stats = CPUUsage.timescale.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values('node__hostname').annotate(
            avg_usage=Avg('usage_percent'),
            max_usage=Max('usage_percent'),
            min_usage=Min('usage_percent'),
            total_cores=Max('cores'),
            max_users=Count('username', distinct=True),
            avg_frequency=Avg('frequency_mhz')
        )

        for stat in node_stats:
            hostname = stat['node__hostname']
            per_node[hostname] = {
                'avg_usage': float(stat['avg_usage']) if stat['avg_usage'] else 0.0,
                'max_usage': float(stat['max_usage']) if stat['max_usage'] else 0.0,
                'min_usage': float(stat['min_usage']) if stat['min_usage'] else 0.0,
                'total_cores': stat['total_cores'],
                'max_users': stat['max_users'],
                'avg_frequency': float(stat['avg_frequency']) if stat['avg_frequency'] else 0.0
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

def get_cpu_time_series_data(period='hour', start_time=None, end_time=None):

    assert start_time and end_time, "Start and end time must be provided"

    trunc_function = {
        'hour': TruncHour,
        'day': TruncDay,
        'week': TruncWeek,
        'month': TruncMonth
    }

    # Fetch all nodes in a single query
    nodes = list(Node.objects.all().distinct())

    # Fetch all CPU usage data for all nodes in a single query
    all_node_data = (
        CPUUsage.timescale.filter(
            node__in=nodes,
            time__range=(start_time, end_time),
        )
        .values("node", "time")
        .annotate(avg_usage_percent=Avg("usage_percent"))
        .annotate(truncated_time=trunc_function[period]("time"))
        .order_by("node", "time")
    )

    # Group the data by node
    data_by_node = defaultdict(list)
    for entry in all_node_data:
        node_id = entry['node']
        data_by_node[node_id].append({
            'truncated_time': entry['truncated_time'],
            'avg_usage_percent': entry['avg_usage_percent']
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
        node_data = data_by_node.get(node.id, [])

        # Group by time bucket and calculate averages
        time_buckets = defaultdict(list)
        for entry in node_data:
            bucket_time = entry['truncated_time']
            time_buckets[bucket_time].append(entry['avg_usage_percent'])

        processed_data = {
            bucket_time: (sum(values) / len(values) if values else 0)
            for bucket_time, values in time_buckets.items()
        }

        # Generate complete time series with missing buckets filled in
        timeseries = []
        current_bucket = truncate_timestamp(start_time)
        end_truncated = truncate_timestamp(end_time)

        while current_bucket <= end_truncated:
            usage_percent = processed_data.get(current_bucket, 0.0)
            timeseries.append({
                'timestamp': current_bucket.isoformat(),
                'usage_percent': float(usage_percent or 0),
                'is_active': current_bucket in processed_data
            })
            current_bucket += time_increment

        timeseries.sort(key=lambda x: x['timestamp'])
        nodes_timeseries.append({
            f'node_{node.hostname}': timeseries
        })

    # Calculate summary statistics
    total_nodes = len(nodes)
    total_cores = CPUUsage.objects.aggregate(total=Sum('cores'))['total'] or 0
    avg_frequency = CPUUsage.objects.aggregate(avg=Avg('frequency_mhz'))['avg'] or 0

    summary = {
        'total_cores': total_cores,
        'total_nodes': total_nodes,
        'avg_frequency_mhz': float(avg_frequency),
        'time_range': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat()
        }
    }

    return {
        'nodes_timeseries': nodes_timeseries,
        'summary': summary
    }
