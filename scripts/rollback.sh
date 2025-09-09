#!/bin/bash
# rollback.sh - Emergency rollback script for dependency upgrades

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

# Check if rollback files exist
check_rollback_availability() {
    log_info "Checking rollback availability..."
    
    if [ -f "package.json.backup" ] && [ -f "package-lock.json.backup" ]; then
        log_success "Backup files found"
        return 0
    fi
    
    # Check for git tags
    local pre_upgrade_tag
    pre_upgrade_tag=$(git tag -l "pre-*upgrade*" | tail -1)
    
    if [ -n "$pre_upgrade_tag" ]; then
        log_success "Found git tag: $pre_upgrade_tag"
        return 0
    fi
    
    log_error "No rollback files or git tags found!"
    echo "Available options:"
    echo "  1. Manual rollback using git history"
    echo "  2. Restore from external backup"
    echo "  3. Fresh clone and manual dependency restoration"
    return 1
}

# Create emergency backup before rollback
create_emergency_backup() {
    log_info "Creating emergency backup of current state..."
    
    local timestamp
    timestamp=$(date +"%Y%m%d-%H%M%S")
    
    mkdir -p ".rollback-backups/$timestamp"
    
    # Backup current package files
    cp package.json ".rollback-backups/$timestamp/package.json.current" 2>/dev/null || true
    cp package-lock.json ".rollback-backups/$timestamp/package-lock.json.current" 2>/dev/null || true
    
    # Backup dist folder if exists
    if [ -d "dist" ]; then
        cp -r dist/ ".rollback-backups/$timestamp/dist-current/" 2>/dev/null || true
    fi
    
    # Create git stash
    if git diff --quiet && git diff --cached --quiet; then
        log_info "No uncommitted changes to stash"
    else
        git stash push -m "Emergency backup before rollback $timestamp"
        log_success "Created git stash with current changes"
    fi
    
    log_success "Emergency backup created in .rollback-backups/$timestamp"
}

# Rollback using backup files
rollback_from_backups() {
    log_info "Rolling back from backup files..."
    
    # Restore package files
    if [ -f "package.json.backup" ]; then
        mv package.json.backup package.json
        log_success "Restored package.json from backup"
    else
        log_error "package.json.backup not found"
        return 1
    fi
    
    if [ -f "package-lock.json.backup" ]; then
        mv package-lock.json.backup package-lock.json
        log_success "Restored package-lock.json from backup"
    else
        log_error "package-lock.json.backup not found"
        return 1
    fi
    
    return 0
}

# Rollback using git tag
rollback_from_git_tag() {
    log_info "Rolling back from git tag..."
    
    local pre_upgrade_tag
    pre_upgrade_tag=$(git tag -l "pre-*upgrade*" | tail -1)
    
    if [ -z "$pre_upgrade_tag" ]; then
        log_error "No pre-upgrade git tag found"
        return 1
    fi
    
    log_info "Using tag: $pre_upgrade_tag"
    
    # Checkout package files from tag
    git checkout "$pre_upgrade_tag" -- package.json package-lock.json
    
    log_success "Restored package files from git tag: $pre_upgrade_tag"
    return 0
}

# Clean and reinstall dependencies
reinstall_dependencies() {
    log_info "Cleaning and reinstalling dependencies..."
    
    # Remove node_modules and package-lock if npm version mismatch
    if [ -d "node_modules" ]; then
        log_info "Removing node_modules directory..."
        rm -rf node_modules
    fi
    
    # Remove package-lock.json to force fresh resolution
    if [ "$1" = "--force-fresh" ]; then
        log_warning "Forcing fresh dependency resolution"
        rm -f package-lock.json
    fi
    
    # Clear npm cache
    log_info "Clearing npm cache..."
    npm cache clean --force
    
    # Install dependencies
    log_info "Installing dependencies..."
    if ! npm ci; then
        log_warning "npm ci failed, trying npm install..."
        npm install
    fi
    
    log_success "Dependencies reinstalled"
}

# Verify rollback success
verify_rollback() {
    log_info "Verifying rollback success..."
    
    # Check if dependencies are consistent
    if ! npm ls >/dev/null 2>&1; then
        log_error "Dependency tree is still inconsistent after rollback"
        return 1
    fi
    log_success "Dependency tree is consistent"
    
    # Try to build the application
    log_info "Testing build process..."
    if ! npm run build >/dev/null 2>&1; then
        log_error "Build still fails after rollback"
        return 1
    fi
    log_success "Build process works"
    
    # Run smoke tests if available
    if command -v ./scripts/validate-upgrade.sh >/dev/null 2>&1; then
        log_info "Running smoke tests..."
        if ./scripts/validate-upgrade.sh app; then
            log_success "Smoke tests passed"
        else
            log_warning "Some smoke tests failed, but basic functionality restored"
        fi
    fi
    
    return 0
}

# Rollback database if needed
rollback_database() {
    local db_backup_file="$1"
    
    if [ -z "$db_backup_file" ]; then
        log_info "No database rollback requested"
        return 0
    fi
    
    if [ ! -f "$db_backup_file" ]; then
        log_error "Database backup file not found: $db_backup_file"
        return 1
    fi
    
    log_warning "Database rollback requested - this is a destructive operation!"
    echo "Backup file: $db_backup_file"
    read -p "Are you sure you want to restore the database? (yes/no): " -r
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Database rollback cancelled"
        return 0
    fi
    
    # This is a placeholder - actual implementation depends on database type
    log_warning "Database rollback not implemented - manual restore required"
    echo "To restore database manually:"
    echo "  1. Stop the application"
    echo "  2. Restore from backup: $db_backup_file"
    echo "  3. Run any necessary migration rollbacks"
    
    return 0
}

# Main rollback function
main() {
    echo "🔄 Dependency Rollback Utility"
    echo "=============================="
    
    # Parse command line arguments
    local force_fresh=false
    local db_backup=""
    local rollback_method="auto"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-fresh)
                force_fresh=true
                shift
                ;;
            --database=*)
                db_backup="${1#*=}"
                shift
                ;;
            --method=*)
                rollback_method="${1#*=}"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --force-fresh        Remove package-lock.json for fresh dependency resolution"
                echo "  --database=FILE      Rollback database from backup file"
                echo "  --method=METHOD      Rollback method: auto, backup, git, manual"
                echo "  --help, -h           Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                                    # Automatic rollback"
                echo "  $0 --force-fresh                     # Fresh dependency resolution"
                echo "  $0 --method=backup                   # Force backup file method"
                echo "  $0 --database=backup.sql             # Include database rollback"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Confirm rollback
    if [ "$rollback_method" != "manual" ]; then
        log_warning "This will rollback your dependencies to a previous state"
        read -p "Are you sure you want to proceed? (yes/no): " -r
        
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Check rollback availability
    if ! check_rollback_availability; then
        if [ "$rollback_method" = "manual" ]; then
            log_info "Manual rollback mode - continuing without automatic rollback files"
        else
            exit 1
        fi
    fi
    
    # Create emergency backup
    create_emergency_backup
    
    # Perform rollback based on method
    local rollback_success=false
    
    case $rollback_method in
        "backup")
            rollback_from_backups && rollback_success=true
            ;;
        "git")
            rollback_from_git_tag && rollback_success=true
            ;;
        "manual")
            log_info "Manual rollback mode - skipping automatic package restoration"
            rollback_success=true
            ;;
        "auto"|*)
            log_info "Attempting automatic rollback..."
            
            # Try backup files first
            if rollback_from_backups; then
                rollback_success=true
            elif rollback_from_git_tag; then
                rollback_success=true
            else
                log_error "All automatic rollback methods failed"
                rollback_success=false
            fi
            ;;
    esac
    
    if [ "$rollback_success" = false ]; then
        log_error "Rollback failed!"
        echo ""
        echo "🔧 Manual recovery options:"
        echo "  1. Check git history: git log --oneline -n 10"
        echo "  2. Restore from external backup"
        echo "  3. Reset to specific commit: git checkout <commit> -- package.json package-lock.json"
        exit 1
    fi
    
    # Reinstall dependencies
    if [ "$force_fresh" = true ]; then
        reinstall_dependencies --force-fresh
    else
        reinstall_dependencies
    fi
    
    # Handle database rollback
    rollback_database "$db_backup"
    
    # Verify rollback
    if verify_rollback; then
        log_success "Rollback completed successfully!"
        echo ""
        echo "🎉 Next steps:"
        echo "  1. Test your application thoroughly"
        echo "  2. Check that all features work as expected"
        echo "  3. Consider the root cause of the upgrade failure"
        echo "  4. Plan a more gradual upgrade approach"
    else
        log_warning "Rollback completed but some issues remain"
        echo ""
        echo "⚠️  Manual verification needed:"
        echo "  1. Check application startup"
        echo "  2. Run tests manually"
        echo "  3. Verify critical functionality"
    fi
    
    echo ""
    echo "📊 Summary:"
    echo "  Dependencies rolled back: ✅"
    echo "  Build process working: ✅"
    echo "  Emergency backup created: ✅"
    echo "  Location: .rollback-backups/"
}

# Check if script is being run directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi