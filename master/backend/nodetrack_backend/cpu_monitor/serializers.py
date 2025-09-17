from rest_framework import serializers

class CPUUsageSubmitSerializer(serializers.Serializer):
    hostname = serializers.CharField()
    timestamp = serializers.DateTimeField()
    ip_address = serializers.IPAddressField()
    cpu_usage_percent = serializers.FloatField()
    cpu_cores_logical = serializers.IntegerField()
    cpu_cores_physical = serializers.IntegerField()
    cpu_frequency_mhz = serializers.FloatField(required=False, allow_null=True)


class CPUReportSummarySerializer(serializers.Serializer):
    """Serializer for CPU report summary"""
    total_cores = serializers.IntegerField()
    total_nodes = serializers.IntegerField()
    avg_frequency_mhz = serializers.FloatField()
    time_range = serializers.DictField()


class CPUReportSerializer(serializers.Serializer):
    """Serializer for the complete CPU report"""
    date_range = serializers.DictField()
    time_series = serializers.DictField()
    per_user = serializers.DictField()
    per_node = serializers.DictField()
    summary = CPUReportSummarySerializer()