FROM node:23-alpine

# Update and install required packages
RUN apk update && apk add bash tzdata

# Set the timezone to Dammam, Saudi Arabia (Asia/Riyadh is the timezone for KSA)
RUN cp /usr/share/zoneinfo/Asia/Riyadh /etc/localtime && \
    echo "Asia/Riyadh" > /etc/timezone

# Set bash as the default shell for the container
SHELL ["/bin/bash", "-c"]

# Create the full directory structure
WORKDIR /app/master/frontend/dashboard-app

# Copy .env file to /app
COPY .env /app/.env

# Copy package files
COPY master/frontend/dashboard-app/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY master/frontend/dashboard-app ./

# Build the application
RUN npm run build

# Install serve package globally
RUN npm install -g serve

# Expose port 3000
EXPOSE 3000

# Start serve
CMD ["serve", "-s", "dist", "-l", "3000"]