# Incremental Dependency Upgrade Plan

## Executive Summary

**Total Packages to Update**: 13
**Estimated Timeline**: 2-3 weeks
**Total Risk**: Low to Medium
**Recommended Approach**: Phased incremental upgrades with comprehensive testing

---

## Phase-Based Upgrade Strategy

### Phase 1: Safe Updates (Week 1)
**Risk Level**: ✅ LOW
**Estimated Time**: 2-3 hours
**Can be done immediately**

#### Packages in Phase 1
| Package | Current | Target | Type | Rationale |
|---------|---------|--------|------|-----------|
| `@types/node` | 24.3.1 | 24.5.2 | Patch | Type definitions only |
| `@typescript-eslint/eslint-plugin` | 8.43.0 | 8.44.0 | Patch | Linting improvements |
| `@typescript-eslint/parser` | 8.43.0 | 8.44.0 | Patch | Linting improvements |
| `typescript-eslint` | 8.43.0 | 8.44.0 | Patch | Linting improvements |
| `dompurify` | 3.2.6 | 3.2.7 | Patch | Security patches |
| `eslint` | 9.35.0 | 9.36.0 | Patch | Bug fixes |
| `ts-jest` | 29.4.1 | 29.4.4 | Patch | Test improvements |
| `zod` | 4.1.8 | 4.1.11 | Patch | Bug fixes |

#### Phase 1 Execution Plan

```bash
# Step 1: Create rollback point
git checkout -b upgrade/phase-1-safe-updates
git tag "pre-upgrade-phase-1-$(date +%Y%m%d-%H%M%S)"

# Step 2: Backup critical files
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Step 3: Execute safe updates
npm update @types/node@24.5.2
npm update @typescript-eslint/eslint-plugin@8.44.0
npm update @typescript-eslint/parser@8.44.0
npm update typescript-eslint@8.44.0
npm update dompurify@3.2.7
npm update eslint@9.36.0
npm update ts-jest@29.4.4
npm update zod@4.1.11

# Step 4: Verification
npm run lint
npm run build
npm test
npm run test:e2e

# Step 5: Commit changes
git add package.json package-lock.json
git commit -m "upgrade: update safe dependencies to latest patch versions"
```

#### Phase 1 Success Criteria
- [ ] All tests pass (unit, integration, e2e)
- [ ] Build completes successfully
- [ ] Linting passes without new errors
- [ ] Application starts correctly
- [ ] No new TypeScript errors

---

### Phase 2: NestJS Authentication Stack (Week 2)
**Risk Level**: ⚠️ MEDIUM
**Estimated Time**: 1-2 days
**Requires careful testing**

#### Packages in Phase 2
| Package | Current | Target | Breaking Changes |
|---------|---------|--------|------------------|
| `@nestjs/config` | 3.2.3 | 4.0.2 | Configuration loading, type definitions |
| `@nestjs/jwt` | 10.2.0 | 11.0.0 | JWT strategy configuration |
| `@nestjs/passport` | 10.0.3 | 11.0.5 | Passport strategy registration |

#### Phase 2 Execution Plan

```bash
# Step 1: Create new branch from Phase 1
git checkout upgrade/phase-1-safe-updates
git checkout -b upgrade/phase-2-nestjs-auth
git tag "pre-upgrade-phase-2-$(date +%Y%m%d-%H%M%S)"

# Step 2: Research breaking changes
# Review migration-guides.md for detailed steps

# Step 3: Update packages individually and test each
# 3a. Update @nestjs/config
npm install @nestjs/config@4.0.2
npm run build && npm test -- --testNamePattern="config"

# 3b. Update @nestjs/jwt
npm install @nestjs/jwt@11.0.0
npm run build && npm test -- --testNamePattern="auth|jwt"

# 3c. Update @nestjs/passport
npm install @nestjs/passport@11.0.5
npm run build && npm test -- --testNamePattern="auth|passport"

# Step 4: Comprehensive testing
npm run test:cov
npm run test:e2e
npm run test:database

# Step 5: Manual authentication testing
npm run start:dev &
sleep 10
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
pkill -f "nest start"
```

#### Phase 2 Success Criteria
- [ ] All authentication tests pass
- [ ] JWT token generation/validation works
- [ ] Configuration loading works correctly
- [ ] User registration/login flow works
- [ ] Protected endpoints require authentication
- [ ] No regression in existing functionality

#### Phase 2 Rollback Plan
```bash
# Quick rollback to Phase 1
git checkout upgrade/phase-1-safe-updates

# Or selective rollback of NestJS packages
npm install @nestjs/config@3.2.3
npm install @nestjs/jwt@10.2.0
npm install @nestjs/passport@10.0.3
npm ci
```

---

### Phase 3: Security & Testing (Week 3)
**Risk Level**: ⚠️ MEDIUM
**Estimated Time**: 1 day
**Focus on security and test environment**

#### Packages in Phase 3
| Package | Current | Target | Impact Area |
|---------|---------|--------|-------------|
| `bcrypt` | 5.1.1 | 6.0.0 | Password hashing |
| `jsdom` | 26.1.0 | 27.0.0 | Test environment |

#### Phase 3 Execution Plan

```bash
# Step 1: Create branch from Phase 2
git checkout upgrade/phase-2-nestjs-auth
git checkout -b upgrade/phase-3-security-testing
git tag "pre-upgrade-phase-3-$(date +%Y%m%d-%H%M%S)"

# Step 2: Update bcrypt
npm install bcrypt@6.0.0
npm install @types/bcrypt@latest

# Test password functionality
npm test -- --testNamePattern="password|hash|auth"

# Step 3: Update jsdom
npm install jsdom@27.0.0
npm install @types/jsdom@latest

# Test DOM-related functionality
npm test -- --testNamePattern="dom|sanitiz"

# Step 4: Full test suite
npm run test:cov
npm run test:e2e
npm run test:database
```

#### Phase 3 Success Criteria
- [ ] Password hashing/verification works
- [ ] User authentication with new bcrypt works
- [ ] DOM manipulation in tests works
- [ ] DOMPurify sanitization works
- [ ] All test suites pass
- [ ] No memory leaks in test environment

---

## Rollback Strategy

### Automated Rollback Script

Create `scripts/rollback-upgrades.sh`:

```bash
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
```

### Emergency Rollback (< 5 minutes)

```bash
# Emergency: Rollback everything immediately
git stash
git checkout master
git clean -fd
npm ci

# Verify application works
npm run build
npm test
npm run start:dev &
sleep 5
curl -f http://localhost:3000/health
pkill -f "nest start"
```

---

## Monitoring & Health Checks

### Pre-Upgrade Baseline

```bash
# Create baseline metrics
mkdir -p upgrade-metrics
echo "Creating baseline metrics..."

# Performance baseline
npm run start:dev &
sleep 10
curl -w "@curl-format.txt" -s http://localhost:3000/health > upgrade-metrics/performance-baseline.txt
pkill -f "nest start"

# Test coverage baseline
npm run test:cov > upgrade-metrics/coverage-baseline.txt

# Bundle size baseline
npm run build
du -h dist/ > upgrade-metrics/bundle-size-baseline.txt

# Memory usage baseline during tests
/usr/bin/time -l npm test > upgrade-metrics/memory-baseline.txt 2>&1
```

### Post-Upgrade Validation

```bash
# Performance comparison
npm run start:dev &
sleep 10
curl -w "@curl-format.txt" -s http://localhost:3000/health > upgrade-metrics/performance-after.txt
pkill -f "nest start"

# Compare metrics
echo "=== Performance Comparison ==="
diff upgrade-metrics/performance-baseline.txt upgrade-metrics/performance-after.txt

# Coverage comparison
npm run test:cov > upgrade-metrics/coverage-after.txt
echo "=== Coverage Comparison ==="
diff upgrade-metrics/coverage-baseline.txt upgrade-metrics/coverage-after.txt

# Bundle size comparison
npm run build
du -h dist/ > upgrade-metrics/bundle-size-after.txt
echo "=== Bundle Size Comparison ==="
diff upgrade-metrics/bundle-size-baseline.txt upgrade-metrics/bundle-size-after.txt
```

### Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

echo "🏥 Running comprehensive health check..."

# Application startup
echo "1. Testing application startup..."
npm run start:dev &
APP_PID=$!
sleep 10

# Health endpoint
echo "2. Testing health endpoint..."
curl -f http://localhost:3000/health || {
    echo "❌ Health check failed"
    kill $APP_PID
    exit 1
}

# GraphQL endpoint
echo "3. Testing GraphQL endpoint..."
curl -f -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}' || {
    echo "❌ GraphQL check failed"
    kill $APP_PID
    exit 1
}

# REST API endpoint
echo "4. Testing REST API..."
curl -f http://localhost:3000/api || {
    echo "❌ REST API check failed"
    kill $APP_PID
    exit 1
}

kill $APP_PID

# Database connectivity
echo "5. Testing database connectivity..."
npm run migration:status || {
    echo "❌ Database connectivity failed"
    exit 1
}

# Test suites
echo "6. Running test suites..."
npm test || {
    echo "❌ Unit tests failed"
    exit 1
}

npm run test:e2e || {
    echo "❌ E2E tests failed"
    exit 1
}

echo "✅ All health checks passed!"
```

---

## Risk Mitigation

### Automated Testing Before Each Phase

```bash
# Pre-phase validation script
#!/bin/bash

PHASE=$1

echo "🧪 Running pre-phase $PHASE validation..."

# Current state validation
npm run build || exit 1
npm test || exit 1
npm run test:e2e || exit 1
npm run lint || exit 1
npm run deps:validate || exit 1

# Create checkpoint
git add .
git commit -m "checkpoint: before phase $PHASE upgrades" || true
git tag "checkpoint-phase-$PHASE-$(date +%Y%m%d-%H%M%S)"

echo "✅ Pre-phase validation complete"
```

### Continuous Integration Integration

```yaml
# .github/workflows/upgrade-validation.yml
name: Upgrade Validation

on:
  push:
    branches: [ 'upgrade/**' ]
  pull_request:
    branches: [ 'upgrade/**' ]

jobs:
  validate-upgrade:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [24.x]

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run build
      run: npm run build

    - name: Run unit tests
      run: npm run test:cov

    - name: Run database tests
      run: npm run test:database
      env:
        DB_HOST: localhost
        DB_PORT: 5432
        DB_USERNAME: postgres
        DB_PASSWORD: postgres
        DB_DATABASE: test_db

    - name: Run e2e tests
      run: npm run test:e2e
      env:
        DB_HOST: localhost
        DB_PORT: 5432
        DB_USERNAME: postgres
        DB_PASSWORD: postgres
        DB_DATABASE: test_db

    - name: Validate dependencies
      run: npm run deps:validate

    - name: Check for vulnerabilities
      run: npm audit --audit-level=high
```

---

## Timeline & Milestones

### Week 1: Phase 1 (Safe Updates)
- **Monday**: Execute Phase 1 upgrades
- **Tuesday**: Monitor for issues, performance validation
- **Wednesday**: Team review and sign-off
- **Thursday-Friday**: Buffer time for any issues

### Week 2: Phase 2 (NestJS Authentication)
- **Monday**: Research and prepare breaking changes
- **Tuesday**: Execute @nestjs/config upgrade
- **Wednesday**: Execute @nestjs/jwt and @nestjs/passport upgrades
- **Thursday**: Comprehensive testing and validation
- **Friday**: Code review and team validation

### Week 3: Phase 3 (Security & Testing)
- **Monday**: Execute bcrypt upgrade
- **Tuesday**: Execute jsdom upgrade
- **Wednesday**: Final integration testing
- **Thursday**: Performance and security validation
- **Friday**: Documentation and project completion

### Success Metrics

1. **Functional Metrics**
   - [ ] 100% test suite pass rate maintained
   - [ ] All critical user flows working
   - [ ] No degradation in API response times
   - [ ] Database operations working correctly

2. **Security Metrics**
   - [ ] No new security vulnerabilities introduced
   - [ ] Password hashing working with bcrypt v6
   - [ ] JWT authentication working correctly
   - [ ] Input sanitization working correctly

3. **Performance Metrics**
   - [ ] Application startup time unchanged (±10%)
   - [ ] API response times unchanged (±10%)
   - [ ] Memory usage unchanged (±15%)
   - [ ] Bundle size unchanged (±5%)

---

*Upgrade plan generated on 2025-09-21*