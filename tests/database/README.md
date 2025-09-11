# Database Layer Test Suite

This comprehensive test suite verifies the database layer functionality before and after modernization of the Slonik and migration components.

## Test Coverage

### 1. Connection Management (`slonik-connection.spec.ts`)
- Database pool creation and configuration
- Connection timeout handling
- Transaction management and isolation
- Connection pool resilience and recovery
- SQL injection protection
- Concurrent connection handling

### 2. Repository Pattern (`sql-repository-base.spec.ts`)
- CRUD operations through repository base class
- Entity validation and mapping
- Pagination and querying
- Transaction support at repository level
- Domain event publishing
- Error handling in repository operations

### 3. Migration System (`migration-system.spec.ts`)
- Migration execution and tracking
- Rollback functionality
- Migration error handling
- Environment-specific configurations
- Concurrent migration safety
- Migration status queries

### 4. Query Execution (`query-execution-mapping.spec.ts`)
- Type-safe query execution
- Result mapping and validation
- Complex queries (JOINs, aggregations)
- Array and JSON operations
- Pagination implementations
- Performance characteristics

### 5. Error Handling (`error-handling.spec.ts`)
- Connection errors and recovery
- Constraint violations
- Transaction rollback scenarios
- Data validation errors
- Resource management
- Graceful error recovery

### 6. Integration Tests (`integration-comprehensive.spec.ts`)
- End-to-end workflow testing
- Complex business logic scenarios
- Performance under load
- Concurrent operation safety
- Schema evolution compatibility
- Migration rollback scenarios

## Running the Tests

### All Database Tests
```bash
npm run test -- --config jest-database.json
```

### Individual Test Files
```bash
# Connection tests
npm test tests/database/slonik-connection.spec.ts

# Repository tests
npm test tests/database/sql-repository-base.spec.ts

# Migration tests
npm test tests/database/migration-system.spec.ts

# Query execution tests
npm test tests/database/query-execution-mapping.spec.ts

# Error handling tests
npm test tests/database/error-handling.spec.ts

# Comprehensive integration tests
npm test tests/database/integration-comprehensive.spec.ts
```

### With Coverage
```bash
npm run test:cov -- --config jest-database.json
```

## Prerequisites

1. **Test Database**: Ensure you have a test database configured
   - Database name must contain "test" (enforced by jestGlobalSetup.ts)
   - Configure via `.env.test` file

2. **Environment Variables**:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=test_user
   DB_PASSWORD=test_password
   DB_NAME=test_db
   NODE_ENV=test
   ```

3. **Database Setup**:
   ```bash
   # Start test database
   npm run docker:env

   # Run migrations for test
   npm run migration:up:tests
   ```

## Test Architecture

### Test Structure
```
tests/database/
├── slonik-connection.spec.ts      # Connection and pooling tests
├── sql-repository-base.spec.ts    # Repository pattern tests
├── migration-system.spec.ts       # Migration system tests
├── query-execution-mapping.spec.ts # Query and mapping tests
├── error-handling.spec.ts         # Error scenarios
├── integration-comprehensive.spec.ts # End-to-end integration
└── README.md                      # This file
```

### Key Testing Patterns

1. **Isolation**: Each test file manages its own database state
2. **Cleanup**: Proper cleanup in `beforeEach`/`afterEach` hooks
3. **Real Database**: Tests run against actual PostgreSQL (not mocks)
4. **Type Safety**: Full TypeScript and Zod schema validation
5. **Performance**: Tests include timing assertions for critical operations

### Test Data Management

- Tests create their own tables to avoid conflicts
- All test tables are prefixed with `test_` or include `test` in the name
- Comprehensive cleanup ensures no test pollution
- Test migrations are isolated from production migrations

## Modernization Strategy

These tests serve as a regression test suite during modernization:

1. **Before Modernization**: Run full test suite to establish baseline
2. **During Modernization**: Run tests frequently to catch breaking changes
3. **After Modernization**: Verify all tests still pass with new implementation

### Key Areas to Monitor

- **Connection Management**: Ensure pool behavior remains consistent
- **Transaction Handling**: Verify transaction isolation and rollback
- **Query Type Safety**: Maintain schema validation and type checking
- **Migration Compatibility**: Ensure migration system continues to work
- **Error Handling**: Verify error scenarios are handled gracefully
- **Performance**: Monitor query execution times and resource usage

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify test database is running
   - Check environment variables
   - Ensure database name contains "test"

2. **Migration Errors**:
   - Clean migration table: `TRUNCATE migration;`
   - Reset test database schema
   - Check migration file permissions

3. **Test Timeouts**:
   - Increase timeout in jest configuration
   - Check for deadlocks in concurrent tests
   - Verify database performance

4. **Schema Validation Errors**:
   - Verify Zod schemas match database schema
   - Check for type mismatches
   - Validate test data

### Debug Mode

Run tests with debug output:
```bash
DEBUG=* npm test tests/database/
```

## Future Enhancements

- [ ] Add performance benchmarking
- [ ] Include stress testing scenarios
- [ ] Add database version compatibility tests
- [ ] Implement snapshot testing for query results
- [ ] Add monitoring and metrics collection