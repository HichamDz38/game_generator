
# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Use npm install instead of npm ci for better ARM compatibility
RUN npm install --legacy-peer-deps || npm install --force

# Copy source code
COPY . .

RUN mkdir -p /app/static/uploads

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]