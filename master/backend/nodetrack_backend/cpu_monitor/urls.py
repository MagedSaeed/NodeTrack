from django.urls import path
from . import views

app_name = 'cpu_monitor'

urlpatterns = [
    path('submit', views.submit_cpu_data, name='submit_cpu_data'),
    path('report', views.generate_cpu_report, name='generate_cpu_report'),
]