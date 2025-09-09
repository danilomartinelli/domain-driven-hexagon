# Docker Commands and Operations Guide

## Overview

This document provides comprehensive guidance for using Docker with the Domain-Driven Hexagon project. The setup has been optimized for both development and production environments.

## Quick Start

For new developers, use the automated quick-start:

```bash
make quick-start
```

This command will:

1. Check system requirements
2. Install dependencies
3. Generate SSL certificates
4. Build Docker images
5. Start development environment
6. Run database migrations

## Manual Setup Commands

### Initial Setup

```bash
# Generate SSL certificates for HTTPS
make ssl

# Build all images
make build-all

# Start development environment
make dev

# Run database migrations
make db-migrate-dev
```

### Development Commands

```bash
# Start development environment
make dev

# Follow development logs
make dev-logs

# Stop development environment
make dev-stop

# Restart development environment
make dev-restart

# Access application shell
make shell
```

### Production Commands

```bash
# Start production environment
make prod

# Start production with Nginx (HTTPS)
make prod-with-nginx

# Follow production logs
make prod-logs

# Stop production environment
make prod-stop
```

### Database Commands

```bash
# Run migrations (development)
make db-migrate-dev

# Run migrations (production)
make db-migrate

# Access database console (development)
make db-console-dev

# Access database console (production)
make db-console

# Run database seeds
make db-seed
```

### Testing Commands

```bash
# Run tests in container
make test

# Run tests with coverage
make test-cov

# Run end-to-end tests
make test-e2e

# Run linting
make lint
```

### Monitoring Commands

```bash
# Show container status
make status

# Monitor containers with metrics
make monitor

# Check health status
make health

# Show logs (interactive environment selection)
make logs
```

### Build Commands

```bash
# Build production image
make build

# Build development image
make build-dev

# Build optimized image with script
make build-optimized

# Build all images
make build-all
```

### Cleanup Commands

```bash
# Stop and remove containers
make clean

# Remove containers and volumes (⚠️ DATA LOSS!)
make clean-volumes

# Remove built images
make clean-images

# Full cleanup
make clean-all

# Clean and rebuild
make rebuild

# Full reset (containers, volumes, rebuild)
make reset
```

### Information Commands

```bash
# Show environment information
make env

# Show application URLs
make urls

# Show all available commands
make help
```

## Service URLs

### Development Environment

- **Application**: <http://localhost:3000>
- **PgAdmin**: <http://localhost:5050> (<admin@ddh.local> / admin)
- **Database**: localhost:5432 (user / password / ddh)
- **Redis**: localhost:6379

### Production Environment

- **Application**: <http://localhost:3000>
- **With Nginx**: <http://localhost:80> | <https://localhost:443>
- **Database**: localhost:5432 (internal access only)
- **Redis**: localhost:6379 (internal access only)

## Environment Variables

You can customize the setup using these variables:

```bash
# Change image version
make build VERSION=v1.2.3

# Change build environment
make build-optimized ENVIRONMENT=development

# Custom app name
make build APP_NAME=myapp/ddh
```

## SSL Certificates

For HTTPS support in production:

1. **Development**: Use `make ssl` to generate self-signed certificates
2. **Production**: Replace certificates in `ssl/` directory with CA-signed certificates

## File Structure

```
docker/
├── compose.dev.yml          # Development environment
├── compose.prod.yml         # Production environment
├── Dockerfile.dev           # Development image
├── Dockerfile.prod          # Production image
├── nginx/
│   ├── nginx.conf          # Main nginx configuration
│   └── conf.d/             # Server configurations
└── scripts/
    ├── docker-build.sh     # Optimized build script
    ├── container-monitor.sh # Container monitoring
    ├── generate-ssl.sh     # SSL certificate generation
    └── quick-start.sh      # Automated setup script
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Stop other services using ports 3000, 5432, 5050, 6379
2. **Permission issues**: Ensure Docker has proper permissions
3. **SSL issues**: Regenerate certificates with `make ssl`
4. **Database connection**: Wait for PostgreSQL to be ready (health checks included)

### Debug Commands

```bash
# Check container logs
make dev-logs

# Access application shell
make shell

# Check container health
make health

# Show detailed status
make status
```

### Performance

The setup includes optimizations:

- Multi-stage builds for minimal image size
- Health checks for reliability
- Resource limits for stability
- Nginx reverse proxy for production
- Redis caching layer
- PostgreSQL performance tuning

## Security Features

- Non-root user containers
- Read-only filesystems where possible
- Security headers in Nginx
- Isolated networks
- SSL/TLS encryption
- Minimal base images (Alpine Linux)

## Monitoring

Use the monitoring commands to track:

- Container health and status
- Resource usage (CPU, memory)
- Network connections
- Log aggregation
- Performance metrics

For detailed monitoring, use:

```bash
make monitor
```

This provides real-time metrics and alerts for container issues.
