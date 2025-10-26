# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production
ENV REDIS_HOST=host.docker.internal
ENV REDIS_PORT=6379

# Start the server
CMD ["npm", "run", "server:auto"]
