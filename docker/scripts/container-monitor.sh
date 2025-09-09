#!/bin/bash
# Container monitoring and optimization script

set -euo pipefail

# Configuration
COMPOSE_FILE="${1:-compose.prod.yml}"
MONITORING_INTERVAL=30
LOG_FILE="container-metrics-$(date +%Y%m%d).log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Get container metrics
get_container_metrics() {
    local container_name="$1"
    local stats
    
    if ! stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" "$container_name" 2>/dev/null); then
        log_error "Failed to get stats for container: $container_name"
        return 1
    fi
    
    echo "$stats"
}

# Check container health
check_container_health() {
    local container_name="$1"
    local health_status
    
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "no-health-check")
    
    case "$health_status" in
        "healthy")
            log_success "$container_name is healthy"
            return 0
            ;;
        "unhealthy")
            log_error "$container_name is unhealthy"
            return 1
            ;;
        "starting")
            log_info "$container_name health check is starting"
            return 0
            ;;
        "no-health-check")
            log_warning "$container_name has no health check configured"
            return 0
            ;;
        *)
            log_warning "$container_name has unknown health status: $health_status"
            return 0
            ;;
    esac
}

# Analyze resource usage
analyze_resource_usage() {
    local container_name="$1"
    local cpu_threshold=80
    local memory_threshold=80
    
    local stats
    stats=$(docker stats --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}" "$container_name" 2>/dev/null || echo "0.00%\t0.00%")
    
    local cpu_usage
    local mem_usage
    cpu_usage=$(echo "$stats" | cut -f1 | sed 's/%//')
    mem_usage=$(echo "$stats" | cut -f2 | sed 's/%//')
    
    # Check CPU usage
    if (( $(echo "$cpu_usage > $cpu_threshold" | bc -l 2>/dev/null || echo 0) )); then
        log_warning "$container_name CPU usage is high: ${cpu_usage}%"
    fi
    
    # Check memory usage
    if (( $(echo "$mem_usage > $memory_threshold" | bc -l 2>/dev/null || echo 0) )); then
        log_warning "$container_name memory usage is high: ${mem_usage}%"
    fi
    
    # Log current usage
    echo "$(date): $container_name CPU: ${cpu_usage}%, Memory: ${mem_usage}%" >> "$LOG_FILE"
}

# Check disk usage
check_disk_usage() {
    log_info "Checking Docker disk usage..."
    
    # System df
    docker system df
    
    # Check for large images
    log_info "Large images (>500MB):"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | \
        awk 'NR==1 {print; next} {
            size = $3
            if (size ~ /GB/ || (size ~ /MB/ && substr(size, 1, length(size)-2) > 500)) print
        }'
    
    # Check for dangling images
    local dangling_count
    dangling_count=$(docker images -f "dangling=true" -q | wc -l)
    
    if [[ "$dangling_count" -gt 0 ]]; then
        log_warning "Found $dangling_count dangling images. Run 'docker image prune' to clean up."
    fi
}

# Monitor logs for errors
monitor_logs() {
    local container_name="$1"
    local error_patterns=("ERROR" "FATAL" "Exception" "failed" "timeout")
    
    log_info "Checking logs for $container_name..."
    
    local recent_logs
    recent_logs=$(docker logs --tail=100 "$container_name" 2>&1)
    
    for pattern in "${error_patterns[@]}"; do
        local error_count
        error_count=$(echo "$recent_logs" | grep -i "$pattern" | wc -l)
        
        if [[ "$error_count" -gt 0 ]]; then
            log_warning "$container_name has $error_count log entries with pattern '$pattern'"
        fi
    done
}

# Performance recommendations
generate_recommendations() {
    local container_name="$1"
    
    log_info "Generating recommendations for $container_name..."
    
    # Check restart count
    local restart_count
    restart_count=$(docker inspect --format='{{.RestartCount}}' "$container_name" 2>/dev/null || echo "0")
    
    if [[ "$restart_count" -gt 5 ]]; then
        log_warning "$container_name has restarted $restart_count times. Consider investigating stability issues."
    fi
    
    # Check uptime
    local started_at
    started_at=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null)
    
    if [[ -n "$started_at" ]]; then
        local uptime_seconds
        uptime_seconds=$(( $(date +%s) - $(date -d "$started_at" +%s) ))
        local uptime_hours=$((uptime_seconds / 3600))
        
        if [[ "$uptime_hours" -lt 1 ]]; then
            log_info "$container_name uptime: ${uptime_hours}h (recently started)"
        fi
    fi
}

# Main monitoring loop
monitor_containers() {
    local containers
    containers=$(docker-compose -f "$COMPOSE_FILE" ps --services)
    
    log_info "Starting container monitoring..."
    log_info "Monitoring interval: ${MONITORING_INTERVAL}s"
    log_info "Log file: $LOG_FILE"
    
    while true; do
        echo "$(date): Starting monitoring cycle" >> "$LOG_FILE"
        
        for service in $containers; do
            local container_name
            container_name=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" | head -1)
            
            if [[ -z "$container_name" ]]; then
                log_warning "Service $service is not running"
                continue
            fi
            
            # Get actual container name
            container_name=$(docker inspect --format='{{.Name}}' "$container_name" | sed 's/^\/*//')
            
            log_info "Monitoring container: $container_name"
            
            # Check health
            check_container_health "$container_name"
            
            # Analyze resources
            analyze_resource_usage "$container_name"
            
            # Monitor logs
            monitor_logs "$container_name"
            
            # Generate recommendations
            generate_recommendations "$container_name"
            
            # Display current stats
            get_container_metrics "$container_name"
        done
        
        # Check disk usage
        check_disk_usage
        
        echo "$(date): Monitoring cycle completed" >> "$LOG_FILE"
        echo "----------------------------------------" >> "$LOG_FILE"
        
        sleep "$MONITORING_INTERVAL"
    done
}

# Cleanup function
cleanup_docker() {
    log_info "Running Docker cleanup..."
    
    # Remove stopped containers
    local stopped_containers
    stopped_containers=$(docker ps -a -f status=exited -q)
    
    if [[ -n "$stopped_containers" ]]; then
        docker rm $stopped_containers
        log_success "Removed stopped containers"
    fi
    
    # Remove dangling images
    docker image prune -f
    log_success "Removed dangling images"
    
    # Remove unused networks
    docker network prune -f
    log_success "Removed unused networks"
    
    # Remove unused volumes (be careful!)
    read -p "Remove unused volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
        log_success "Removed unused volumes"
    fi
}

# Show help
show_help() {
    cat << EOF
Container Monitoring Script for Domain-Driven Hexagon

Usage: $0 [COMPOSE_FILE] [COMMAND]

Commands:
  monitor    Monitor containers continuously (default)
  status     Show current container status
  cleanup    Clean up unused Docker resources
  help       Show this help message

Examples:
  $0                          # Monitor with compose.prod.yml
  $0 compose.dev.yml          # Monitor development environment
  $0 compose.prod.yml status  # Show status only
  $0 compose.prod.yml cleanup # Clean up resources

EOF
}

# Handle commands
case "${2:-monitor}" in
    "monitor")
        monitor_containers
        ;;
    "status")
        log_info "Container Status Report"
        containers=$(docker-compose -f "$COMPOSE_FILE" ps --services)
        for service in $containers; do
            container_name=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" | head -1)
            if [[ -n "$container_name" ]]; then
                container_name=$(docker inspect --format='{{.Name}}' "$container_name" | sed 's/^\/*//')
                check_container_health "$container_name"
                get_container_metrics "$container_name"
            fi
        done
        ;;
    "cleanup")
        cleanup_docker
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown command: $2"
        show_help
        exit 1
        ;;
esac