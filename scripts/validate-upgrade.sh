#!/bin/bash
# validate-upgrade.sh - Automated validation script for dependency upgrades

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HEALTH_ENDPOINT="http://localhost:3000/health"
TEST_TIMEOUT=30
APP_START_TIMEOUT=30

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Capture baseline metrics before upgrade
capture_baseline() {
    log_info "Capturing baseline metrics..."
    
    # Create baseline directory
    mkdir -p .upgrade-baseline
    
    # Test coverage
    npm run test:cov > .upgrade-baseline/test-coverage.txt 2>&1 || log_warning "Could not capture test coverage"
    
    # Bundle size analysis
    npm run build > .upgrade-baseline/build-output.txt 2>&1
    if [ -d "dist" ]; then
        du -sh dist/ > .upgrade-baseline/bundle-size.txt
    fi
    
    # Dependencies audit
    npm audit --json > .upgrade-baseline/security-audit.json 2>/dev/null || log_warning "Audit capture failed"
    
    # Performance baseline (if app is running)
    if curl -sf "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
        curl -w "@curl-format.txt" -o /dev/null -s "$HEALTH_ENDPOINT" > .upgrade-baseline/performance.txt 2>/dev/null || true
    fi
    
    log_success "Baseline captured in .upgrade-baseline/"
}

# Validate the application after upgrade
validate_application() {
    log_info "Starting application validation..."
    
    # Check if package.json and node_modules are consistent
    if ! npm ls >/dev/null 2>&1; then
        log_error "Dependency tree is inconsistent. Run 'npm ci' to fix."
        return 1
    fi
    
    # Build the application
    log_info "Building application..."
    if ! npm run build; then
        log_error "Application build failed"
        return 1
    fi
    log_success "Build completed successfully"
    
    # Start application in background for testing
    log_info "Starting application for health check..."
    npm run start:dev &
    APP_PID=$!
    
    # Wait for application to start
    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        if curl -sf "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
            log_success "Application started successfully"
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_error "Application failed to start within $APP_START_TIMEOUT seconds"
        kill $APP_PID 2>/dev/null || true
        return 1
    fi
    
    # Run health checks
    validate_health_checks
    local health_status=$?
    
    # Clean up application process
    kill $APP_PID 2>/dev/null || true
    sleep 2
    
    return $health_status
}

validate_health_checks() {
    log_info "Running health checks..."
    
    # Basic health endpoint
    if ! curl -sf "$HEALTH_ENDPOINT" >/dev/null; then
        log_error "Health endpoint is not responding"
        return 1
    fi
    log_success "Health endpoint is responding"
    
    # Database connectivity (if endpoint exists)
    if curl -sf "$HEALTH_ENDPOINT/database" >/dev/null 2>&1; then
        log_success "Database connectivity verified"
    else
        log_warning "Database health check endpoint not available or failing"
    fi
    
    # GraphQL endpoint (if available)
    if curl -sf "http://localhost:3000/graphql" >/dev/null 2>&1; then
        log_success "GraphQL endpoint is responding"
    else
        log_warning "GraphQL endpoint not available or not configured"
    fi
    
    return 0
}

run_test_suites() {
    log_info "Running test suites..."
    
    # Unit tests
    log_info "Running unit tests..."
    if ! timeout $TEST_TIMEOUT npm test; then
        log_error "Unit tests failed or timed out"
        return 1
    fi
    log_success "Unit tests passed"
    
    # Integration tests (if available)
    if npm run test:integration >/dev/null 2>&1; then
        log_info "Running integration tests..."
        if ! timeout $TEST_TIMEOUT npm run test:integration; then
            log_error "Integration tests failed"
            return 1
        fi
        log_success "Integration tests passed"
    fi
    
    # E2E tests
    if npm run test:e2e >/dev/null 2>&1; then
        log_info "Running E2E tests..."
        if ! timeout $TEST_TIMEOUT npm run test:e2e; then
            log_error "E2E tests failed"
            return 1
        fi
        log_success "E2E tests passed"
    fi
    
    return 0
}

validate_code_quality() {
    log_info "Validating code quality..."
    
    # TypeScript compilation
    if ! npx tsc --noEmit; then
        log_error "TypeScript compilation errors detected"
        return 1
    fi
    log_success "TypeScript compilation successful"
    
    # Linting
    if ! npm run lint; then
        log_error "Linting errors detected"
        return 1
    fi
    log_success "Linting passed"
    
    # Architecture validation (if available)
    if npm run deps:validate >/dev/null 2>&1; then
        if ! npm run deps:validate; then
            log_error "Architecture validation failed"
            return 1
        fi
        log_success "Architecture validation passed"
    fi
    
    return 0
}

validate_security() {
    log_info "Running security validation..."
    
    # Security audit
    local audit_output
    audit_output=$(npm audit --json 2>/dev/null || echo '{}')
    
    # Check for critical and high vulnerabilities
    local critical_count
    local high_count
    
    critical_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo 0)
    high_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo 0)
    
    if [ "$critical_count" -gt 0 ]; then
        log_error "$critical_count critical security vulnerabilities found"
        return 1
    fi
    
    if [ "$high_count" -gt 0 ]; then
        log_warning "$high_count high security vulnerabilities found"
        log_warning "Consider running 'npm audit fix' or manual updates"
    fi
    
    log_success "Security audit completed"
    return 0
}

compare_metrics() {
    if [ ! -d ".upgrade-baseline" ]; then
        log_warning "No baseline metrics found for comparison"
        return 0
    fi
    
    log_info "Comparing post-upgrade metrics..."
    
    # Compare bundle size
    if [ -f ".upgrade-baseline/bundle-size.txt" ] && [ -d "dist" ]; then
        local baseline_size
        local current_size
        baseline_size=$(cat .upgrade-baseline/bundle-size.txt | awk '{print $1}')
        current_size=$(du -sh dist/ | awk '{print $1}')
        
        log_info "Bundle size: $baseline_size → $current_size"
    fi
    
    # Compare security vulnerabilities
    if [ -f ".upgrade-baseline/security-audit.json" ]; then
        local baseline_vulns
        local current_vulns
        baseline_vulns=$(jq -r '.metadata.vulnerabilities.total // 0' .upgrade-baseline/security-audit.json 2>/dev/null || echo 0)
        current_vulns=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo 0)
        
        log_info "Security vulnerabilities: $baseline_vulns → $current_vulns"
        
        if [ "$current_vulns" -lt "$baseline_vulns" ]; then
            log_success "Security vulnerabilities reduced!"
        elif [ "$current_vulns" -gt "$baseline_vulns" ]; then
            log_warning "Security vulnerabilities increased"
        fi
    fi
}

# Create curl format file for performance testing
create_curl_format() {
    cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF
}

# Main validation function
main() {
    echo "🔍 Dependency Upgrade Validation"
    echo "================================="
    
    local validation_failed=false
    
    # Create curl format file
    create_curl_format
    
    case "${1:-all}" in
        "baseline")
            capture_baseline
            ;;
        "app")
            validate_application || validation_failed=true
            ;;
        "tests")
            run_test_suites || validation_failed=true
            ;;
        "quality")
            validate_code_quality || validation_failed=true
            ;;
        "security")
            validate_security || validation_failed=true
            ;;
        "compare")
            compare_metrics
            ;;
        "all"|*)
            log_info "Running complete validation suite..."
            
            validate_application || validation_failed=true
            run_test_suites || validation_failed=true
            validate_code_quality || validation_failed=true
            validate_security || validation_failed=true
            compare_metrics
            ;;
    esac
    
    # Cleanup
    rm -f curl-format.txt
    
    echo "================================="
    if [ "$validation_failed" = true ]; then
        log_error "Validation failed! Some checks did not pass."
        echo ""
        echo "🔧 Troubleshooting steps:"
        echo "  1. Check the error messages above"
        echo "  2. Run individual validation steps to isolate issues:"
        echo "     ./scripts/validate-upgrade.sh app"
        echo "     ./scripts/validate-upgrade.sh tests"
        echo "     ./scripts/validate-upgrade.sh quality"
        echo "     ./scripts/validate-upgrade.sh security"
        echo "  3. Consider rollback if critical issues persist"
        exit 1
    else
        log_success "All validations passed! Upgrade appears successful."
        echo ""
        echo "🎉 Next steps:"
        echo "  1. Run './scripts/validate-upgrade.sh compare' to see metric changes"
        echo "  2. Monitor application in staging/production"
        echo "  3. Update team documentation"
        exit 0
    fi
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi