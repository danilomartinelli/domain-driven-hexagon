# Migration Guides for Major Dependency Updates

## Overview

This document provides step-by-step migration guides for major dependency updates that require careful attention and potential code changes.

---

## 1. NestJS Authentication Stack Upgrade

### @nestjs/config: 3.2.3 → 4.0.2

**Estimated time**: 2-4 hours
**Risk level**: Medium
**Breaking changes**: Configuration loading and type definitions

#### Pre-Migration Checklist

- [ ] Current test suite passing
- [ ] Git commit point created
- [ ] Review current ConfigService usage
- [ ] Document custom configuration patterns

#### Migration Steps

##### Step 1: Update Dependencies

```bash
# Create upgrade branch
git checkout -b upgrade/nestjs-config-v4

# Update the package
npm install @nestjs/config@4.0.2
```

##### Step 2: Review Configuration Changes

**Key Changes in v4.0.0:**
- Enhanced TypeScript support for configuration schemas
- Improved environment variable validation
- Updated configuration loading behavior
- New configuration factory patterns

##### Step 3: Update Configuration Files

**Before (v3.x):**
```typescript
// src/configs/app.config.ts
import { ConfigService } from '@nestjs/config';

export const getAppConfig = (configService: ConfigService) => ({
  port: configService.get<number>('PORT', 3000),
  environment: configService.get<string>('NODE_ENV', 'development'),
});
```

**After (v4.x):**
```typescript
// src/configs/app.config.ts
import { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || 'development',
}));

// Updated usage pattern
export const getAppConfig = (configService: ConfigService) =>
  configService.get('app');
```

##### Step 4: Update Module Registration

**Review and update in:**
- `src/app.module.ts`
- Any feature modules using ConfigModule

```typescript
// Update ConfigModule registration if needed
ConfigModule.forRoot({
  isGlobal: true,
  load: [appConfig], // Use new registerAs pattern
  validationSchema: configValidationSchema,
  validationOptions: {
    allowUnknown: true,
    abortEarly: true,
  },
})
```

##### Step 5: Test & Verify

```bash
# Type checking
npm run build

# Run tests
npm test

# Run specific config tests
npm test -- --testNamePattern="config"

# Check environment variable loading
npm run start:dev
```

---

### @nestjs/jwt: 10.2.0 → 11.0.0

**Estimated time**: 1-2 hours
**Risk level**: Medium
**Breaking changes**: JWT strategy configuration and type definitions

#### Migration Steps

##### Step 1: Update Package

```bash
npm install @nestjs/jwt@11.0.0
```

##### Step 2: Review JWT Configuration Changes

**Key Changes in v11.0.0:**
- Updated JWT strategy registration
- Enhanced type safety for JWT payload
- Improved token verification options

##### Step 3: Update JWT Configuration

**Check and update in:**
- `src/modules/user/infrastructure/strategies/jwt.strategy.ts`
- `src/modules/user/user.module.ts`

**Before (v10.x):**
```typescript
// JWT Strategy
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

**After (v11.x):**
```typescript
// JWT Strategy - Enhanced type safety
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

##### Step 4: Create JWT Payload Interface

```typescript
// src/modules/user/infrastructure/types/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
```

##### Step 5: Test JWT Functionality

```bash
# Test authentication endpoints
npm run test:e2e -- --testNamePattern="auth"

# Manual testing
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

### @nestjs/passport: 10.0.3 → 11.0.5

**Estimated time**: 1-2 hours
**Risk level**: Medium
**Breaking changes**: Passport strategy registration and guard behavior

#### Migration Steps

##### Step 1: Update Package

```bash
npm install @nestjs/passport@11.0.5
```

##### Step 2: Review Passport Changes

**Key Changes in v11.x:**
- Updated strategy registration patterns
- Enhanced guard behavior
- Improved session handling

##### Step 3: Update Authentication Guards

**Check and update:**
- `src/modules/user/infrastructure/guards/jwt-auth.guard.ts`
- `src/modules/user/infrastructure/guards/local-auth.guard.ts`

**Verify guards still work correctly:**
```typescript
// src/modules/user/infrastructure/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

##### Step 4: Test Authentication Flow

```bash
# Run authentication tests
npm test -- --testNamePattern="auth"

# Test protected endpoints
npm run test:e2e -- --testNamePattern="protected"
```

---

## 2. Security & Testing Stack Upgrades

### bcrypt: 5.1.1 → 6.0.0

**Estimated time**: 30 minutes
**Risk level**: Medium
**Breaking changes**: API signatures and Node.js requirements

#### Migration Steps

##### Step 1: Verify Node.js Compatibility

```bash
# Check Node.js version (requires 18+)
node --version  # Should show v24.3.0 ✅
```

##### Step 2: Update Package

```bash
npm install bcrypt@6.0.0
npm install @types/bcrypt@latest
```

##### Step 3: Test Password Hashing

**Verify in:**
- `src/modules/user/domain/value-objects/password.value-object.ts`
- `src/modules/user/infrastructure/repositories/user.repository.ts`

```bash
# Test password functionality
npm test -- --testNamePattern="password"

# Test user creation/authentication
npm test -- --testNamePattern="user.*auth"
```

---

### jsdom: 26.1.0 → 27.0.0

**Estimated time**: 30 minutes
**Risk level**: Medium
**Breaking changes**: DOM API behavior and test environment

#### Migration Steps

##### Step 1: Update Package

```bash
npm install jsdom@27.0.0
npm install @types/jsdom@latest
```

##### Step 2: Verify Test Environment

**Check test configurations:**
- `.jestrc.json`
- `jest-e2e.json`
- `jest-database.json`

##### Step 3: Test DOM Manipulation

```bash
# Run all tests to verify DOM functionality
npm test

# Run specific DOM-related tests
npm test -- --testNamePattern="dom|sanitizer"
```

---

## 3. Complete Upgrade Testing Strategy

### Pre-Upgrade Tests

```bash
# Create comprehensive test baseline
npm run test:cov > test-baseline-before.txt
npm run test:e2e > e2e-baseline-before.txt
npm run build > build-baseline-before.txt
```

### Post-Upgrade Validation

```bash
# Comprehensive test suite
npm run test:cov
npm run test:e2e
npm run test:database
npm run build

# Performance validation
npm run start:dev &
sleep 10
curl -w "@curl-format.txt" -s http://localhost:3000/health
pkill -f "nest start"

# Architecture validation
npm run deps:validate
```

### Integration Test Checklist

- [ ] User registration works
- [ ] User authentication works
- [ ] JWT token generation/validation works
- [ ] Password hashing/verification works
- [ ] Configuration loading works
- [ ] Database connections work
- [ ] GraphQL schema generation works
- [ ] REST API endpoints work
- [ ] Validation and sanitization work
- [ ] Error handling works

---

## 4. Rollback Procedures

### Quick Rollback

```bash
# Restore from backup
git checkout HEAD~1 -- package.json package-lock.json
npm ci

# Or use git reset
git reset --hard HEAD~1
```

### Selective Rollback

```bash
# Rollback specific packages
npm install @nestjs/config@3.2.3
npm install @nestjs/jwt@10.2.0
npm install @nestjs/passport@10.0.3
npm install bcrypt@5.1.1
npm install jsdom@26.1.0
```

### Verify Rollback

```bash
# Run full test suite
npm test
npm run test:e2e

# Verify application starts
npm run start:dev
```

---

## 5. Common Issues & Solutions

### @nestjs/config v4 Issues

**Issue**: Configuration not loading properly
**Solution**:
```typescript
// Ensure proper registerAs usage
export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
}));
```

**Issue**: Type errors with ConfigService
**Solution**:
```typescript
// Use proper typing
const dbConfig = this.configService.get<DatabaseConfig>('database');
```

### @nestjs/jwt v11 Issues

**Issue**: JWT strategy not working
**Solution**: Verify passport-jwt compatibility and update strategy registration

### bcrypt v6 Issues

**Issue**: Hash comparison failing
**Solution**: Ensure same salt rounds and verify Node.js version compatibility

### jsdom v27 Issues

**Issue**: Tests failing due to DOM API changes
**Solution**: Update DOM manipulation code to use v27 APIs

---

## 6. Resources

- [NestJS Config v4 Migration Guide](https://docs.nestjs.com/techniques/configuration#migration)
- [NestJS JWT v11 Changelog](https://github.com/nestjs/jwt/releases/tag/v11.0.0)
- [NestJS Passport v11 Changelog](https://github.com/nestjs/passport/releases/tag/v11.0.0)
- [bcrypt v6 Release Notes](https://github.com/kelektiv/node.bcrypt.js/releases/tag/v6.0.0)
- [jsdom v27 Release Notes](https://github.com/jsdom/jsdom/releases/tag/v27.0.0)

---

*Migration guides generated on 2025-09-21*