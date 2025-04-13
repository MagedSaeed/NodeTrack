from rest_framework.permissions import BasePermission
from django.conf import settings

class HasAPIToken(BasePermission):
    def has_permission(self, request, view):
        # Get token from query parameters
        request_token = request.query_params.get('token')
        
        # Check if token matches the one in settings
        return request_token and request_token == settings.API_TOKEN