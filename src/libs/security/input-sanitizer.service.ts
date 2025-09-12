import { Injectable, Logger } from '@nestjs/common';
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM for server-side usage
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Input sanitization service for XSS prevention and data cleaning
 * Provides comprehensive input sanitization with HTML encoding and malicious pattern detection
 */
@Injectable()
export class InputSanitizerService {
  private readonly logger = new Logger(InputSanitizerService.name);

  constructor() {
    this.configureDOMPurify();
  }

  /**
   * Configure DOMPurify with secure settings
   */
  private configureDOMPurify(): void {
    // Add custom sanitization rules
    purify.addHook('beforeSanitizeElements', (node) => {
      // Log potentially malicious content
      if (node.nodeName && ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED'].includes(node.nodeName)) {
        this.logger.warn('Potentially malicious element detected and sanitized', {
          element: node.nodeName,
          content: node.textContent?.substring(0, 100),
        });
      }
    });

    // Custom configuration for stricter sanitization
    purify.setConfig({
      ALLOWED_TAGS: [], // No HTML tags allowed by default
      ALLOWED_ATTR: [], // No attributes allowed
      KEEP_CONTENT: true, // Keep text content
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      SANITIZE_DOM: true,
      SAFE_FOR_TEMPLATES: true,
      WHOLE_DOCUMENT: false,
    });
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHtml(input: string, allowBasicTags = false): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    const config = allowBasicTags ? {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    } : undefined;

    try {
      const cleaned = purify.sanitize(input, config);
      
      // Double-check for any remaining script-like content
      if (this.containsScriptLikeContent(cleaned)) {
        this.logger.warn('Script-like content detected after sanitization', {
          original: input.substring(0, 100),
          sanitized: cleaned.substring(0, 100),
        });
        return this.stripScriptContent(cleaned);
      }
      
      return cleaned;
    } catch (error) {
      this.logger.error('HTML sanitization failed', error);
      return this.escapeHtml(input);
    }
  }

  /**
   * Sanitize plain text input
   */
  sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove null bytes and control characters (except newlines and tabs)
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize Unicode to prevent bypass attempts
    sanitized = sanitized.normalize('NFKC');
    
    // Remove potentially dangerous sequences
    sanitized = this.removeDangerousSequences(sanitized);
    
    // HTML encode special characters
    sanitized = this.escapeHtml(sanitized);
    
    return sanitized.trim();
  }

  /**
   * Sanitize email addresses
   */
  sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
      return '';
    }

    // Remove dangerous characters and normalize
    const sanitized = email
      .toLowerCase()
      .trim()
      .replace(/[^\w@.-]/g, '') // Allow only word chars, @, ., -
      .normalize('NFKC');

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(sanitized)) {
      this.logger.warn('Invalid email format detected', { email: email.substring(0, 50) });
      return '';
    }

    return sanitized;
  }

  /**
   * Sanitize URL inputs
   */
  sanitizeUrl(url: string): string {
    if (typeof url !== 'string') {
      return '';
    }

    const sanitized = url.trim();
    
    // Block dangerous protocols
    const dangerousProtocols = [
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'ftp:',
    ];

    const lowerUrl = sanitized.toLowerCase();
    if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
      this.logger.warn('Dangerous protocol detected in URL', { url: url.substring(0, 100) });
      return '';
    }

    // Only allow http/https protocols
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return '';
    }

    try {
      const urlObj = new URL(sanitized);
      
      // Additional validation
      if (urlObj.hostname.length > 253) {
        return '';
      }

      return urlObj.toString();
    } catch (error) {
      this.logger.warn('Invalid URL format', { url: url.substring(0, 100) });
      return '';
    }
  }

  /**
   * Sanitize SQL-like inputs (for search queries, etc.)
   */
  sanitizeSqlLike(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove SQL injection patterns
    const sqlPatterns = [
      /['";]/g, // Quotes and semicolons
      /--/g, // SQL comments
      /\/\*/g, // SQL block comments start
      /\*\//g, // SQL block comments end
      /union\s+select/gi,
      /drop\s+table/gi,
      /insert\s+into/gi,
      /delete\s+from/gi,
      /update\s+set/gi,
      /exec\s*\(/gi,
      /sp_/gi,
      /xp_/gi,
    ];

    let sanitized = input;
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return this.sanitizeText(sanitized);
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.sanitizeText(obj) as unknown as T;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item)) as unknown as T;
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key itself
      const cleanKey = this.sanitizeText(key);
      
      if (typeof value === 'string') {
        // Apply specific sanitization based on field name
        sanitized[cleanKey] = this.sanitizeByFieldType(cleanKey, value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[cleanKey] = this.sanitizeObject(value);
      } else {
        sanitized[cleanKey] = value;
      }
    }

    return sanitized as T;
  }

  /**
   * Apply field-specific sanitization
   */
  private sanitizeByFieldType(fieldName: string, value: string): string {
    const field = fieldName.toLowerCase();
    
    if (field.includes('email')) {
      return this.sanitizeEmail(value);
    }
    
    if (field.includes('url') || field.includes('link') || field.includes('href')) {
      return this.sanitizeUrl(value);
    }
    
    if (field.includes('html') || field.includes('content') || field.includes('description')) {
      return this.sanitizeHtml(value, true); // Allow basic HTML tags
    }
    
    if (field.includes('search') || field.includes('query') || field.includes('filter')) {
      return this.sanitizeSqlLike(value);
    }
    
    return this.sanitizeText(value);
  }

  /**
   * HTML encode special characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };

    return text.replace(/[&<>"'`=\/]/g, (match) => htmlEscapes[match]);
  }

  /**
   * Check for script-like content
   */
  private containsScriptLikeContent(text: string): boolean {
    const scriptPatterns = [
      /javascript:/i,
      /on\w+\s*=/i,
      /<script/i,
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /Function\s*\(/i,
    ];

    return scriptPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Strip script content as fallback
   */
  private stripScriptContent(text: string): string {
    return text
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/eval\s*\([^)]*\)/gi, '')
      .replace(/setTimeout\s*\([^)]*\)/gi, '')
      .replace(/setInterval\s*\([^)]*\)/gi, '');
  }

  /**
   * Remove dangerous character sequences
   */
  private removeDangerousSequences(text: string): string {
    const dangerousSequences = [
      /\x00/g, // Null bytes
      /\x1a/g, // Substitute character
      /\ufeff/g, // Byte order mark
      /[\u200b-\u200d\ufeff]/g, // Zero-width characters
      /[\u2028\u2029]/g, // Line/paragraph separators
    ];

    let cleaned = text;
    dangerousSequences.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Validate input length and complexity
   */
  validateInputSafety(input: string, maxLength = 10000): { safe: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (input.length > maxLength) {
      issues.push(`Input exceeds maximum length of ${maxLength} characters`);
    }
    
    // Check for excessive repetition (potential DoS)
    const repetitionPattern = /(.{1,10})\1{10,}/;
    if (repetitionPattern.test(input)) {
      issues.push('Excessive character repetition detected');
    }
    
    // Check for deeply nested structures in JSON-like input
    const nestingLevel = (input.match(/[{[]/g) || []).length;
    if (nestingLevel > 50) {
      issues.push('Excessive nesting detected');
    }
    
    return {
      safe: issues.length === 0,
      issues,
    };
  }
}