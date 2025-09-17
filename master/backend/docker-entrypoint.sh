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
exec gunicorn \
  --workers=4 \
  --threads=4 \
  --worker-class=gthread \
  --worker-connections=100 \
  --max-requests=25 \
  --max-requests-jitter=50 \
  --timeout=300 \
  --keep-alive=5 \
  --preload \
  --bind=0.0.0.0:5000 \
  --access-logfile=- \
  --error-logfile=- \
  --log-level=info \
  nodetrack_backend.wsgi:application