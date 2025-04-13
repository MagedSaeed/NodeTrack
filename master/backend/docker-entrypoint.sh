#!/bin/bash
set -e

cd nodetrack_backend

# Wait for database to be ready (optional but recommended)
echo "Waiting for database to be ready..."
sleep 5

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Check if we have the env variable for superuser password
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  # Create superuser non-interactively
  python manage.py createsuperuser --noinput || echo "Superuser may already exist."
else
  echo "DJANGO_SUPERUSER_PASSWORD not set. Skipping superuser creation."
fi

# Start Gunicorn
echo "Starting Gunicorn server..."
exec gunicorn --workers=4 --bind=0.0.0.0:5000 --access-logfile=- nodetrack_backend.wsgi:application