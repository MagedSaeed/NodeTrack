from rest_framework import serializers
from core.models import Node
from gpu_monitor.models import GPU, GPUUsage

class GPUUsageSubmitSerializer(serializers.Serializer):
    hostname = serializers.CharField()
    gpu_id = serializers.CharField()
    username = serializers.CharField()
    memory_used = serializers.IntegerField()
    memory_total = serializers.IntegerField()
    timestamp = serializers.DateTimeField()
    gpu_name = serializers.CharField()
    ip_address = serializers.IPAddressField()
    

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