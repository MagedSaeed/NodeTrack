# Use Python 3.13 alpine image as base
FROM python:3.13-alpine

# Set working directory in container
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements_master.txt .

# Install dependencies and gunicorn
RUN pip install --no-cache-dir -r requirements_master.txt gunicorn

# Copy backend code
COPY master/backend ./backend

# Copy .env file to /app
COPY .env /app/.env

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port 5000
EXPOSE 5000

# Create staticfiles directory
RUN mkdir -p /app/backend/nodetrack_backend/static

# Set the working directory to where the Django project is located
WORKDIR /app/backend

# Make entrypoint script executable
RUN chmod +x /app/backend/docker-entrypoint.sh

# Make entrypoint script executable (already seems to be executable)
RUN chmod +x /app/backend/docker-entrypoint.sh

# Command to run the entrypoint script with bash
CMD ["/bin/sh", "/app/backend/docker-entrypoint.sh"]