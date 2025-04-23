from django.db import models
from core.models import Node
from timescale.db.models.models import TimescaleModel
from timescale.db.models.managers import TimescaleManager
from timescale.db.models.fields import TimescaleDateTimeField

class GPU(models.Model):
    """GPU device associated with a node"""
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='gpus')
    gpu_id = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    memory_total = models.FloatField(help_text="Total memory in MB")
    
    class Meta:
        unique_together = ('node', 'gpu_id')
        verbose_name = "GPU"
        verbose_name_plural = "GPUs"
    
    def __str__(self):
        return f"{self.node.hostname}-{self.gpu_id}"

class GPUUsage(TimescaleModel):
    """Time series record of GPU memory usage
    
    Inherits from TimescaleModel which automatically creates a hypertable
    with the 'time' field as the time dimension.
    """
    gpu = models.ForeignKey(GPU, on_delete=models.CASCADE, related_name='usage_records')
    username = models.CharField(max_length=100)
    memory_used = models.FloatField(help_text="Memory used in MB") # set this to float
    
    # This replaces the previous 'timestamp' field
    # TimescaleModel already includes a 'time' field of type TimescaleDateTimeField
    # The interval parameter sets the chunk time interval for the hypertable
    time = TimescaleDateTimeField(interval="1 day")
    
    # Standard Django manager
    objects = models.Manager()
    # TimescaleDB-specific manager for advanced time-series queries
    timescale = TimescaleManager()
    
    class Meta:
        indexes = [
            models.Index(fields=['username']),
        ]
        verbose_name = "GPU Usage Record"
        verbose_name_plural = "GPU Usage Records"
    
    def __str__(self):
        return f"{self.gpu} - {self.time} - {self.memory_used}MB"