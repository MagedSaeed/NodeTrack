# core/models.py
from django.db import models

class Node(models.Model):
    ip_address = models.GenericIPAddressField()
    hostname = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    added_on = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Node"
        verbose_name_plural = "Nodes"
        ordering = ['ip_address']
    
    def __str__(self):
        return self.hostname