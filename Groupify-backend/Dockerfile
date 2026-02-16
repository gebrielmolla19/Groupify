# Groupify Backend - Production Dockerfile
# Build: docker build -t groupify-backend .
# Run: docker run -p 5001:5001 --env-file .env groupify-backend

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

# Expose port (matches default PORT in env)
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
