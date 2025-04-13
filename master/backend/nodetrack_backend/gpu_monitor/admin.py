from django.contrib import admin
from .models import GPU, GPUUsage

@admin.register(GPU)
class GPUAdmin(admin.ModelAdmin):
    list_display = ('node', 'gpu_id', 'memory_total_gb')
    list_filter = ('node',)
    search_fields = ('node__hostname', 'gpu_id')
    
    def memory_total_gb(self, obj):
        """Display memory in GB for better readability"""
        return f"{obj.memory_total / 1024:.2f} GB"
    memory_total_gb.short_description = "Total Memory"

@admin.register(GPUUsage)
class GPUUsageAdmin(admin.ModelAdmin):
    list_display = ('gpu', 'username', 'memory_used_gb', 'time')
    list_filter = ('username', 'gpu__node', 'time')
    search_fields = ('username', 'gpu__node__hostname', 'gpu__gpu_id')
    date_hierarchy = 'time'
    
    def memory_used_gb(self, obj):
        """Display memory in GB for better readability"""
        return f"{obj.memory_used / 1024:.2f} GB"
    memory_used_gb.short_description = "Memory Used"