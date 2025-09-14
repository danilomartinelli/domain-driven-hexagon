import { Test, TestingModule } from '@nestjs/testing';
import { InputSanitizerService } from '@libs/security/input-sanitizer.service';

describe('InputSanitizerService', () => {
  let service: InputSanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputSanitizerService],
    }).compile();

    service = module.get<InputSanitizerService>(InputSanitizerService);
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      // Arrange
      const maliciousInput =
        '<script>alert("xss")</script><p>Valid content</p>';

      // Act
      const result = service.sanitizeHtml(maliciousInput);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("xss")');
      expect(result).toContain('<p>Valid content</p>');
    });

    it('should remove javascript: URLs', () => {
      // Arrange
      const maliciousInput = '<a href="javascript:alert(\'xss\')">Click me</a>';

      // Act
      const result = service.sanitizeHtml(maliciousInput);

      // Assert
      expect(result).not.toContain('javascript:');
      expect(result).toContain('<a>Click me</a>');
    });

    it('should remove on-event handlers', () => {
      // Arrange
      const maliciousInput =
        '<img src="image.jpg" onerror="alert(\'xss\')" onload="malicious()" />';

      // Act
      const result = service.sanitizeHtml(maliciousInput);

      // Assert
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
      expect(result).toContain('<img src="image.jpg" />');
    });

    it('should preserve safe HTML tags and attributes', () => {
      // Arrange
      const safeInput =
        '<p><strong>Bold text</strong> and <em>italic text</em></p><ul><li>List item</li></ul>';

      // Act
      const result = service.sanitizeHtml(safeInput);

      // Assert
      expect(result).toBe(safeInput);
    });

    it('should handle empty or null input', () => {
      // Act & Assert
      expect(service.sanitizeHtml('')).toBe('');
      expect(service.sanitizeHtml(null as any)).toBe('');
      expect(service.sanitizeHtml(undefined as any)).toBe('');
    });

    it('should handle nested malicious content', () => {
      // Arrange
      const nestedMalicious =
        '<div><script>alert("outer")</script><p onclick="alert(\'inner\')">Text</p></div>';

      // Act
      const result = service.sanitizeHtml(nestedMalicious);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('<div><p>Text</p></div>');
    });

    it('should remove style attributes with expressions', () => {
      // Arrange
      const maliciousStyle =
        '<div style="background: url(javascript:alert(\'xss\'));">Content</div>';

      // Act
      const result = service.sanitizeHtml(maliciousStyle);

      // Assert
      expect(result).not.toContain('javascript:');
      expect(result).toContain('<div>Content</div>');
    });

    it('should handle mixed case malicious tags', () => {
      // Arrange
      const mixedCase =
        '<ScRiPt>alert("xss")</ScRiPt><IFRAME src="javascript:alert()"></IFRAME>';

      // Act
      const result = service.sanitizeHtml(mixedCase);

      // Assert
      expect(result).not.toContain('script');
      expect(result).not.toContain('ScRiPt');
      expect(result).not.toContain('IFRAME');
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      // Arrange
      const input = 'Normal text\0with null byte';

      // Act
      const result = service.sanitizeString(input);

      // Assert
      expect(result).toBe('Normal textwith null byte');
      expect(result).not.toContain('\0');
    });

    it('should normalize unicode', () => {
      // Arrange
      const input = 'café'; // Using composed character é
      const decomposed = 'cafe\u0301'; // Using combining accent

      // Act
      const result1 = service.sanitizeString(input);
      const result2 = service.sanitizeString(decomposed);

      // Assert
      expect(result1).toBe(result2); // Both should normalize to the same form
    });

    it('should trim whitespace', () => {
      // Arrange
      const input = '   trimmed content   ';

      // Act
      const result = service.sanitizeString(input);

      // Assert
      expect(result).toBe('trimmed content');
    });

    it('should handle control characters', () => {
      // Arrange
      const input = 'Text with\rcarriage return\nand newline\ttab';

      // Act
      const result = service.sanitizeString(input);

      // Assert
      expect(result).not.toContain('\r');
      expect(result).toContain('Text with carriage return and newline tab');
    });

    it('should handle empty or null input', () => {
      // Act & Assert
      expect(service.sanitizeString('')).toBe('');
      expect(service.sanitizeString(null as any)).toBe('');
      expect(service.sanitizeString(undefined as any)).toBe('');
    });

    it('should preserve normal text', () => {
      // Arrange
      const input = 'This is normal text with numbers 123 and symbols !@#';

      // Act
      const result = service.sanitizeString(input);

      // Assert
      expect(result).toBe(input.trim());
    });
  });

  describe('sanitizeSqlInput', () => {
    it('should escape single quotes', () => {
      // Arrange
      const input = "O'Reilly";

      // Act
      const result = service.sanitizeSqlInput(input);

      // Assert
      expect(result).toBe("O''Reilly");
    });

    it('should handle SQL injection patterns', () => {
      // Arrange
      const injectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM passwords --",
        "'; EXEC xp_cmdshell('format c:'); --",
      ];

      // Act & Assert
      injectionAttempts.forEach((attempt) => {
        const result = service.sanitizeSqlInput(attempt);
        expect(result).not.toContain("';");
        expect(result).not.toContain("' OR");
        expect(result).not.toContain("' UNION");
        expect(result).not.toContain("'; EXEC");
      });
    });

    it('should remove SQL comments', () => {
      // Arrange
      const input = 'Valid input -- malicious comment';

      // Act
      const result = service.sanitizeSqlInput(input);

      // Assert
      expect(result).not.toContain('--');
      expect(result).toBe('Valid input ');
    });

    it('should handle multi-line comments', () => {
      // Arrange
      const input = 'Valid /* comment */ input';

      // Act
      const result = service.sanitizeSqlInput(input);

      // Assert
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
      expect(result).toBe('Valid  input');
    });

    it('should preserve normal text with quotes', () => {
      // Arrange
      const input = 'He said "Hello world"';

      // Act
      const result = service.sanitizeSqlInput(input);

      // Assert
      expect(result).toBe('He said "Hello world"');
    });

    it('should handle empty or null input', () => {
      // Act & Assert
      expect(service.sanitizeSqlInput('')).toBe('');
      expect(service.sanitizeSqlInput(null as any)).toBe('');
      expect(service.sanitizeSqlInput(undefined as any)).toBe('');
    });
  });

  describe('validateEmailFormat', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
        'user123@example.net',
        'a@b.co',
      ];

      validEmails.forEach((email) => {
        expect(service.validateEmailFormat(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..double@example.com',
        'user@example',
        '',
        null,
        undefined,
      ];

      invalidEmails.forEach((email) => {
        expect(service.validateEmailFormat(email as any)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      // Act & Assert
      expect(service.validateEmailFormat('user@example.c')).toBe(false); // TLD too short
      expect(service.validateEmailFormat('user@example.verylongTLD')).toBe(
        false,
      ); // TLD too long
      expect(service.validateEmailFormat('a'.repeat(65) + '@example.com')).toBe(
        false,
      ); // Local part too long
    });
  });

  describe('sanitizePathTraversal', () => {
    it('should remove path traversal attempts', () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        './config/../secret.txt',
        'normal/path/../../sensitive.file',
      ];

      pathTraversalAttempts.forEach((path) => {
        const result = service.sanitizePathTraversal(path);
        expect(result).not.toContain('../');
        expect(result).not.toContain('..\\');
      });
    });

    it('should preserve normal paths', () => {
      const normalPaths = [
        'documents/file.txt',
        'images/photo.jpg',
        'scripts/app.js',
        'styles/main.css',
      ];

      normalPaths.forEach((path) => {
        const result = service.sanitizePathTraversal(path);
        expect(result).toBe(path);
      });
    });

    it('should handle empty or null input', () => {
      // Act & Assert
      expect(service.sanitizePathTraversal('')).toBe('');
      expect(service.sanitizePathTraversal(null as any)).toBe('');
      expect(service.sanitizePathTraversal(undefined as any)).toBe('');
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large input efficiently', () => {
      // Arrange
      const largeInput = 'a'.repeat(10000) + '<script>alert("xss")</script>';
      const startTime = Date.now();

      // Act
      const result = service.sanitizeHtml(largeInput);
      const endTime = Date.now();

      // Assert
      expect(result).not.toContain('<script>');
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle deeply nested HTML', () => {
      // Arrange
      let deeplyNested = 'content';
      for (let i = 0; i < 100; i++) {
        deeplyNested = `<div onclick="malicious()">${deeplyNested}</div>`;
      }

      // Act
      const result = service.sanitizeHtml(deeplyNested);

      // Assert
      expect(result).not.toContain('onclick');
      expect(result).toContain('content');
    });

    it('should handle special characters and encoding', () => {
      // Arrange
      const specialChars = 'Special chars: àáâãäåæçèéêë & < > " \' / \\';

      // Act
      const result = service.sanitizeString(specialChars);

      // Assert
      expect(result).toContain('Special chars:');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
