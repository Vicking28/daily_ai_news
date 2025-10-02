# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create output directory
RUN mkdir -p output

# Expose port (optional, for future web interface)
EXPOSE 3000

# Start the daily scheduler
CMD ["npm", "run", "start:daily"]
