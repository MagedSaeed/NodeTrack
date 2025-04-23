from rest_framework import serializers
from gpu_monitor.models import GPU

class GPUUsageSubmitSerializer(serializers.Serializer):
    gpu_id = serializers.CharField()
    gpu_name = serializers.CharField()
    hostname = serializers.CharField()
    timestamp = serializers.DateTimeField()
    memory_used = serializers.FloatField()
    memory_total = serializers.FloatField()
    ip_address = serializers.IPAddressField()
    username = serializers.CharField(required=False, allow_null=True)
    

class GPUSerializer(serializers.ModelSerializer):
    """Serializer for GPU model"""
    class Meta:
        model = GPU
        fields = ['id', 'gpu_id', 'memory_total']

class NodeTimeSeriesSerializer(serializers.Serializer):
    """Serializer for time series data points"""
    timestamp = serializers.DateTimeField()
    memory_used = serializers.FloatField()
    memory_total = serializers.FloatField()

class GPUReportSummarySerializer(serializers.Serializer):
    """Serializer for GPU report summary"""
    total_capacity_gb = serializers.FloatField()
    total_gpus = serializers.IntegerField()
    total_nodes = serializers.IntegerField()
    time_range = serializers.DictField()

class GPUReportSerializer(serializers.Serializer):
    """Serializer for the complete GPU report"""
    date_range = serializers.DictField()
    time_series = serializers.DictField()
    per_user = serializers.DictField()
    per_node = serializers.DictField()
    summary = GPUReportSummarySerializer()