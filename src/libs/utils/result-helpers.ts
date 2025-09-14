import { Result, Ok, Err } from 'oxide.ts';

/**
 * Enhanced Result pattern utilities for better error handling and functional programming
 * Follows Railway Oriented Programming principles
 */
export class ResultHelpers {
  /**
   * Combines multiple Results into a single Result
   * If any Result is an Error, returns the first Error
   * If all Results are Ok, returns Ok with array of unwrapped values
   */
  static combine<T, E>(...results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
      if (result.isErr()) {
        return Err(result.unwrapErr());
      }
      values.push(result.unwrap());
    }

    return Ok(values);
  }

  /**
   * Maps over an array with a function that returns Results
   * Returns Ok(array) if all succeed, or the first Error
   */
  static async mapAsync<T, U, E>(
    items: T[],
    fn: (item: T, index: number) => Promise<Result<U, E>>,
  ): Promise<Result<U[], E>> {
    const results: U[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await fn(items[i], i);
      if (result.isErr()) {
        return Err(result.unwrapErr());
      }
      results.push(result.unwrap());
    }

    return Ok(results);
  }

  /**
   * Filters an array based on a predicate that returns a Result
   * Returns Ok(filtered array) or the first Error encountered
   */
  static filterResults<T, E>(
    items: T[],
    predicate: (item: T) => Result<boolean, E>,
  ): Result<T[], E> {
    const filtered: T[] = [];

    for (const item of items) {
      const result = predicate(item);
      if (result.isErr()) {
        return Err(result.unwrapErr());
      }

      if (result.unwrap()) {
        filtered.push(item);
      }
    }

    return Ok(filtered);
  }

  /**
   * Wraps a function that might throw in a Result
   * Useful for converting throwing code to Result pattern
   */
  static tryCatch<T, E = Error>(
    fn: () => T,
    errorHandler?: (error: unknown) => E,
  ): Result<T, E> {
    try {
      return Ok(fn());
    } catch (error) {
      const handledError = errorHandler ? errorHandler(error) : (error as E);
      return Err(handledError);
    }
  }

  /**
   * Async version of tryCatch
   */
  static async tryCatchAsync<T, E = Error>(
    fn: () => Promise<T>,
    errorHandler?: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      const result = await fn();
      return Ok(result);
    } catch (error) {
      const handledError = errorHandler ? errorHandler(error) : (error as E);
      return Err(handledError);
    }
  }

  /**
   * Retries a function that returns a Result up to maxAttempts times
   * Returns the first Ok result or the last Error after all attempts fail
   */
  static async retry<T, E>(
    fn: () => Promise<Result<T, E>>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
  ): Promise<Result<T, E>> {
    let lastError: E | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await fn();

      if (result.isOk()) {
        return result;
      }

      lastError = result.unwrapErr();

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return Err(lastError as E);
  }
}
