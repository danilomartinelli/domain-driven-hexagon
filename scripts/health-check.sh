#!/bin/bash

echo "🏥 Running comprehensive health check..."

# Function to cleanup on exit
cleanup() {
    if [ ! -z "$APP_PID" ]; then
        echo "🧹 Cleaning up application process..."
        kill $APP_PID 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Application startup
echo "1. Testing application startup..."
npm run start:dev &
APP_PID=$!
echo "📱 Application started with PID: $APP_PID"

# Wait for app to start
echo "⏳ Waiting for application to start..."
sleep 15

# Check if process is still running
if ! kill -0 $APP_PID 2>/dev/null; then
    echo "❌ Application failed to start"
    exit 1
fi

# Health endpoint
echo "2. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response.json http://localhost:3000/health)
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Health check failed with HTTP code: $HTTP_CODE"
    cat /tmp/health_response.json
    exit 1
fi

echo "✅ Health endpoint responding correctly"

# GraphQL endpoint
echo "3. Testing GraphQL endpoint..."
GRAPHQL_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}' \
  -o /tmp/graphql_response.json)
HTTP_CODE="${GRAPHQL_RESPONSE: -3}"

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GraphQL check failed with HTTP code: $HTTP_CODE"
    cat /tmp/graphql_response.json
    exit 1
fi

echo "✅ GraphQL endpoint responding correctly"

# REST API endpoint
echo "4. Testing REST API..."
API_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/api_response.json http://localhost:3000/api)
HTTP_CODE="${API_RESPONSE: -3}"

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "404" ]; then
    echo "❌ REST API check failed with HTTP code: $HTTP_CODE"
    cat /tmp/api_response.json
    exit 1
fi

echo "✅ REST API endpoint responding correctly"

# Performance metrics
echo "5. Measuring response times..."

# Health endpoint performance
HEALTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health)
echo "📊 Health endpoint response time: ${HEALTH_TIME}s"

# GraphQL performance
GRAPHQL_TIME=$(curl -w "%{time_total}" -s -o /dev/null -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}')
echo "📊 GraphQL response time: ${GRAPHQL_TIME}s"

# Cleanup application
echo "6. Stopping application..."
kill $APP_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true
APP_PID=""

# Database connectivity
echo "7. Testing database connectivity..."
if ! npm run migration:status > /dev/null 2>&1; then
    echo "❌ Database connectivity failed"
    exit 1
fi

echo "✅ Database connectivity verified"

# Test suites
echo "8. Running critical test suites..."

# Unit tests
echo "8a. Running unit tests..."
if ! npm test > /tmp/unit_test_output.log 2>&1; then
    echo "❌ Unit tests failed"
    echo "Last 10 lines of unit test output:"
    tail -10 /tmp/unit_test_output.log
    exit 1
fi

echo "✅ Unit tests passed"

# Database tests
echo "8b. Running database tests..."
if ! npm run test:database > /tmp/db_test_output.log 2>&1; then
    echo "❌ Database tests failed"
    echo "Last 10 lines of database test output:"
    tail -10 /tmp/db_test_output.log
    exit 1
fi

echo "✅ Database tests passed"

# E2E tests
echo "8c. Running E2E tests..."
if ! npm run test:e2e > /tmp/e2e_test_output.log 2>&1; then
    echo "❌ E2E tests failed"
    echo "Last 10 lines of E2E test output:"
    tail -10 /tmp/e2e_test_output.log
    exit 1
fi

echo "✅ E2E tests passed"

# Build verification
echo "9. Verifying build process..."
if ! npm run build > /tmp/build_output.log 2>&1; then
    echo "❌ Build process failed"
    echo "Last 10 lines of build output:"
    tail -10 /tmp/build_output.log
    exit 1
fi

echo "✅ Build process verified"

# Linting verification
echo "10. Verifying code quality..."
if ! npm run lint > /tmp/lint_output.log 2>&1; then
    echo "❌ Linting failed"
    echo "Last 10 lines of lint output:"
    tail -10 /tmp/lint_output.log
    exit 1
fi

echo "✅ Code quality verified"

# Dependency architecture validation
echo "11. Validating dependency architecture..."
if ! npm run deps:validate > /tmp/deps_output.log 2>&1; then
    echo "❌ Dependency validation failed"
    echo "Last 10 lines of dependency validation output:"
    tail -10 /tmp/deps_output.log
    exit 1
fi

echo "✅ Dependency architecture validated"

# Security audit
echo "12. Running security audit..."
if ! npm audit --audit-level=high > /tmp/audit_output.log 2>&1; then
    echo "⚠️  Security audit found issues"
    echo "Audit output:"
    cat /tmp/audit_output.log
    echo "🔍 Review security issues above"
else
    echo "✅ No high-severity security vulnerabilities found"
fi

# Memory and performance check
echo "13. Checking system resources..."
echo "📊 Memory usage:"
free -h 2>/dev/null || vm_stat | head -5

echo "📊 Disk usage:"
df -h . | tail -1

# Generate summary
echo ""
echo "==================================="
echo "🎉 HEALTH CHECK SUMMARY"
echo "==================================="
echo "✅ Application startup: PASSED"
echo "✅ Health endpoint: PASSED"
echo "✅ GraphQL endpoint: PASSED"
echo "✅ REST API endpoint: PASSED"
echo "✅ Database connectivity: PASSED"
echo "✅ Unit tests: PASSED"
echo "✅ Database tests: PASSED"
echo "✅ E2E tests: PASSED"
echo "✅ Build process: PASSED"
echo "✅ Code quality: PASSED"
echo "✅ Dependency architecture: PASSED"
echo ""
echo "📊 Performance Metrics:"
echo "   - Health endpoint: ${HEALTH_TIME}s"
echo "   - GraphQL endpoint: ${GRAPHQL_TIME}s"
echo ""
echo "🎯 All health checks PASSED!"

# Cleanup temp files
rm -f /tmp/health_response.json /tmp/graphql_response.json /tmp/api_response.json
rm -f /tmp/unit_test_output.log /tmp/db_test_output.log /tmp/e2e_test_output.log
rm -f /tmp/build_output.log /tmp/lint_output.log /tmp/deps_output.log /tmp/audit_output.log

echo "✅ Health check completed successfully!"