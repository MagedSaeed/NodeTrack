from django.db import models
from core.models import Node
from timescale.db.models.models import TimescaleModel
from timescale.db.models.managers import TimescaleManager
from timescale.db.models.fields import TimescaleDateTimeField

class CPUUsage(TimescaleModel):
    """Time series record of overall node CPU usage

    Inherits from TimescaleModel which automatically creates a hypertable
    with the 'time' field as the time dimension.
    """
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='cpu_usage_records')
    usage_percent = models.FloatField(help_text="Overall CPU usage percentage for the node")
    cores_logical = models.IntegerField(help_text="Number of logical CPU cores", default=0)
    cores_physical = models.IntegerField(help_text="Number of physical CPU cores", default=0)
    frequency_mhz = models.FloatField(null=True, blank=True, help_text="CPU frequency in MHz")

    # TimescaleModel already includes a 'time' field of type TimescaleDateTimeField
    # The interval parameter sets the chunk time interval for the hypertable
    time = TimescaleDateTimeField(interval="1 day")

    # Standard Django manager
    objects = models.Manager()
    # TimescaleDB-specific manager for advanced time-series queries
    timescale = TimescaleManager()

    class Meta:
        indexes = [
            models.Index(fields=['usage_percent']),
        ]
        verbose_name = "CPU Usage Record"
        verbose_name_plural = "CPU Usage Records"

    def __str__(self):
        return f"{self.node.hostname} - {self.time} - {self.usage_percent}%"
