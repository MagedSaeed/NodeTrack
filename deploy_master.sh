#!/bin/bash

# Exit on any error
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}


# add this to setup db connection
# docker run -d \
#   --name timescaledb \
#   -p 5432:5432 \
#   -e POSTGRES_PASSWORD=aaa123 \
#   -e POSTGRES_USER=postgres \
#   -e POSTGRES_DB=nodetrack \
#   -v /home/majed.alshaibani/Projects/NodeTrack/data/timescale_db:/var/lib/postgresql/data \
#   timescale/timescaledb:latest-pg15

# Function to cleanup containers and images
cleanup_containers() {
    local image_name=$1
    
    # Get all container IDs (running and stopped) for the image
    local containers=$(docker ps -a -q --filter ancestor=$image_name 2>/dev/null || true)
    
    if [ ! -z "$containers" ]; then
        log "Stopping containers for $image_name..."
        docker stop $containers 2>/dev/null || true
        
        log "Removing stopped containers for $image_name..."
        docker rm $containers 2>/dev/null || true
    else
        log "No containers found for $image_name"
    fi
}

# Function to safely remove dangling images
cleanup_dangling() {
    log "Cleaning up dangling images..."
    docker image prune -f
}

# Main deployment script
main() {
    # Pull latest changes
    log "Pulling latest changes..."
    if ! git pull; then
        log "Git pull failed. Aborting deployment."
        exit 1
    fi

    # Cleanup existing containers
    log "Starting cleanup..."
    cleanup_containers "nodetrack-master-backend"
    cleanup_containers "nodetrack-master-frontend"


    # Build docker images
    log "Building backend image..."
    docker build -f master/backend/Dockerfile -t nodetrack-master-backend .
    
    log "Building frontend image..."
    docker build -f master/frontend/Dockerfile -t nodetrack-master-frontend .

    # Create data directory if it doesn't exist
    log "Setting up data directory..."
    mkdir -p data

    # Run new containers
    log "Starting backend container..."
    docker run -d \
        -p 5000:5000 \
        -v "$(pwd)/data:/app/backend/data" \
        --name nodetrack-backend \
        nodetrack-master-backend:latest

    log "Starting frontend container..."
    docker run -d \
        -p 3000:3000/tcp \
        --name nodetrack-frontend \
        nodetrack-master-frontend:latest


    # Cleanup dangling images
    cleanup_dangling

    log "Deployment completed successfully!"
}

# Run main function
main