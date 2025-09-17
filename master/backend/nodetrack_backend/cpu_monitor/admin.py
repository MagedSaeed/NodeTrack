from django.contrib import admin
from .models import CPUUsage

@admin.register(CPUUsage)
class CPUUsageAdmin(admin.ModelAdmin):
    list_display = ('node', 'username', 'usage_percent_display', 'cores', 'frequency_ghz_display', 'time')
    list_filter = ('username', 'node', 'time')
    search_fields = ('username', 'node__hostname')
    date_hierarchy = 'time'
    ordering = ('-time',)

    def usage_percent_display(self, obj):
        """Display usage percentage with % symbol"""
        return f"{obj.usage_percent:.2f}%"
    usage_percent_display.short_description = "CPU Usage"
    usage_percent_display.admin_order_field = 'usage_percent'

    def frequency_ghz_display(self, obj):
        """Display frequency in GHz for better readability"""
        if obj.frequency_mhz:
            return f"{obj.frequency_mhz / 1000:.2f} GHz"
        return "N/A"
    frequency_ghz_display.short_description = "Frequency"
    frequency_ghz_display.admin_order_field = 'frequency_mhz'
