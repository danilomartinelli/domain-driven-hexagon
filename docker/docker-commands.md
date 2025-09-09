# Docker Commands for Domain-Driven Hexagon

This guide provides the correct commands to use with the Docker configuration in the `docker/` folder.

## Quick Start Commands

### Production Environment

```bash
# From project root
cd docker
docker-compose -f compose.prod.yml up -d

# Or from anywhere in the project
docker-compose -f docker/compose.prod.yml up -d
```

### Development Environment

```bash
# From project root
cd docker
docker-compose -f compose.dev.yml up -d

# Or from anywhere in the project  
docker-compose -f docker/compose.dev.yml up -d
```

## Build Commands

### Building Images

```bash
# From docker directory
cd docker
docker build -f Dockerfile.prod -t ddh/app:latest ..
docker build -f Dockerfile.dev -t ddh/app:dev ..

# From project root
docker build -f docker/Dockerfile.prod -t ddh/app:latest .
docker build -f docker/Dockerfile.dev -t ddh/app:dev .
```

### Using Build Script

```bash
# From docker directory
cd docker/scripts
./docker-build.sh ddh/app latest production

# Make script executable if needed
chmod +x docker-build.sh
```

## Environment-Specific Commands

### Production with Nginx

```bash
cd docker
docker-compose -f compose.prod.yml --profile production up -d
```

### Development with PgAdmin

```bash
cd docker  
docker-compose -f compose.dev.yml up -d
```

## Monitoring Commands

### Container Status

```bash
cd docker
docker-compose -f compose.prod.yml ps
docker-compose -f compose.prod.yml logs -f app
```

### Using Monitor Script

```bash
cd docker/scripts
./container-monitor.sh ../compose.prod.yml status
./container-monitor.sh ../compose.prod.yml monitor
```

## Database Commands

### Migrations (from project root)

```bash
# Run migrations in container
docker-compose -f docker/compose.prod.yml exec app npm run migration:up

# Access database directly
docker-compose -f docker/compose.prod.yml exec postgres psql -U user -d ddh
```

## Cleanup Commands

```bash
# Stop all services
cd docker
docker-compose -f compose.prod.yml down

# Remove volumes (careful!)
docker-compose -f compose.prod.yml down -v

# Clean up unused Docker resources
docker system prune -f
```

## File Structure Reference

```
docker/
├── compose.prod.yml      # Production compose file
├── compose.dev.yml       # Development compose file
├── Dockerfile.prod       # Production Dockerfile
├── Dockerfile.dev        # Development Dockerfile
├── nginx/
│   └── nginx.conf       # Nginx configuration
└── scripts/
    ├── docker-build.sh   # Build automation
    └── container-monitor.sh # Monitoring script
```

## Path Context Notes

- **Build context**: Always `..` (parent directory) when running from docker/
- **Volume mounts**: Use `../` prefix for project files when in docker/
- **Scripts**: Run from `docker/scripts/` directory or adjust paths accordingly

## Environment Variables

Create a `.env` file in the docker directory:

```bash
# docker/.env
POSTGRES_PASSWORD=secure_password
PGADMIN_PASSWORD=admin_password
APP_IMAGE=ddh/app
VERSION=latest
```

## Common Issues and Solutions

1. **Build context errors**: Ensure you're using `..` as build context from docker/
2. **Volume mount issues**: Use relative paths `../` when running from docker/
3. **Permission errors**: Check that scripts are executable with `chmod +x`
4. **Port conflicts**: Adjust ports in compose files if needed