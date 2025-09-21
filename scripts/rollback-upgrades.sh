#!/bin/bash

set -e

PHASE=${1:-"all"}
BACKUP_DATE=${2:-$(date +%Y%m%d)}

echo "🔄 Starting rollback for phase: $PHASE"

# Function to restore packages
restore_packages() {
    if [ -f "package.json.backup" ]; then
        echo "📦 Restoring package.json from backup"
        cp package.json.backup package.json
        cp package-lock.json.backup package-lock.json
        npm ci
    else
        echo "❌ No backup found, using git reset"
        git reset --hard HEAD~1
        npm ci
    fi
}

# Function to verify rollback
verify_rollback() {
    echo "🔍 Verifying rollback..."

    # Build verification
    npm run build || {
        echo "❌ Build failed after rollback"
        exit 1
    }

    # Test verification
    npm test || {
        echo "❌ Tests failed after rollback"
        exit 1
    }

    # E2E verification
    npm run test:e2e || {
        echo "❌ E2E tests failed after rollback"
        exit 1
    }

    echo "✅ Rollback verification complete"
}

# Phase-specific rollback
case $PHASE in
    "1"|"phase-1")
        echo "Rolling back Phase 1 (safe updates)"
        git checkout master
        git branch -D upgrade/phase-1-safe-updates || true
        ;;

    "2"|"phase-2")
        echo "Rolling back Phase 2 (NestJS auth)"
        git checkout upgrade/phase-1-safe-updates
        git branch -D upgrade/phase-2-nestjs-auth || true
        ;;

    "3"|"phase-3")
        echo "Rolling back Phase 3 (security/testing)"
        git checkout upgrade/phase-2-nestjs-auth
        git branch -D upgrade/phase-3-security-testing || true
        ;;

    "all")
        echo "Rolling back all upgrades"
        git checkout master
        git branch -D upgrade/phase-1-safe-updates || true
        git branch -D upgrade/phase-2-nestjs-auth || true
        git branch -D upgrade/phase-3-security-testing || true
        restore_packages
        ;;

    *)
        echo "❌ Unknown phase: $PHASE"
        echo "Usage: $0 [1|2|3|all] [backup_date]"
        exit 1
        ;;
esac

verify_rollback

echo "✅ Rollback complete for phase: $PHASE"