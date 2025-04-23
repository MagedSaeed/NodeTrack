# core/admin.py
from django.contrib import admin
from core.models import Node

@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('hostname', 'ip_address', 'is_active', 'added_on', 'last_updated')
    search_fields = ('hostname', 'ip_address', 'description')
    readonly_fields = ('added_on', 'last_updated')
    fieldsets = (
        (None, {
            'fields': ('hostname', 'ip_address', 'description', 'is_active')
        }),
        ('Additional Information', {
            'fields': ('added_on', 'last_updated'),
            'classes': ('collapse',)
        }),
    )