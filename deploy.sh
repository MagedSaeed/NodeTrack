# pull latest changes
git pull

# first stop running images containers
docker stop $(docker ps -q --filter ancestor=nodetrack-master-backend)
docker stop $(docker ps -q --filter ancestor=nodetrack-master-frontend)

# build docker images
#--- backend
docker build -f master/backend/Dockerfile -t nodetrack-master-backend .
#---
docker build -f master/frontend/Dockerfile -t nodetrack-master-frontend .
#---

# run images
#--- create a data dir
mkdir -p data
#--- backend
docker run -d -p 5000:5000 -v ./data:/app/backend/data nodetrack-master-backend:latest
#--- frontend
docker run -d -p 3000:3000/tcp nodetrack-master-frontend:latest
