#!/bin/bash
# upgrade-phase1.sh - Critical Security Fixes (NestJS Core)
# This script handles Phase 1 of the dependency upgrade plan

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    local node_version
    node_version=$(node --version | sed 's/v//')
    log_info "Node.js version: $node_version"
    
    # Check npm version
    local npm_version
    npm_version=$(npm --version)
    log_info "NPM version: $npm_version"
    
    # Check git status
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_error "You have uncommitted changes. Please commit or stash them first."
        return 1
    fi
    
    # Check if we're on the right branch
    local current_branch
    current_branch=$(git branch --show-current)
    log_info "Current branch: $current_branch"
    
    log_success "Prerequisites check passed"
}

# Create rollback point
create_rollback_point() {
    log_info "Creating rollback point..."
    
    # Create backup files
    cp package.json package.json.backup
    cp package-lock.json package-lock.json.backup
    log_success "Package files backed up"
    
    # Create git tag
    local timestamp
    timestamp=$(date +"%Y%m%d-%H%M%S")
    git tag -a "pre-nestjs-v11-upgrade-$timestamp" -m "Pre NestJS v11 upgrade snapshot"
    log_success "Git tag created: pre-nestjs-v11-upgrade-$timestamp"
    
    # Capture baseline metrics
    if [ -f "./scripts/validate-upgrade.sh" ]; then
        ./scripts/validate-upgrade.sh baseline
        log_success "Baseline metrics captured"
    fi
}

# Create upgrade branch
create_upgrade_branch() {
    log_info "Creating upgrade branch..."
    
    local branch_name="upgrade/nestjs-v11-security-fixes"
    
    # Check if branch already exists
    if git show-ref --verify --quiet refs/heads/$branch_name; then
        log_warning "Branch $branch_name already exists"
        read -p "Do you want to switch to it? (y/n): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git checkout $branch_name
        else
            log_info "Staying on current branch"
        fi
    else
        git checkout -b $branch_name
        log_success "Created and switched to branch: $branch_name"
    fi
}

# Upgrade critical NestJS core packages
upgrade_nestjs_core() {
    log_info "Upgrading critical NestJS core packages..."
    
    # List of critical packages to upgrade
    local packages=(
        "@nestjs/core@^11.1.6"
        "@nestjs/common@^11.1.6"
        "@nestjs/platform-express@^11.1.6"
        "@nestjs/testing@^11.1.6"
    )
    
    log_info "Installing: ${packages[*]}"
    
    if npm install "${packages[@]}"; then
        log_success "Core NestJS packages upgraded successfully"
    else
        log_error "Failed to upgrade core NestJS packages"
        return 1
    fi
    
    # Show the changes
    log_info "Package versions after upgrade:"
    npm ls @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/testing --depth=0 || true
}

# Check for immediate breaking changes
check_immediate_issues() {
    log_info "Checking for immediate TypeScript/build issues..."
    
    # Try TypeScript compilation
    log_info "Running TypeScript check..."
    if npx tsc --noEmit; then
        log_success "TypeScript compilation successful"
    else
        log_warning "TypeScript compilation has errors - this is expected and will be addressed"
    fi
    
    # Try building the application
    log_info "Attempting to build application..."
    if npm run build; then
        log_success "Build successful"
    else
        log_warning "Build failed - this may be expected with major upgrades"
        log_info "Common issues to fix manually:"
        echo "  - Import path changes for decorators"
        echo "  - Type compatibility issues"
        echo "  - Dependency injection changes"
    fi
}

# Run critical tests
run_critical_tests() {
    log_info "Running critical tests..."
    
    # Try to run tests that don't require the full app to be working
    log_info "Running unit tests (may have some failures)..."
    if npm test -- --passWithNoTests; then
        log_success "Unit tests passed"
    else
        log_warning "Some unit tests failed - review and fix manually"
    fi
}

# Generate migration guide for manual fixes
generate_migration_notes() {
    log_info "Generating migration notes..."
    
    cat > "NESTJS_V11_MIGRATION_NOTES.md" << 'EOF'
# NestJS v11 Migration Notes - Phase 1 Complete

## What was upgraded:
- @nestjs/core: 9.4.3 → 11.1.6
- @nestjs/common: 9.4.3 → 11.1.6  
- @nestjs/platform-express: 9.4.3 → 11.1.6
- @nestjs/testing: 9.4.3 → 11.1.6

## Security vulnerabilities addressed:
- CRITICAL: @nestjs/core RCE vulnerability
- MODERATE: @nestjs/common code execution vulnerability

## Common issues and fixes:

### 1. Import path changes
Some decorators may have moved. Check imports:
```typescript
// Verify these imports still work:
import { Injectable, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
```

### 2. Type compatibility
Enhanced type checking may reveal previously hidden issues:
```typescript
// May need explicit typing:
constructor(
  private readonly repository: UserRepository, // Be explicit about types
) {}
```

### 3. Dependency injection
Check for circular dependencies - NestJS v11 has stricter detection.

### 4. Testing
Update test imports if any module paths changed.

## Next steps:
1. Fix any TypeScript compilation errors
2. Update remaining NestJS packages (Phase 2)
3. Run full test suite
4. Deploy to staging for integration testing

## Rollback if needed:
```bash
./scripts/rollback.sh
```
EOF

    log_success "Migration notes created: NESTJS_V11_MIGRATION_NOTES.md"
}

# Main upgrade function
main() {
    echo "🚨 NestJS v11 Security Upgrade - Phase 1"
    echo "======================================="
    echo ""
    echo "This will upgrade critical NestJS packages to address security vulnerabilities:"
    echo "  - CRITICAL: Remote Code Execution in @nestjs/core"
    echo "  - MODERATE: Code Execution in @nestjs/common"
    echo ""
    
    read -p "Do you want to proceed? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Upgrade cancelled"
        exit 0
    fi
    
    # Run all upgrade steps
    check_prerequisites || exit 1
    create_rollback_point || exit 1
    create_upgrade_branch || exit 1
    upgrade_nestjs_core || exit 1
    check_immediate_issues
    run_critical_tests
    generate_migration_notes
    
    echo ""
    echo "======================================"
    log_success "Phase 1 upgrade completed!"
    echo ""
    echo "🔧 Manual tasks required:"
    echo "  1. Review NESTJS_V11_MIGRATION_NOTES.md"
    echo "  2. Fix any TypeScript compilation errors"
    echo "  3. Update import paths if needed"
    echo "  4. Run tests: npm test"
    echo "  5. Test application startup: npm run start:dev"
    echo ""
    echo "🧪 Validation:"
    echo "  ./scripts/validate-upgrade.sh app"
    echo ""
    echo "🔄 Rollback if needed:"
    echo "  ./scripts/rollback.sh"
    echo ""
    echo "➡️  Next phase:"
    echo "  ./scripts/upgrade-phase2.sh (after manual fixes are complete)"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi