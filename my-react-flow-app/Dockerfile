
# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean cache and no symlinks
RUN npm cache clean --force && \
    npm install --no-optional --legacy-peer-deps

# Copy source code
COPY . .

RUN mkdir -p /app/static/uploads

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]