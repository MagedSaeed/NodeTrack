FROM node:18-alpine

# Create the full directory structure
WORKDIR /app/master/frontend/dashboard

# Copy .env file to /app
COPY .env /app/.env

# Copy package files
COPY master/frontend/dashboard/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY master/frontend/dashboard ./

# Build the application
RUN npm run build

# Install serve package globally
RUN npm install -g serve

# Expose port 3000
EXPOSE 3000

# Start serve
CMD ["serve", "-s", "dist", "-l", "3000"]