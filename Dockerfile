# Multi-stage Dockerfile for NestJS Domain-Driven Hexagon
# Optimized for both development and production environments

# Base stage with common dependencies
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Development stage
FROM base AS development

# Set development environment
ENV NODE_ENV=development \
    LOG_LEVEL=debug

# Install git for development tools
RUN apk add --no-cache git

# Copy package files
COPY --chown=nestjs:nodejs package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci --include=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY --chown=nestjs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Expose port and debug port
EXPOSE 3000 9229

# Command for development with debugging
CMD ["dumb-init", "npm", "run", "start:debug"]

# Build stage for production
FROM base AS build

# Copy package files
COPY --chown=nestjs:nodejs package*.json ./

# Install all dependencies for building
RUN npm ci --include=dev --no-audit --no-fund

# Copy source code
COPY --chown=nestjs:nodejs . .

# Build the application
RUN npm run build

# Run tests during build
RUN npm run test

# Production dependencies stage
FROM base AS prod-deps

# Copy package files
COPY --chown=nestjs:nodejs package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Production stage
FROM base AS production

# Set production environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024" \
    LOG_LEVEL=info

# Copy production dependencies
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Copy database migrations and configurations
COPY --from=build --chown=nestjs:nodejs /app/database ./database

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

# Expose application port
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]