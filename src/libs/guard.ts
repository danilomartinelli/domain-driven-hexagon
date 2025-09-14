/**
 * Type-safe guard utility for validating values with comprehensive type checking.
 * Provides runtime type safety and validation helpers for domain objects.
 */
export class Guard {
  /**
   * Checks if value is empty. Uses type guards for better type safety.
   * Accepts strings, numbers, booleans, objects and arrays.
   *
   * @param value - Value to check for emptiness
   * @returns true if value is considered empty
   */
  static isEmpty(
    value: unknown,
  ): value is null | undefined | '' | [] | Record<string, never> {
    // Primitive falsy values (except false and 0 which are valid values)
    if (typeof value === 'undefined' || value === null || value === '') {
      return true;
    }

    // Numbers and booleans are never empty (including 0 and false)
    if (typeof value === 'number' || typeof value === 'boolean') {
      return false;
    }

    // Dates are never empty when they exist
    if (value instanceof Date) {
      return !Guard.isValidDate(value);
    }

    // Arrays - check length and recursive emptiness
    if (Array.isArray(value)) {
      return value.length === 0 || value.every((item) => Guard.isEmpty(item));
    }

    // Objects - check if has enumerable properties
    if (typeof value === 'object' && value !== null) {
      // Use more specific check for plain objects
      return Object.keys(value).length === 0;
    }

    return false;
  }

  /**
   * Type guard to check if a value has a measurable length
   */
  static hasLength(
    value: unknown,
  ): value is string | Array<unknown> | { length: number } {
    return (
      typeof value === 'string' ||
      Array.isArray(value) ||
      (typeof value === 'object' && value !== null && 'length' in value)
    );
  }

  /**
   * Checks length range of a provided number/string/array with better type safety
   */
  static lengthIsBetween(
    value: number | string | Array<unknown>,
    min: number,
    max: number,
  ): boolean {
    if (Guard.isEmpty(value)) {
      throw new Error(
        'Cannot check length of a value. Provided value is empty',
      );
    }

    // Validate bounds
    if (min < 0 || max < 0) {
      throw new Error('Length bounds must be non-negative');
    }
    if (min > max) {
      throw new Error('Minimum length cannot be greater than maximum length');
    }

    const valueLength = Guard.getValueLength(value);
    return valueLength >= min && valueLength <= max;
  }

  /**
   * Get the length of a value in a type-safe way
   */
  private static getValueLength(
    value: number | string | Array<unknown>,
  ): number {
    if (typeof value === 'number') {
      return Math.abs(value).toString().length;
    }
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    throw new Error('Cannot determine length of provided value');
  }

  /**
   * Checks if value is a valid UUID with type guard
   */
  static isUuid(value: unknown): value is string {
    if (typeof value !== 'string') {
      return false;
    }

    // More comprehensive UUID validation supporting multiple versions
    const uuidV4Regex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const uuidGenericRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    return uuidV4Regex.test(value) || uuidGenericRegex.test(value);
  }

  /**
   * Validate that a date is actually valid (not Invalid Date)
   */
  static isValidDate(date: unknown): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Type guard to check if value is a non-empty string
   */
  static isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  /**
   * Type guard to check if value is a positive number
   */
  static isPositiveNumber(value: unknown): value is number {
    return (
      typeof value === 'number' && value > 0 && !isNaN(value) && isFinite(value)
    );
  }

  /**
   * Type guard to check if value is a non-negative number (includes 0)
   */
  static isNonNegativeNumber(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      value >= 0 &&
      !isNaN(value) &&
      isFinite(value)
    );
  }

  /**
   * Type guard to check if value is an email address
   */
  static isValidEmail(value: unknown): value is string {
    if (!Guard.isNonEmptyString(value)) {
      return false;
    }

    // RFC 5322 compliant email regex (simplified but comprehensive)
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    return emailRegex.test(value) && value.length <= 320; // RFC 5321 limit
  }

  /**
   * Type guard to check if object has specific properties
   */
  static hasProperty<T extends Record<string, unknown>>(
    obj: unknown,
    property: keyof T,
  ): obj is T {
    return typeof obj === 'object' && obj !== null && property in obj;
  }

  /**
   * Assert that a condition is true, throwing an error if not
   */
  static assert(condition: unknown, message?: string): asserts condition {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Type guard for checking if value is a plain object (not array, date, etc.)
   */
  static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    // Check if it's a plain object (created by {} or new Object())
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }
}
