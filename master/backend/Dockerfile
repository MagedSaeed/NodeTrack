# Use Python 3.9 slim image as base
FROM python:3.9-slim

# Set working directory in container
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements_server.txt .

# Install dependencies and gunicorn
RUN pip install --no-cache-dir -r requirements_server.txt gunicorn

# Copy backend code
COPY master/backend ./backend

# Copy .env file to /app
COPY .env /app/.env

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port 5000 (matching your server.py configuration)
EXPOSE 5000

# Set the working directory to where server.py is located
WORKDIR /app/backend

# Command to run the server using Gunicorn
# -w 4: number of worker processes
# -b 0.0.0.0:5000: bind address and port
# --access-logfile -: log to stdout
# server:app - assumes your Flask instance is named 'app' in server.py
CMD ["gunicorn", "--workers=4", "--bind=0.0.0.0:5000", "--access-logfile=-", "server:app"]