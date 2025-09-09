#!/bin/bash
# Optimized Docker build script for Domain-Driven Hexagon

set -euo pipefail

# Configuration
IMAGE_NAME="${1:-ddh/app}"
VERSION="${2:-latest}"
ENVIRONMENT="${3:-production}"
PLATFORM="${4:-linux/amd64,linux/arm64}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx is not available"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Enable BuildKit
enable_buildkit() {
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain
    log_info "BuildKit enabled"
}

# Build function
build_image() {
    local dockerfile="Dockerfile.${ENVIRONMENT}"
    local build_args=""
    
    log_info "Building ${IMAGE_NAME}:${VERSION} for ${ENVIRONMENT}..."
    
    # Set build arguments based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        build_args="--build-arg NODE_ENV=production"
    else
        build_args="--build-arg NODE_ENV=development"
    fi
    
    # Build command with optimizations
    docker buildx build \
        --platform "${PLATFORM}" \
        --file "${dockerfile}" \
        --tag "${IMAGE_NAME}:${VERSION}" \
        --tag "${IMAGE_NAME}:latest" \
        --cache-from "type=registry,ref=${IMAGE_NAME}:buildcache" \
        --cache-to "type=registry,ref=${IMAGE_NAME}:buildcache,mode=max" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        ${build_args} \
        --progress=plain \
        --push \
        .
    
    log_success "Build completed successfully"
}

# Security scan
security_scan() {
    log_info "Running security scan with Trivy..."
    
    if command -v trivy &> /dev/null; then
        trivy image "${IMAGE_NAME}:${VERSION}" \
            --severity HIGH,CRITICAL \
            --no-progress \
            --format table
        
        # Generate JSON report
        trivy image "${IMAGE_NAME}:${VERSION}" \
            --severity HIGH,CRITICAL \
            --no-progress \
            --format json \
            --output trivy-report.json
        
        log_success "Security scan completed"
    else
        log_warning "Trivy not found, skipping security scan"
    fi
}

# Image analysis
analyze_image() {
    log_info "Analyzing image size and layers..."
    
    # Show image information
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # Analyze with dive if available
    if command -v dive &> /dev/null; then
        log_info "Running dive analysis..."
        dive "${IMAGE_NAME}:${VERSION}" --ci
    else
        log_warning "Dive not found, skipping layer analysis"
    fi
}

# Performance test
performance_test() {
    log_info "Running basic performance test..."
    
    # Start container for testing
    container_id=$(docker run -d --name "test-${IMAGE_NAME##*/}" "${IMAGE_NAME}:${VERSION}")
    
    # Wait for startup
    sleep 30
    
    # Basic health check
    if docker exec "$container_id" node healthcheck.js; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
    fi
    
    # Cleanup
    docker stop "$container_id"
    docker rm "$container_id"
}

# Generate build report
generate_report() {
    local report_file="build-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Docker Build Report

## Build Information
- **Image**: ${IMAGE_NAME}:${VERSION}
- **Environment**: ${ENVIRONMENT}
- **Platform**: ${PLATFORM}
- **Build Date**: $(date)
- **Git Commit**: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

## Image Analysis
$(docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}")

## Security Scan
$(if [[ -f trivy-report.json ]]; then echo "Security report: trivy-report.json"; else echo "No security scan performed"; fi)

## Optimizations Applied
- Multi-stage build for minimal image size
- Security hardening with non-root user
- Layer caching for faster builds
- Health checks for reliability
- Resource limits configured
- Nginx reverse proxy for production

## Next Steps
1. Deploy to staging environment
2. Run integration tests
3. Monitor performance metrics
4. Update Kubernetes manifests if needed
EOF

    log_success "Build report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting Docker build process..."
    
    check_dependencies
    enable_buildkit
    build_image
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        security_scan
        analyze_image
        performance_test
    fi
    
    generate_report
    
    log_success "Docker build process completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Docker Build Script for Domain-Driven Hexagon

Usage: $0 [IMAGE_NAME] [VERSION] [ENVIRONMENT] [PLATFORM]

Arguments:
  IMAGE_NAME   Docker image name (default: ddh/app)
  VERSION      Image version tag (default: latest)
  ENVIRONMENT  Build environment (default: production)
  PLATFORM     Target platforms (default: linux/amd64,linux/arm64)

Examples:
  $0                                    # Build with defaults
  $0 myregistry/ddh/app v1.2.3         # Custom name and version
  $0 ddh/app latest development         # Development build
  $0 ddh/app v1.0.0 production linux/amd64  # Single platform

Environments:
  - production: Optimized for production deployment
  - development: Includes development tools and debugging

EOF
}

# Handle arguments
if [[ $# -gt 0 && ("$1" == "-h" || "$1" == "--help") ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"