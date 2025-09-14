import { ZodSchema, ZodType, z } from 'zod';

/**
 * Validation result with detailed error information
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Structured validation error
 */
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
  received?: unknown;
  expected?: string;
}

/**
 * Strategy interface for data validation
 */
export interface ValidationStrategy {
  validateModel<T>(data: unknown, schema: ZodSchema<T>): ValidationResult<T>;
  validateId<T extends string | number = string>(
    id: unknown,
    schema?: ZodType<T>,
  ): ValidationResult<T>;
  validateBatch<T>(
    data: unknown[],
    schema: ZodSchema<T>,
  ): ValidationResult<T[]>;
}

/**
 * High-performance validation strategy with caching and optimizations
 */
export class OptimizedValidationStrategy implements ValidationStrategy {
  private static readonly DEFAULT_ID_SCHEMA = z.string().uuid();
  private static readonly MAX_BATCH_SIZE = 1000;

  // Cache for compiled regex patterns and validation functions
  private readonly validationCache = new Map<
    string,
    {
      validator: (data: unknown) => ValidationResult<any>;
      lastUsed: number;
    }
  >();

  private readonly schemaCache = new Map<ZodSchema<any>, string>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up cache every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupCache();
      },
      5 * 60 * 1000,
    );
  }

  validateModel<T>(data: unknown, schema: ZodSchema<T>): ValidationResult<T> {
    try {
      // Try to get cached validator
      const schemaKey = this.getSchemaKey(schema);
      const cached = this.validationCache.get(schemaKey);

      if (cached) {
        cached.lastUsed = Date.now();
        return cached.validator(data);
      }

      // Create and cache new validator
      const validator = this.createModelValidator(schema);
      this.validationCache.set(schemaKey, {
        validator,
        lastUsed: Date.now(),
      });

      return validator(data);
    } catch {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: 'Validation failed due to internal error',
            code: 'VALIDATION_ERROR',
            received: typeof data,
          },
        ],
      };
    }
  }

  validateId<T>(id: unknown, schema?: ZodType<T>): ValidationResult<T> {
    const validationSchema =
      schema || OptimizedValidationStrategy.DEFAULT_ID_SCHEMA;

    try {
      // Fast path for string UUIDs (most common case)
      if (!schema && typeof id === 'string' && this.isValidUuid(id)) {
        return {
          success: true,
          data: id as T,
        };
      }

      const result = validationSchema.safeParse(id);

      if (result.success) {
        return {
          success: true,
          data: result.data as T,
        };
      }

      return {
        success: false,
        errors: result.error.issues.map((err) => ({
          path: err.path.map((p) => String(p)),
          message: err.message,
          code: err.code,
          received: (err as any).received || 'unknown',
          expected: this.getExpectedType(validationSchema),
        })),
      };
    } catch {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: 'ID validation failed',
            code: 'ID_VALIDATION_ERROR',
            received: typeof id,
          },
        ],
      };
    }
  }

  validateBatch<T>(
    data: unknown[],
    schema: ZodSchema<T>,
  ): ValidationResult<T[]> {
    if (!Array.isArray(data)) {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: 'Expected array for batch validation',
            code: 'INVALID_BATCH_TYPE',
            received: typeof data,
          },
        ],
      };
    }

    if (data.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    if (data.length > OptimizedValidationStrategy.MAX_BATCH_SIZE) {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: `Batch size (${data.length}) exceeds maximum allowed (${OptimizedValidationStrategy.MAX_BATCH_SIZE})`,
            code: 'BATCH_TOO_LARGE',
            received: data.length,
          },
        ],
      };
    }

    const results: T[] = [];
    const errors: ValidationError[] = [];

    // Process in chunks for better performance
    const chunkSize = Math.min(100, data.length);

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      for (let j = 0; j < chunk.length; j++) {
        const itemIndex = i + j;
        const validationResult = this.validateModel(chunk[j], schema);

        if (validationResult.success && validationResult.data !== undefined) {
          results.push(validationResult.data);
        } else if (validationResult.errors) {
          // Add index information to errors
          const indexedErrors = validationResult.errors.map((err) => ({
            ...err,
            path: [String(itemIndex), ...err.path],
          }));
          errors.push(...indexedErrors);
        }
      }
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? results : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.validationCache.clear();
    this.schemaCache.clear();
  }

  private createModelValidator<T>(schema: ZodSchema<T>) {
    return (data: unknown): ValidationResult<T> => {
      const result = schema.safeParse(data);

      if (result.success) {
        return {
          success: true,
          data: result.data as T,
        };
      }

      return {
        success: false,
        errors: result.error.issues.map((err) => ({
          path: err.path.map((p) => String(p)),
          message: err.message,
          code: err.code,
          received: (err as any).received || 'unknown',
          expected: this.getExpectedFromPath(
            schema,
            err.path.map((p) => String(p)),
          ),
        })),
      };
    };
  }

  private getSchemaKey(schema: ZodSchema<any>): string {
    // Use WeakMap-like approach with schema identity
    const cached = this.schemaCache.get(schema);
    if (cached) {
      return cached;
    }

    // Generate unique key based on schema structure
    const key = `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.schemaCache.set(schema, key);
    return key;
  }

  private isValidUuid(str: string): boolean {
    // Optimized UUID validation using compiled regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private getExpectedType(schema: ZodType<any>): string {
    if (schema instanceof z.ZodString) return 'string';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodArray) return 'array';
    if (schema instanceof z.ZodObject) return 'object';
    return 'unknown';
  }

  private getExpectedFromPath(
    schema: ZodSchema<any>,
    path: (string | number)[],
  ): string {
    // Simplified expected type extraction for error messages
    try {
      if (path.length === 0) {
        return this.getExpectedType(schema);
      }
      // For nested paths, return generic message
      return 'valid value';
    } catch {
      return 'valid value';
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.lastUsed > maxAge) {
        this.validationCache.delete(key);
      }
    }

    // Clean up schema cache if it gets too large
    if (this.schemaCache.size > 100) {
      this.schemaCache.clear();
    }
  }
}

/**
 * Simple validation strategy for basic use cases
 */
export class SimpleValidationStrategy implements ValidationStrategy {
  validateModel<T>(data: unknown, schema: ZodSchema<T>): ValidationResult<T> {
    try {
      const validatedData = schema.parse(data);
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map((err) => ({
            path: err.path.map((p) => String(p)),
            message: err.message,
            code: err.code,
            received: (err as any).received || 'unknown',
          })),
        };
      }

      return {
        success: false,
        errors: [
          {
            path: [],
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            received: typeof data,
          },
        ],
      };
    }
  }

  validateId<T extends string | number = string>(
    id: unknown,
    schema?: ZodType<T>,
  ): ValidationResult<T> {
    if (schema) {
      return this.validateModel(id, schema);
    }
    // For the default string case, we need to cast properly
    const stringValidation = this.validateModel(id, z.string());
    return stringValidation as ValidationResult<T>;
  }

  validateBatch<T>(
    data: unknown[],
    schema: ZodSchema<T>,
  ): ValidationResult<T[]> {
    if (!Array.isArray(data)) {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: 'Expected array',
            code: 'INVALID_TYPE',
            received: typeof data,
          },
        ],
      };
    }

    const results: T[] = [];
    const errors: ValidationError[] = [];

    data.forEach((item, index) => {
      const result = this.validateModel(item, schema);
      if (result.success && result.data !== undefined) {
        results.push(result.data);
      } else if (result.errors) {
        const indexedErrors = result.errors.map((err) => ({
          ...err,
          path: [String(index), ...err.path],
        }));
        errors.push(...indexedErrors);
      }
    });

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? results : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
