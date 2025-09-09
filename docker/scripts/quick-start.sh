#!/bin/bash
# Quick Start Script for Domain-Driven Hexagon Development Environment
# This script sets up everything needed for local development

set -euo pipefail

# Configuration
PROJECT_NAME="Domain-Driven Hexagon"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# ASCII banner
print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                    Domain-Driven Hexagon                         ║
║                     Quick Start Setup                            ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Check system requirements
check_requirements() {
    log_step "Checking system requirements..."
    
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("Docker Compose")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo -e "  ${RED}✗${NC} $dep"
        done
        echo ""
        log_info "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    log_success "All system requirements met"
    
    # Display versions
    echo -e "${BLUE}System Info:${NC}"
    echo -e "  Docker: $(docker --version | cut -d' ' -f3 | sed 's/,//')"
    echo -e "  Docker Compose: $(docker-compose --version | cut -d' ' -f4 | sed 's/,//')"
    echo -e "  Node.js: $(node --version)"
    echo -e "  npm: $(npm --version)"
    echo ""
}

# Check if we're in the right directory
check_project_structure() {
    log_step "Validating project structure..."
    
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Are you running this from the correct directory?"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_ROOT/docker" ]; then
        log_error "Docker directory not found. Project structure seems incorrect."
        exit 1
    fi
    
    log_success "Project structure validated"
}

# Install dependencies
install_dependencies() {
    log_step "Installing Node.js dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm packages..."
        npm install
        log_success "Dependencies installed"
    else
        log_info "Dependencies already installed, checking for updates..."
        npm update
        log_success "Dependencies updated"
    fi
}

# Generate SSL certificates
setup_ssl() {
    log_step "Setting up SSL certificates for HTTPS..."
    
    if [ -f "$PROJECT_ROOT/ssl/localhost.crt" ] && [ -f "$PROJECT_ROOT/ssl/localhost.key" ]; then
        log_info "SSL certificates already exist"
    else
        log_info "Generating SSL certificates..."
        cd "$SCRIPT_DIR"
        ./generate-ssl.sh
    fi
}

# Build Docker images
build_images() {
    log_step "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    log_info "Building development image..."
    make build-dev
    
    log_success "Docker images built successfully"
}

# Start development environment
start_development() {
    log_step "Starting development environment..."
    
    cd "$PROJECT_ROOT"
    
    log_info "Starting services..."
    make dev
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if make status | grep -q "Up"; then
        log_success "Development environment started successfully"
    else
        log_warning "Some services may still be starting up"
    fi
}

# Run database migrations
setup_database() {
    log_step "Setting up database..."
    
    cd "$PROJECT_ROOT"
    
    log_info "Waiting for database to be ready..."
    sleep 15
    
    log_info "Running database migrations..."
    if make db-migrate-dev; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations may have failed - check logs"
    fi
}

# Display success information
show_success_info() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                          SUCCESS! 🎉                             ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║  Your Domain-Driven Hexagon development environment is ready!    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${BLUE}🌐 Application URLs:${NC}"
    echo -e "  • Main App:    ${YELLOW}http://localhost:3000${NC}"
    echo -e "  • PgAdmin:     ${YELLOW}http://localhost:5050${NC} (admin@ddh.local / admin)"
    echo -e "  • Database:    ${YELLOW}localhost:5432${NC} (user / password / ddh)"
    echo -e "  • Redis:       ${YELLOW}localhost:6379${NC}"
    echo ""
    
    echo -e "${BLUE}🛠 Useful Commands:${NC}"
    echo -e "  • View logs:   ${YELLOW}make dev-logs${NC}"
    echo -e "  • Stop env:    ${YELLOW}make dev-stop${NC}"
    echo -e "  • Restart:     ${YELLOW}make dev-restart${NC}"
    echo -e "  • Run tests:   ${YELLOW}make test${NC}"
    echo -e "  • Database:    ${YELLOW}make db-console-dev${NC}"
    echo -e "  • Shell:       ${YELLOW}make shell${NC}"
    echo ""
    
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo -e "  • README:      ${YELLOW}View the project README.md${NC}"
    echo -e "  • CLAUDE.md:   ${YELLOW}Developer instructions${NC}"
    echo -e "  • Make help:   ${YELLOW}make help${NC}"
    echo ""
    
    log_info "Happy coding! 🚀"
}

# Main execution flow
main() {
    print_banner
    
    log_info "Starting quick setup for $PROJECT_NAME..."
    echo ""
    
    check_requirements
    check_project_structure
    install_dependencies
    setup_ssl
    build_images
    start_development
    setup_database
    
    show_success_info
}

# Handle help
if [[ $# -gt 0 && ("$1" == "-h" || "$1" == "--help") ]]; then
    cat << EOF
Quick Start Script for Domain-Driven Hexagon

Usage: $0

This script performs a complete setup of the development environment:

1. ✅ Checks system requirements (Docker, Node.js, npm)
2. 📦 Installs npm dependencies
3. 🔒 Generates SSL certificates for HTTPS
4. 🐳 Builds Docker images
5. 🚀 Starts development environment
6. 🗄️  Sets up database with migrations

After running this script, you'll have a fully functional development
environment ready for Domain-Driven Design development with NestJS.

Requirements:
- Docker and Docker Compose
- Node.js 20+ and npm
- Git (for cloning)

The script will guide you through any issues and provide helpful
information for getting started.

EOF
    exit 0
fi

# Trap to cleanup on exit
trap 'echo -e "\n${YELLOW}Setup interrupted. You can resume by running this script again.${NC}"' INT

# Run main function
main "$@"