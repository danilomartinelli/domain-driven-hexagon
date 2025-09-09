#!/bin/bash
# Generate self-signed SSL certificates for development

set -euo pipefail

# Configuration
SSL_DIR="../nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"
DHPARAM_FILE="$SSL_DIR/dhparam.pem"

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
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is not installed"
        exit 1
    fi
    log_success "Dependencies check passed"
}

# Create SSL directory
create_ssl_dir() {
    if [ ! -d "$SSL_DIR" ]; then
        mkdir -p "$SSL_DIR"
        log_info "Created SSL directory: $SSL_DIR"
    fi
}

# Generate SSL certificate
generate_certificate() {
    log_info "Generating self-signed SSL certificate..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=US/ST=Development/L=Local/O=DDH/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
    
    if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
        log_success "SSL certificate generated successfully"
        log_info "Certificate: $CERT_FILE"
        log_info "Private key: $KEY_FILE"
    else
        log_error "Failed to generate SSL certificate"
        exit 1
    fi
}

# Generate Diffie-Hellman parameters for enhanced security
generate_dhparam() {
    log_info "Generating Diffie-Hellman parameters (this may take a while)..."
    
    openssl dhparam -out "$DHPARAM_FILE" 2048
    
    if [ -f "$DHPARAM_FILE" ]; then
        log_success "Diffie-Hellman parameters generated successfully"
        log_info "DH params: $DHPARAM_FILE"
    else
        log_warning "Failed to generate DH parameters (optional)"
    fi
}

# Set proper permissions
set_permissions() {
    log_info "Setting proper file permissions..."
    
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    
    if [ -f "$DHPARAM_FILE" ]; then
        chmod 644 "$DHPARAM_FILE"
    fi
    
    log_success "Permissions set correctly"
}

# Display certificate information
show_certificate_info() {
    log_info "Certificate information:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -A 2 "Subject:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -A 2 "Not Before"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -A 2 "Not After"
}

# Main function
main() {
    log_info "Starting SSL certificate generation for development..."
    
    check_dependencies
    create_ssl_dir
    
    # Check if certificates already exist
    if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
        log_warning "SSL certificates already exist"
        echo -n "Do you want to regenerate them? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Using existing certificates"
            show_certificate_info
            exit 0
        fi
        rm -f "$CERT_FILE" "$KEY_FILE" "$DHPARAM_FILE"
    fi
    
    generate_certificate
    generate_dhparam
    set_permissions
    show_certificate_info
    
    log_success "SSL setup completed!"
    log_info "You can now run the production environment with HTTPS support"
}

# Handle help
if [[ $# -gt 0 && ("$1" == "-h" || "$1" == "--help") ]]; then
    cat << EOF
SSL Certificate Generator for Domain-Driven Hexagon

Usage: $0

This script generates self-signed SSL certificates for development use.
The certificates will be created in the ssl/ directory.

Files generated:
  - ssl/localhost.crt - SSL certificate
  - ssl/localhost.key - Private key
  - ssl/dhparam.pem   - Diffie-Hellman parameters

Note: These are self-signed certificates suitable only for development.
For production, use certificates from a trusted Certificate Authority.

EOF
    exit 0
fi

# Run main function
main "$@"