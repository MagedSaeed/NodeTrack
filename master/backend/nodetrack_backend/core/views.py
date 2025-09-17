from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from core.models import Node
from core.permissions import HasAPIToken


@api_view(['GET'])
@permission_classes([HasAPIToken])
def get_overview_stats(request):
    """Get overview statistics: total nodes, users, and GPUs within date range"""
    try:
        # Import here to avoid circular imports
        from gpu_monitor.models import GPU, GPUUsage
        from cpu_monitor.models import CPUUsage
        from datetime import datetime, timedelta
        from django.utils import timezone

        # Get date range from query parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

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

        # Get total GPUs
        total_gpus = GPU.objects.count()

        # Get nodes that have usage data in the time range
        gpu_nodes = set(GPUUsage.objects.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values_list('gpu__node', flat=True).distinct())

        cpu_nodes = set(CPUUsage.objects.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values_list('node', flat=True).distinct())

        all_active_nodes = gpu_nodes.union(cpu_nodes)
        total_nodes = len(all_active_nodes)

        # Get all unique users within the time range
        gpu_users = set(GPUUsage.objects.filter(
            time__gte=start_time,
            time__lte=end_time
        ).values_list('username', flat=True).distinct())

        # CPU users commented out - no longer tracking per-user CPU data
        # cpu_users = set(CPUUsage.objects.filter(
        #     time__gte=start_time,
        #     time__lte=end_time
        # ).values_list('username', flat=True).distinct())

        # all_users = gpu_users.union(cpu_users)
        total_users = len(gpu_users)

        return Response({
            'total_nodes': total_nodes,
            'total_users': total_users,
            'total_gpus': total_gpus
        })

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
