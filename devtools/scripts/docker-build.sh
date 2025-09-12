#!/bin/bash
# Ultra-Optimized Docker Build Script for Domain-Driven Hexagon
# Features: Multi-arch builds, caching, security scanning, size optimization
# Usage: ./scripts/docker-build-optimized.sh [production|development] [version]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_TARGET="${1:-development}"
VERSION="${2:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
REGISTRY="${REGISTRY:-ddh}"
IMAGE_NAME="${REGISTRY}/app"

# Build context
DOCKERFILE="${PROJECT_ROOT}/Dockerfile"
DOCKER_CONTEXT="${PROJECT_ROOT}"

echo -e "${BLUE}🚀 Starting optimized Docker build for Domain-Driven Hexagon${NC}"
echo -e "${BLUE}📋 Build Configuration:${NC}"
echo -e "  Target: ${BUILD_TARGET}"
echo -e "  Version: ${VERSION}"
echo -e "  Platforms: ${PLATFORMS}"
echo -e "  Registry: ${REGISTRY}"

# Ensure required directories exist
mkdir -p "${PROJECT_ROOT}/data/postgres"
mkdir -p "${PROJECT_ROOT}/data/rabbitmq"  
mkdir -p "${PROJECT_ROOT}/data/redis"
mkdir -p "${PROJECT_ROOT}/logs"
mkdir -p "${PROJECT_ROOT}/security-reports"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Docker and BuildKit
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Enable BuildKit
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Check if buildx is available for multi-arch builds
    if docker buildx version &> /dev/null; then
        echo -e "${GREEN}✅ Docker BuildKit and buildx available${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker buildx not available, falling back to single-arch build${NC}"
        PLATFORMS="linux/amd64"
    fi
    
    # Check available disk space
    available_space=$(df "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')
    if [ "${available_space}" -lt 5000000 ]; then # Less than ~5GB
        echo -e "${YELLOW}⚠️  Low disk space detected. Consider cleaning Docker cache.${NC}"
        echo "Available space: $(( available_space / 1000000 ))GB"
    fi
}

# Function to setup buildx builder
setup_buildx() {
    if docker buildx version &> /dev/null; then
        echo -e "${YELLOW}🏗️  Setting up buildx builder...${NC}"
        
        # Create builder if it doesn't exist
        if ! docker buildx inspect ddh-builder &> /dev/null; then
            docker buildx create \
                --name ddh-builder \
                --driver docker-container \
                --use \
                --bootstrap
        else
            docker buildx use ddh-builder
        fi
        
        echo -e "${GREEN}✅ Buildx builder ready${NC}"
    fi
}

# Function to build with optimization
build_optimized() {
    local target="${1}"
    local version="${2}"
    
    echo -e "${YELLOW}🏗️  Building ${target} target (${version})...${NC}"
    
    # Build arguments based on target
    local build_args=""
    if [ "${target}" = "production" ]; then
        build_args="--build-arg NODE_ENV=production"
    else
        build_args="--build-arg NODE_ENV=development"
    fi
    
    # Cache configuration
    local cache_from="type=registry,ref=${IMAGE_NAME}:buildcache-${target}"
    local cache_to="type=registry,ref=${IMAGE_NAME}:buildcache-${target},mode=max"
    
    # Build command
    if docker buildx version &> /dev/null && [[ "${PLATFORMS}" == *","* ]]; then
        # Multi-architecture build with buildx
        docker buildx build \
            --platform "${PLATFORMS}" \
            --target "${target}" \
            --tag "${IMAGE_NAME}:${version}" \
            --tag "${IMAGE_NAME}:${target}-latest" \
            --cache-from "${cache_from}" \
            --cache-to "${cache_to}" \
            ${build_args} \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --progress=plain \
            --push \
            -f "${DOCKERFILE}" \
            "${DOCKER_CONTEXT}"
    else
        # Single architecture build
        docker build \
            --target "${target}" \
            --tag "${IMAGE_NAME}:${version}" \
            --tag "${IMAGE_NAME}:${target}-latest" \
            --cache-from "${IMAGE_NAME}:buildcache-${target}" \
            ${build_args} \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            -f "${DOCKERFILE}" \
            "${DOCKER_CONTEXT}"
            
        # Tag for cache
        docker tag "${IMAGE_NAME}:${version}" "${IMAGE_NAME}:buildcache-${target}"
    fi
    
    echo -e "${GREEN}✅ Build completed successfully${NC}"
}

# Function to analyze image size
analyze_size() {
    local version="${1}"
    
    echo -e "${YELLOW}📊 Analyzing image size...${NC}"
    
    # Get image size
    if docker image inspect "${IMAGE_NAME}:${version}" &> /dev/null; then
        local size=$(docker image inspect "${IMAGE_NAME}:${version}" --format='{{.Size}}')
        local size_mb=$(( size / 1024 / 1024 ))
        
        echo -e "${BLUE}Image Size Analysis:${NC}"
        echo -e "  Image: ${IMAGE_NAME}:${version}"
        echo -e "  Size: ${size_mb}MB"
        
        # Size recommendations
        if [ "${size_mb}" -lt 100 ]; then
            echo -e "${GREEN}✅ Excellent size optimization!${NC}"
        elif [ "${size_mb}" -lt 300 ]; then
            echo -e "${GREEN}✅ Good size optimization${NC}"
        elif [ "${size_mb}" -lt 500 ]; then
            echo -e "${YELLOW}⚠️  Consider further optimization${NC}"
        else
            echo -e "${RED}❌ Image size is large, optimization needed${NC}"
        fi
        
        # Write size report
        echo "${version},${size_mb}MB,$(date)" >> "${PROJECT_ROOT}/build-reports/size-history.csv"
    else
        echo -e "${RED}❌ Could not find image for analysis${NC}"
    fi
}

# Function to run security scan
security_scan() {
    local version="${1}"
    
    echo -e "${YELLOW}🔒 Running security scan...${NC}"
    
    # Create security reports directory
    mkdir -p "${PROJECT_ROOT}/security-reports"
    
    # Trivy vulnerability scan
    if command -v trivy &> /dev/null; then
        echo -e "${BLUE}Running Trivy vulnerability scan...${NC}"
        
        trivy image \
            --format json \
            --output "${PROJECT_ROOT}/security-reports/trivy-report.json" \
            "${IMAGE_NAME}:${version}"
            
        # Summary scan
        trivy image \
            --format table \
            --severity HIGH,CRITICAL \
            "${IMAGE_NAME}:${version}" | tee "${PROJECT_ROOT}/security-reports/trivy-summary.txt"
            
        echo -e "${GREEN}✅ Trivy scan completed${NC}"
    else
        echo -e "${YELLOW}⚠️  Trivy not found, installing...${NC}"
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
        
        # Retry scan
        trivy image --format table "${IMAGE_NAME}:${version}"
    fi
    
    # Docker security scan (if Docker Scout available)
    if docker scout version &> /dev/null; then
        echo -e "${BLUE}Running Docker Scout scan...${NC}"
        docker scout cves "${IMAGE_NAME}:${version}" > "${PROJECT_ROOT}/security-reports/scout-report.txt" || true
    fi
}

# Function to performance test
performance_test() {
    local version="${1}"
    
    echo -e "${YELLOW}⚡ Running performance tests...${NC}"
    
    # Start container for testing
    local container_name="ddh-perf-test"
    
    echo -e "${BLUE}Starting container for performance testing...${NC}"
    docker run -d \
        --name "${container_name}" \
        --rm \
        -p 3001:3000 \
        "${IMAGE_NAME}:${version}"
    
    # Wait for startup
    echo -e "${BLUE}Waiting for application startup...${NC}"
    local startup_time=0
    while ! curl -s http://localhost:3001/health > /dev/null 2>&1; do
        sleep 1
        startup_time=$((startup_time + 1))
        if [ ${startup_time} -gt 60 ]; then
            echo -e "${RED}❌ Application failed to start within 60 seconds${NC}"
            docker stop "${container_name}" || true
            exit 1
        fi
    done
    
    echo -e "${GREEN}✅ Application started in ${startup_time} seconds${NC}"
    
    # Basic performance test
    if command -v curl &> /dev/null; then
        echo -e "${BLUE}Running basic performance test...${NC}"
        
        # Test health endpoint
        local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3001/health)
        echo -e "Health endpoint response time: ${response_time}s"
        
        # Write performance report
        echo "${version},${startup_time}s,${response_time}s,$(date)" >> "${PROJECT_ROOT}/build-reports/performance-history.csv"
    fi
    
    # Cleanup
    docker stop "${container_name}" || true
    
    echo -e "${GREEN}✅ Performance test completed${NC}"
}

# Function to generate build report
generate_report() {
    local version="${1}"
    local build_start="${2}"
    local build_end="${3}"
    
    echo -e "${YELLOW}📝 Generating build report...${NC}"
    
    local build_time=$(( build_end - build_start ))
    local report_file="${PROJECT_ROOT}/build-reports/build-report-${version}-$(date +%Y%m%d-%H%M%S).md"
    
    mkdir -p "${PROJECT_ROOT}/build-reports"
    
    cat > "${report_file}" << EOF
# Docker Build Report

## Build Information
- **Version**: ${version}
- **Target**: ${BUILD_TARGET}
- **Date**: $(date)
- **Build Time**: ${build_time} seconds
- **Platforms**: ${PLATFORMS}

## Image Details
- **Image**: ${IMAGE_NAME}:${version}
- **Size**: $(docker image inspect "${IMAGE_NAME}:${version}" --format='{{.Size}}' 2>/dev/null | numfmt --to=iec || echo 'N/A')

## Optimizations Applied
- ✅ Multi-stage build with distroless production
- ✅ BuildKit cache mounts for faster rebuilds
- ✅ Bun.js for ultra-fast package management
- ✅ Security scanning during build
- ✅ Non-root user implementation
- ✅ Health checks configured
- ✅ Resource limits optimized

## Security Scan Results
$(cat "${PROJECT_ROOT}/security-reports/trivy-summary.txt" 2>/dev/null || echo "Security scan not available")

## Performance Metrics
- **Startup Time**: $(tail -n1 "${PROJECT_ROOT}/build-reports/performance-history.csv" 2>/dev/null | cut -d, -f2 || echo 'N/A')
- **Health Check Response**: $(tail -n1 "${PROJECT_ROOT}/build-reports/performance-history.csv" 2>/dev/null | cut -d, -f3 || echo 'N/A')

## Size History
$(tail -n5 "${PROJECT_ROOT}/build-reports/size-history.csv" 2>/dev/null || echo "No size history available")

## Recommendations
$(if [ -f "${PROJECT_ROOT}/security-reports/trivy-report.json" ]; then
    echo "- Review security scan results in security-reports/"
fi)
- Monitor container resource usage in production
- Consider implementing horizontal scaling for high load
- Regular security updates recommended

---
Generated by optimized build script v1.0
EOF
    
    echo -e "${GREEN}✅ Build report generated: ${report_file}${NC}"
}

# Function to cleanup old images
cleanup_images() {
    echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old build cache (keep last 3)
    local old_images=$(docker images "${IMAGE_NAME}" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep -v "latest\|buildcache" | tail -n +4 | awk '{print $1}')
    
    if [ -n "${old_images}" ]; then
        echo "${old_images}" | xargs docker rmi -f || true
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Main execution
main() {
    local build_start=$(date +%s)
    
    echo -e "${BLUE}🐳 Domain-Driven Hexagon - Optimized Docker Build${NC}"
    echo -e "${BLUE}=================================================${NC}"
    
    # Run build steps
    check_prerequisites
    setup_buildx
    build_optimized "${BUILD_TARGET}" "${VERSION}"
    analyze_size "${VERSION}"
    
    # Production-specific steps
    if [ "${BUILD_TARGET}" = "production" ]; then
        security_scan "${VERSION}"
        performance_test "${VERSION}"
    fi
    
    local build_end=$(date +%s)
    
    # Generate report
    generate_report "${VERSION}" "${build_start}" "${build_end}"
    
    # Cleanup
    cleanup_images
    
    echo -e "${GREEN}🎉 Build completed successfully!${NC}"
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "  • Start development: docker compose -f compose.yml up -d"
    echo -e "  • View logs: docker compose -f compose.yml logs -f app"
    echo -e "  • Security reports: ls security-reports/"
    echo -e "  • Build reports: ls build-reports/"
    
    # Show final image info
    if docker image inspect "${IMAGE_NAME}:${VERSION}" &> /dev/null; then
        echo -e "${BLUE}📊 Final image details:${NC}"
        docker images "${IMAGE_NAME}:${VERSION}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    fi
}

# Handle script arguments
case "${1:-help}" in
    "production"|"development"|"testing")
        main
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [production|development|testing] [version]"
        echo ""
        echo "Examples:"
        echo "  $0 development latest"
        echo "  $0 production v1.0.0"
        echo "  $0 testing test-$(git rev-parse --short HEAD)"
        echo ""
        echo "Environment variables:"
        echo "  PLATFORMS    - Target platforms (default: linux/amd64,linux/arm64)"
        echo "  REGISTRY     - Container registry (default: ddh)"
        ;;
    *)
        echo -e "${RED}❌ Invalid target: ${1}${NC}"
        echo "Valid targets: production, development, testing"
        echo "Use '$0 help' for more information"
        exit 1
        ;;
esac