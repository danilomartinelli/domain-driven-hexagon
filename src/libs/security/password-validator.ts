/**
 * High-performance password validation with pre-compiled patterns and caching
 *
 * Performance optimizations:
 * - Pre-compiled regex patterns (O(1) access)
 * - Short-circuit evaluation for common cases
 * - Minimal string operations
 * - Result caching for repeated validations
 */
export interface PasswordValidationResult {
  readonly isValid: boolean;
  readonly score: number; // 0-100
  readonly errors: ReadonlyArray<PasswordValidationError>;
  readonly suggestions: ReadonlyArray<string>;
}

export interface PasswordValidationError {
  readonly code: string;
  readonly message: string;
  readonly severity: 'low' | 'medium' | 'high';
}

/**
 * Password validation rules configuration
 */
export interface PasswordValidationConfig {
  readonly minLength: number;
  readonly maxLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumbers: boolean;
  readonly requireSpecialChars: boolean;
  readonly maxConsecutiveChars: number;
  readonly maxRepeatingChars: number;
  readonly forbiddenPatterns: ReadonlyArray<string>;
  readonly enableCommonPasswordCheck: boolean;
  readonly enableDictionaryCheck: boolean;
}

/**
 * Default configuration for strong password requirements
 */
export const DEFAULT_PASSWORD_CONFIG: PasswordValidationConfig = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxConsecutiveChars: 3,
  maxRepeatingChars: 3,
  forbiddenPatterns: [
    'password',
    '123456',
    'qwerty',
    'admin',
    'user',
    'guest',
    'root',
  ],
  enableCommonPasswordCheck: true,
  enableDictionaryCheck: false, // Expensive operation, disabled by default
} as const;

/**
 * Pre-compiled regex patterns for optimal performance
 */
class PasswordPatterns {
  // Character type patterns - compiled once
  static readonly UPPERCASE = /[A-Z]/;
  static readonly LOWERCASE = /[a-z]/;
  static readonly NUMBERS = /[0-9]/;
  static readonly SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

  // Weakness patterns
  static readonly CONSECUTIVE_CHARS = /(.)\1{3,}/; // 4+ consecutive same chars
  static readonly KEYBOARD_SEQUENCE =
    /(123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i;

  // Common patterns to avoid
  static readonly YEAR_PATTERN = /19[0-9]{2}|20[0-9]{2}/;
  static readonly PHONE_PATTERN = /[0-9]{3}[-.]?[0-9]{3}[-.]?[0-9]{4}/;
  static readonly EMAIL_PATTERN = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  // Entropy calculation patterns
  static readonly CHAR_CLASSES = [
    { pattern: /[a-z]/, entropy: 26 },
    { pattern: /[A-Z]/, entropy: 26 },
    { pattern: /[0-9]/, entropy: 10 },
    { pattern: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, entropy: 32 },
    { pattern: /[^a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, entropy: 95 }, // Other unicode
  ];
}

/**
 * Optimized password validator with caching and performance monitoring
 */
export class OptimizedPasswordValidator {
  private readonly cache = new Map<string, PasswordValidationResult>();
  private readonly commonPasswords = new Set<string>();
  private readonly config: PasswordValidationConfig;

  // Performance metrics
  private validationCount = 0;
  private cacheHitCount = 0;

  constructor(config: PasswordValidationConfig = DEFAULT_PASSWORD_CONFIG) {
    this.config = config;

    if (config.enableCommonPasswordCheck) {
      this.loadCommonPasswords();
    }

    // Set up cache cleanup to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupCache(), 300000); // Clean every 5 minutes
    }
  }

  /**
   * Validate password with comprehensive security checks
   */
  validate(password: string): PasswordValidationResult {
    this.validationCount++;

    // Check cache first (hash the password for privacy)
    const passwordHash = this.simpleHash(password);
    const cached = this.cache.get(passwordHash);
    if (cached) {
      this.cacheHitCount++;
      return cached;
    }

    const result = this.performValidation(password);

    // Cache result (limit cache size)
    if (this.cache.size < 1000) {
      this.cache.set(passwordHash, result);
    }

    return result;
  }

  /**
   * Get validation performance metrics
   */
  getMetrics(): {
    validationCount: number;
    cacheHitRate: number;
    cacheSize: number;
  } {
    return {
      validationCount: this.validationCount,
      cacheHitRate:
        this.validationCount > 0
          ? this.cacheHitCount / this.validationCount
          : 0,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Clear validation cache and reset metrics
   */
  resetCache(): void {
    this.cache.clear();
    this.validationCount = 0;
    this.cacheHitCount = 0;
  }

  private performValidation(password: string): PasswordValidationResult {
    const errors: PasswordValidationError[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Fast basic checks first
    if (!password) {
      return {
        isValid: false,
        score: 0,
        errors: [
          {
            code: 'EMPTY_PASSWORD',
            message: 'Password cannot be empty',
            severity: 'high',
          },
        ],
        suggestions: ['Provide a password'],
      };
    }

    // Length validation (fast)
    if (password.length < this.config.minLength) {
      errors.push({
        code: 'TOO_SHORT',
        message: `Password must be at least ${this.config.minLength} characters`,
        severity: 'high',
      });
      suggestions.push(`Use at least ${this.config.minLength} characters`);
    } else {
      score += Math.min(25, (password.length / this.config.minLength) * 15);
    }

    if (password.length > this.config.maxLength) {
      errors.push({
        code: 'TOO_LONG',
        message: `Password must not exceed ${this.config.maxLength} characters`,
        severity: 'medium',
      });
    }

    // Character class validation (pre-compiled patterns)
    let charClassCount = 0;

    if (this.config.requireLowercase) {
      if (PasswordPatterns.LOWERCASE.test(password)) {
        score += 10;
        charClassCount++;
      } else {
        errors.push({
          code: 'NO_LOWERCASE',
          message: 'Password must contain lowercase letters',
          severity: 'medium',
        });
        suggestions.push('Include lowercase letters (a-z)');
      }
    }

    if (this.config.requireUppercase) {
      if (PasswordPatterns.UPPERCASE.test(password)) {
        score += 10;
        charClassCount++;
      } else {
        errors.push({
          code: 'NO_UPPERCASE',
          message: 'Password must contain uppercase letters',
          severity: 'medium',
        });
        suggestions.push('Include uppercase letters (A-Z)');
      }
    }

    if (this.config.requireNumbers) {
      if (PasswordPatterns.NUMBERS.test(password)) {
        score += 10;
        charClassCount++;
      } else {
        errors.push({
          code: 'NO_NUMBERS',
          message: 'Password must contain numbers',
          severity: 'medium',
        });
        suggestions.push('Include numbers (0-9)');
      }
    }

    if (this.config.requireSpecialChars) {
      if (PasswordPatterns.SPECIAL_CHARS.test(password)) {
        score += 15;
        charClassCount++;
      } else {
        errors.push({
          code: 'NO_SPECIAL_CHARS',
          message: 'Password must contain special characters',
          severity: 'medium',
        });
        suggestions.push('Include special characters (!@#$%^&*)');
      }
    }

    // Entropy-based scoring
    score += this.calculateEntropyScore(password);

    // Pattern-based weakness detection
    this.detectWeakPatterns(password, errors, suggestions);

    // Dictionary and common password checks (if enabled)
    if (this.config.enableCommonPasswordCheck) {
      this.checkCommonPasswords(password, errors, suggestions);
    }

    // Forbidden pattern checks
    this.checkForbiddenPatterns(password, errors, suggestions);

    // Bonus for diversity
    if (charClassCount >= 4) {
      score += 10;
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    return {
      isValid: errors.length === 0,
      score,
      errors,
      suggestions,
    };
  }

  private calculateEntropyScore(password: string): number {
    const charsetSize = PasswordPatterns.CHAR_CLASSES.filter((charClass) =>
      charClass.pattern.test(password),
    ).reduce((total, charClass) => total + charClass.entropy, 0);

    if (charsetSize === 0) return 0;

    // Calculate approximate entropy: length * log2(charsetSize)
    const entropy = password.length * Math.log2(charsetSize);

    // Convert to score (0-25 points based on entropy)
    return Math.min(25, entropy / 3);
  }

  private detectWeakPatterns(
    password: string,
    errors: PasswordValidationError[],
    suggestions: string[],
  ): void {
    const lowerPassword = password.toLowerCase();

    // Check for consecutive repeating characters
    const consecutiveMatch = password.match(PasswordPatterns.CONSECUTIVE_CHARS);
    if (
      consecutiveMatch &&
      consecutiveMatch[0].length > this.config.maxConsecutiveChars
    ) {
      errors.push({
        code: 'CONSECUTIVE_CHARS',
        message: `Avoid repeating the same character ${consecutiveMatch[0].length} times`,
        severity: 'medium',
      });
      suggestions.push('Avoid repeating the same character multiple times');
    }

    // Check for keyboard sequences
    if (PasswordPatterns.KEYBOARD_SEQUENCE.test(lowerPassword)) {
      errors.push({
        code: 'KEYBOARD_SEQUENCE',
        message: 'Avoid keyboard sequences like "123" or "abc"',
        severity: 'medium',
      });
      suggestions.push('Avoid keyboard sequences and patterns');
    }

    // Check for year patterns
    if (PasswordPatterns.YEAR_PATTERN.test(password)) {
      errors.push({
        code: 'CONTAINS_YEAR',
        message: 'Avoid using years in passwords',
        severity: 'low',
      });
      suggestions.push('Avoid using birth years or current year');
    }

    // Check for phone number patterns
    if (PasswordPatterns.PHONE_PATTERN.test(password)) {
      errors.push({
        code: 'PHONE_PATTERN',
        message: 'Avoid using phone number patterns',
        severity: 'medium',
      });
      suggestions.push('Avoid phone numbers and similar patterns');
    }

    // Check for email patterns
    if (PasswordPatterns.EMAIL_PATTERN.test(lowerPassword)) {
      errors.push({
        code: 'EMAIL_PATTERN',
        message: 'Avoid using email addresses in passwords',
        severity: 'medium',
      });
      suggestions.push('Avoid email addresses or parts of them');
    }
  }

  private checkCommonPasswords(
    password: string,
    errors: PasswordValidationError[],
    suggestions: string[],
  ): void {
    const lowerPassword = password.toLowerCase();

    if (this.commonPasswords.has(lowerPassword)) {
      errors.push({
        code: 'COMMON_PASSWORD',
        message: 'This password is too common and easily guessed',
        severity: 'high',
      });
      suggestions.push('Choose a unique password that is not commonly used');
    }
  }

  private checkForbiddenPatterns(
    password: string,
    errors: PasswordValidationError[],
    suggestions: string[],
  ): void {
    const lowerPassword = password.toLowerCase();

    for (const pattern of this.config.forbiddenPatterns) {
      if (lowerPassword.includes(pattern.toLowerCase())) {
        errors.push({
          code: 'FORBIDDEN_PATTERN',
          message: `Password contains forbidden pattern: ${pattern}`,
          severity: 'medium',
        });
        suggestions.push(`Avoid using "${pattern}" in passwords`);
      }
    }
  }

  private loadCommonPasswords(): void {
    // Most common passwords (kept minimal for performance)
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      'dragon',
      'master',
      'hello',
      'freedom',
      'whatever',
      'qazwsx',
      'trustno1',
      'jordan23',
      'harley',
      'robert',
      'matthew',
      'jordan',
      'michelle',
      'loveme',
      'minions',
    ];

    commonPasswords.forEach((pwd) => this.commonPasswords.add(pwd));
  }

  private simpleHash(text: string): string {
    // Simple hash for caching (not cryptographic)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private cleanupCache(): void {
    // Simple LRU cleanup - remove oldest entries if cache is large
    if (this.cache.size > 500) {
      const entries = Array.from(this.cache.entries());
      const keepCount = 250;
      this.cache.clear();

      // Keep the most recently added entries
      entries.slice(-keepCount).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
    }
  }
}
