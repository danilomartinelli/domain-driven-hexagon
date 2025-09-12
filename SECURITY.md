# Security Implementation Guide

## Overview

This project implements comprehensive security enhancements based on OWASP recommendations and industry best practices. The security implementation addresses critical vulnerabilities and provides a robust defense-in-depth approach.

## Security Features Implemented

### 🔐 Core Security Modules

1. **Environment Variable Security (`EnvValidatorService`)**
   - Validates environment variables on startup
   - Detects weak passwords and default values
   - Prevents application startup with invalid configuration
   - Masks sensitive values in logs

2. **Input Sanitization (`InputSanitizerService`)**
   - HTML sanitization using DOMPurify
   - XSS prevention with pattern detection
   - SQL injection pattern filtering
   - Recursive object sanitization
   - Field-specific sanitization (email, URL, etc.)

3. **Security Headers (`SecurityService`)**
   - OWASP-compliant Helmet configuration
   - Content Security Policy (CSP)
   - HTTP Strict Transport Security (HSTS)
   - X-Frame-Options, X-XSS-Protection
   - Custom security headers

4. **Rate Limiting**
   - Multiple rate limiting strategies
   - Endpoint-specific limits
   - IP-based and user-based limiting
   - Predefined decorators for common use cases

5. **Security Logging (`SecurityLogger`)**
   - Centralized security event logging
   - Threat pattern detection
   - IP reputation scoring
   - Real-time security monitoring
   - Automated threat response

## Critical Vulnerabilities Fixed

### 1. SQL Injection Prevention ✅

**Issue:** Raw SQL execution in migration service
**Location:** `src/libs/database/database-migration.service.ts`

**Fix Implemented:**
- Enhanced SQL validation with injection pattern detection
- Proper use of `sql.unsafe` with pre-validation
- Comprehensive SQL pattern blacklisting
- Structure validation for SQL syntax

```typescript
// Before (VULNERABLE)
await (connection as any).query(upContent);

// After (SECURE)
this.validateMigrationSql(upContent);
await connection.query(sql.unsafe`${upContent}`);
```

### 2. Information Disclosure Prevention ✅

**Issue:** Sensitive information in error messages and logs
**Location:** `src/libs/db/sql-repository.base.ts`

**Fix Implemented:**
- Production-safe error message sanitization
- Stack trace cleaning and path redaction
- Sensitive data pattern removal
- Secure debug logging for production

```typescript
// Enhanced error handling with sanitization
private sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgresql:\/\/[^@]+@[^/]+\/\w+/gi, 'postgresql://[REDACTED]')
    .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]')
    .substring(0, 500);
}
```

### 3. Security Headers Implementation ✅

**Issue:** Missing OWASP-recommended security headers

**Fix Implemented:**
- Complete Helmet configuration with CSP
- Environment-specific security policies
- CORS protection with origin validation
- Custom security headers for API protection

### 4. XSS Prevention ✅

**Issue:** Insufficient input sanitization

**Fix Implemented:**
- DOMPurify integration for HTML sanitization
- XSS pattern detection and blocking
- Recursive object sanitization
- Field-specific validation rules

## Usage Examples

### Rate Limiting Decorators

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @AuthRateLimit() // 5 requests per minute
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('reset-password')
  @PasswordResetRateLimit() // 3 requests per 15 minutes
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto);
  }
}
```

### Input Sanitization

```typescript
@Injectable()
export class UserService {
  constructor(private sanitizer: InputSanitizerService) {}

  async updateProfile(data: UpdateProfileDto) {
    // Automatically sanitizes all string fields
    const cleanData = this.sanitizer.sanitizeObject(data);
    return this.userRepository.update(cleanData);
  }
}
```

### Security Event Logging

```typescript
// Automatic security event logging
this.securityLogger.logSecurityEvent({
  type: 'AUTH_FAILURE',
  severity: 'MEDIUM',
  details: {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    failedEmail: email,
  },
  timestamp: new Date(),
});
```

## Environment Configuration

### Required Environment Variables

```bash
# Database (Required)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_secure_password
DB_NAME=your_database

# Security (Optional but recommended)
JWT_SECRET=your_jwt_secret_min_32_chars
ENCRYPTION_KEY=your_encryption_key_min_32_chars

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Production Security Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong passwords (12+ characters)
- [ ] `DB_SSL=true` with valid certificates
- [ ] Proper `CORS_ORIGIN` (not localhost)
- [ ] `LOG_LEVEL=warn` or `error`
- [ ] Secrets in secure management system
- [ ] Regular secret rotation schedule
- [ ] Database user with minimal permissions
- [ ] Network access restrictions
- [ ] Monitoring and alerting configured

## Security Monitoring

### Real-time Threat Detection

The system automatically detects and responds to:
- Multiple authentication failures (brute force)
- SQL injection attempts
- XSS attack patterns
- Unusual request patterns
- Rate limit violations
- Suspicious User-Agent strings

### Security Metrics

Access security metrics via the `SecurityLogger`:

```typescript
const metrics = securityLogger.getSecurityMetrics();
// Returns: events24h, critical24h, uniqueIps24h, topThreats, etc.
```

## Testing Security Features

### 1. Test Rate Limiting

```bash
# Test auth rate limiting (should block after 5 requests)
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}';
done
```

### 2. Test Input Sanitization

```bash
# Test XSS prevention
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"message":"<script>alert(\"xss\")</script>Hello"}'
```

### 3. Test SQL Injection Protection

```bash
# Test SQL injection in URL parameters
curl "http://localhost:3000/api/users?search=' OR 1=1--"
```

## Best Practices

### Development
1. Always use rate limiting decorators on public endpoints
2. Sanitize all user input using `InputSanitizerService`
3. Never log sensitive information (use sanitization)
4. Test security features regularly
5. Keep security dependencies updated

### Production
1. Use external secret management (AWS Secrets Manager, etc.)
2. Enable SSL/TLS for all connections
3. Monitor security logs actively
4. Set up automated alerts for critical events
5. Perform regular security audits
6. Keep database and application updated

### Code Review Security Checklist
- [ ] No hardcoded secrets or passwords
- [ ] All user inputs properly validated and sanitized
- [ ] Appropriate rate limiting applied
- [ ] Error messages don't expose sensitive information
- [ ] SQL queries use parameterized statements
- [ ] Authentication and authorization properly implemented
- [ ] Security headers configured
- [ ] Logging follows security guidelines

## Compliance

This implementation addresses:
- **OWASP Top 10 2021**
- **Common Weakness Enumeration (CWE)**
- **NIST Cybersecurity Framework**
- **ISO 27001 principles**

## Support

For security-related questions or to report vulnerabilities:
1. Check this documentation first
2. Review the code examples
3. Test in development environment
4. Create an issue with security label (for non-sensitive issues)
5. For sensitive security issues, contact maintainers directly

## License

This security implementation is part of the Domain-Driven Hexagon project and follows the same MIT license terms.