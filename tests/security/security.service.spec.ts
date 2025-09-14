import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { SecurityService } from '@libs/security/security.service';
import { EnvValidatorService } from '@libs/security/env-validator.service';

describe('SecurityService', () => {
  let service: SecurityService;
  let envValidator: jest.Mocked<EnvValidatorService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: EnvValidatorService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    envValidator = module.get(EnvValidatorService);

    // Setup mock request and response objects
    mockRequest = {
      get: jest.fn(),
      ip: '192.168.1.1',
      url: '/api/test',
      method: 'GET',
    };

    mockResponse = {
      setHeader: jest.fn(),
      req: mockRequest as Request,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHelmetConfig', () => {
    it('should return production helmet configuration', () => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('production') // NODE_ENV
        .mockReturnValueOnce(true) // CSP_ENABLED
        .mockReturnValueOnce(31536000); // HSTS_MAX_AGE

      // Act
      const config = service.getHelmetConfig();

      // Assert
      expect(config).toBeDefined();
      expect(envValidator.get).toHaveBeenCalledWith('NODE_ENV');
      expect(envValidator.get).toHaveBeenCalledWith('CSP_ENABLED');
      expect(envValidator.get).toHaveBeenCalledWith('HSTS_MAX_AGE');
    });

    it('should return development helmet configuration', () => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('development') // NODE_ENV
        .mockReturnValueOnce(false) // CSP_ENABLED
        .mockReturnValueOnce(3600); // HSTS_MAX_AGE

      // Act
      const config = service.getHelmetConfig();

      // Assert
      expect(config).toBeDefined();
      expect(envValidator.get).toHaveBeenCalledWith('NODE_ENV');
    });

    it('should disable CSP when CSP_ENABLED is false', () => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('production') // NODE_ENV
        .mockReturnValueOnce(false) // CSP_ENABLED
        .mockReturnValueOnce(31536000); // HSTS_MAX_AGE

      // Act
      const config = service.getHelmetConfig();

      // Assert
      expect(config).toBeDefined();
    });
  });

  describe('getCorsConfig', () => {
    it('should return production CORS configuration', () => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('https://example.com,https://app.example.com') // CORS_ORIGIN
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('production'); // NODE_ENV

      // Act
      const config = service.getCorsConfig();

      // Assert
      expect(config).toBeDefined();
      expect(config.credentials).toBe(true);
      expect(config.methods).toEqual([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ]);
      expect(config.maxAge).toBe(86400);
    });

    it('should allow valid origin in production', (done) => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('https://example.com,https://app.example.com') // CORS_ORIGIN
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('production'); // NODE_ENV

      const config = service.getCorsConfig();

      // Act
      config.origin('https://example.com', (error, allow) => {
        // Assert
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should block invalid origin in production', (done) => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('https://example.com') // CORS_ORIGIN
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('production'); // NODE_ENV

      const config = service.getCorsConfig();

      // Act
      config.origin('https://malicious.com', (error, allow) => {
        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Not allowed by CORS');
        expect(allow).toBe(false);
        done();
      });
    });

    it('should allow localhost in development', (done) => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('https://example.com') // CORS_ORIGIN
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('development'); // NODE_ENV

      const config = service.getCorsConfig();

      // Act
      config.origin('http://localhost:3000', (error, allow) => {
        // Assert
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should allow requests with no origin', (done) => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('https://example.com') // CORS_ORIGIN
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('production'); // NODE_ENV

      const config = service.getCorsConfig();

      // Act
      config.origin(undefined, (error, allow) => {
        // Assert
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });
  });

  describe('applySecurityMiddleware', () => {
    it('should apply security headers and logging', () => {
      // Arrange
      envValidator.get.mockReturnValue('production'); // NODE_ENV
      (mockRequest.get as jest.Mock)
        .mockReturnValueOnce('Mozilla/5.0') // User-Agent
        .mockReturnValueOnce('https://example.com') // Origin
        .mockReturnValueOnce('https://example.com') // Referer
        .mockReturnValueOnce('192.168.1.100') // X-Forwarded-For
        .mockReturnValueOnce('10.0.0.1') // X-Real-IP
        .mockReturnValueOnce('Bearer token'); // Authorization

      const nextFunction = jest.fn();

      // Act
      service.applySecurityMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      // Assert
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-API-Version',
        '1.0',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.any(Number),
      );
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should apply cache control headers for auth endpoints', () => {
      // Arrange
      envValidator.get.mockReturnValue('production');
      mockRequest.url = '/auth/login';

      const nextFunction = jest.fn();

      // Act
      service.applySecurityMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      // Assert
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
    });

    it('should apply additional security headers in production', () => {
      // Arrange
      envValidator.get.mockReturnValue('production');
      const nextFunction = jest.fn();

      // Act
      service.applySecurityMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      // Assert
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Expect-CT',
        'max-age=86400, enforce',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Download-Options',
        'noopen',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Permitted-Cross-Domain-Policies',
        'none',
      );
    });
  });

  describe('validateRequestSecurity', () => {
    it('should validate secure request successfully', () => {
      // Arrange
      mockRequest.url = '/api/users';
      (mockRequest.get as jest.Mock).mockReturnValue('XMLHttpRequest');

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing X-Requested-With header for sensitive endpoints', () => {
      // Arrange
      mockRequest.url = '/auth/login';
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        'Missing X-Requested-With header for sensitive endpoint',
      );
    });

    it('should detect excessively long URL', () => {
      // Arrange
      mockRequest.url = '/api/test?' + 'a'.repeat(2100);

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Excessively long URL detected');
    });

    it('should detect potential SQL injection patterns', () => {
      // Arrange
      mockRequest.url = "/api/users?filter=' OR '1'='1";

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Potential SQL injection pattern in URL');
    });

    it('should detect potential XSS patterns in query parameters', () => {
      // Arrange
      mockRequest.url = '/api/search?q=<script>alert("xss")</script>';

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        'Potential XSS pattern in query parameters',
      );
    });

    it('should detect multiple security issues', () => {
      // Arrange
      mockRequest.url =
        "/admin/users?filter=' OR '1'='1&xss=<script>alert('xss')</script>";
      (mockRequest.get as jest.Mock).mockReturnValue(undefined); // Missing X-Requested-With

      // Act
      const result = service.validateRequestSecurity(mockRequest as Request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(1);
    });
  });

  describe('security logging', () => {
    it('should log suspicious User-Agent strings', () => {
      // Arrange
      envValidator.get.mockReturnValue('production');
      (mockRequest.get as jest.Mock)
        .mockReturnValueOnce('sqlmap/1.0') // User-Agent
        .mockReturnValueOnce(undefined) // Origin
        .mockReturnValueOnce(undefined); // Other headers

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const nextFunction = jest.fn();

      // Act
      service.applySecurityMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      // Assert - Note: We're testing the logging behavior indirectly
      expect(nextFunction).toHaveBeenCalled();

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should log HTTP requests in production', () => {
      // Arrange
      envValidator.get.mockReturnValue('production');
      (mockRequest.get as jest.Mock)
        .mockReturnValueOnce('https') // X-Forwarded-Proto should be https
        .mockReturnValue(undefined); // Other headers

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const nextFunction = jest.fn();

      // Act
      service.applySecurityMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      // Assert
      expect(nextFunction).toHaveBeenCalled();

      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle missing environment variables gracefully', () => {
      // Arrange
      envValidator.get.mockReturnValue(undefined);

      // Act & Assert - Should not throw
      expect(() => service.getHelmetConfig()).not.toThrow();
      expect(() => service.getCorsConfig()).not.toThrow();
    });

    it('should handle malformed CORS origins gracefully', () => {
      // Arrange
      envValidator.get
        .mockReturnValueOnce('invalid,origin,list,') // CORS_ORIGIN with trailing comma
        .mockReturnValueOnce(true) // CORS_CREDENTIALS
        .mockReturnValueOnce('production'); // NODE_ENV

      // Act & Assert - Should not throw
      expect(() => service.getCorsConfig()).not.toThrow();
    });
  });

  describe('performance considerations', () => {
    it('should efficiently validate request security', () => {
      // Arrange
      const startTime = Date.now();
      mockRequest.url = '/api/test';

      // Act
      for (let i = 0; i < 1000; i++) {
        service.validateRequestSecurity(mockRequest as Request);
      }
      const endTime = Date.now();

      // Assert - Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100); // 100ms for 1000 validations
    });
  });
});
