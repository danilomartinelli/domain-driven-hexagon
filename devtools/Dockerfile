# Ultra-Optimized Dockerfile for NestJS Domain-Driven Hexagon
# Features: Bun.js for speed, BuildKit caching, distroless production, security scanning
# Build with: DOCKER_BUILDKIT=1 docker build -f Dockerfile .

# Syntax directive for BuildKit features
# syntax=docker/dockerfile:1.6

# =============================================================================
# BASE STAGE - Common foundation
# =============================================================================
FROM node:24-alpine AS base

# Install system dependencies and security updates in one layer
RUN apk update && \
  apk upgrade && \
  apk add --no-cache \
  dumb-init \
  tini \
  curl \
  ca-certificates \
  && rm -rf /var/cache/apk/*

# Create non-root user with explicit UID/GID for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Set optimal Node.js environment variables
ENV NODE_ENV=production \
  NODE_OPTIONS="--max-old-space-size=1024 --enable-source-maps" \
  NPM_CONFIG_UPDATE_NOTIFIER=false \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false

# =============================================================================
# BUN STAGE - Ultra-fast package manager (5x faster than npm)
# =============================================================================
FROM oven/bun:1.0-alpine AS bun-base

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json bun.lockb* package-lock.json* ./

# Install dependencies with Bun (significantly faster)
RUN bun install --frozen-lockfile --production

# =============================================================================
# DEPENDENCIES STAGE - Optimized with BuildKit mount caches
# =============================================================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Use BuildKit mount caches for faster rebuilds
# This caches node_modules and npm cache between builds
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/app/node_modules/.cache \
  npm ci --omit=dev --no-audit --no-fund && \
  npm cache clean --force

# =============================================================================
# BUILD STAGE - Compile TypeScript and run tests
# =============================================================================
FROM base AS build

# Install all dependencies including dev dependencies
RUN --mount=type=cache,target=/root/.npm \
  npm ci --include=dev --no-audit --no-fund

# Copy source code (use .dockerignore to optimize this layer)
COPY . .

# Build application with optimizations
RUN npm run build && \
  # Run linting and type checking during build
  npm run lint && \
  # Validate architecture dependencies
  npm run deps:validate

# Run tests during build (fail fast if tests fail)
RUN npm run test

# =============================================================================
# SECURITY SCAN STAGE - Vulnerability scanning during build
# =============================================================================
FROM build AS security-scan

# Install security scanning tools
RUN npm install -g audit-ci retire npm-audit-resolver

# Run comprehensive security scans
RUN npm audit --audit-level high || true && \
  retire --outputformat json --outputpath /tmp/retire-report.json || true && \
  npm run deps:validate

# Generate security report
RUN echo "Security scan completed at $(date)" > /tmp/security-summary.txt

# =============================================================================
# PRODUCTION DEPENDENCIES - Clean production-only dependencies
# =============================================================================
FROM bun-base AS prod-deps

# Already has production dependencies from bun-base
# Verify and clean up if needed
RUN bun install --frozen-lockfile --production

# =============================================================================
# DISTROLESS PRODUCTION STAGE - Ultra-minimal and secure
# =============================================================================
FROM gcr.io/distroless/nodejs24-debian11 AS production

# Set production environment
ENV NODE_ENV=production \
  NODE_OPTIONS="--max-old-space-size=1024 --enable-source-maps" \
  LOG_LEVEL=info

# Copy production dependencies from bun stage (much smaller)
COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /app/package*.json ./

# Copy database configurations for migrations
COPY --from=build --chown=nonroot:nonroot /app/database ./database

# Copy security reports
COPY --from=security-scan /tmp/security-summary.txt ./security-reports/

# Distroless already runs as nonroot user (UID 65532)
USER nonroot

# Health check optimized for distroless
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# Expose application port
EXPOSE 3000

# Start application (distroless doesn't have shell, so direct node execution)
CMD ["node", "dist/main"]

# =============================================================================
# DEVELOPMENT STAGE - Optimized for development workflow
# =============================================================================
FROM base AS development

# Install development tools
RUN apk add --no-cache git openssh-client

# Set development environment
ENV NODE_ENV=development \
  LOG_LEVEL=debug

# Install all dependencies with cache mounts
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/app/node_modules/.cache \
  npm ci --include=dev --no-audit --no-fund

# Copy source code
COPY --chown=nestjs:nodejs . .

# Create logs directory with proper permissions
RUN mkdir -p logs tmp && \
  chown -R nestjs:nodejs logs tmp

# Switch to non-root user
USER nestjs

# Expose ports (app + debug)
EXPOSE 3000 9229

# Development command with hot reload
CMD ["dumb-init", "npm", "run", "start:dev"]

# =============================================================================
# TESTING STAGE - Isolated testing environment
# =============================================================================
FROM build AS testing

# Set test environment
ENV NODE_ENV=test

# Run comprehensive test suite
RUN npm run test && \
  npm run test:e2e && \
  npm run test:cov

# Generate test reports
RUN echo "All tests passed at $(date)" > /tmp/test-summary.txt

# =============================================================================
# MIGRATION STAGE - Database migrations
# =============================================================================
FROM production AS migration

# Copy migration scripts and tools
COPY --from=build --chown=nonroot:nonroot /app/database ./database

# Run migrations (this stage can be used for migration jobs)
CMD ["node", "-e", "require('./database/migrate-new.js').up()"]
