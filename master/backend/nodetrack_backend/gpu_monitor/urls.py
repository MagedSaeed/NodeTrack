from django.urls import path
from . import views

app_name = 'gpu_monitor'

urlpatterns = [
    path('submit', views.submit_gpu_data, name='submit_gpu_data'),
    path('report', views.generate_gpu_report, name='generate_gpu_report'),
]