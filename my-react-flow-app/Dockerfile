

# Use Node.js 20 (required by react-router 7.8.0)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean install without using cache to avoid corruption
# Remove cache directory first, then install with --cache=/tmp/empty-cache
RUN rm -rf /root/.npm && \
    npm install --cache=/tmp/empty-cache --prefer-offline --no-audit

# Copy source code
COPY . .

RUN mkdir -p /app/static/uploads

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]