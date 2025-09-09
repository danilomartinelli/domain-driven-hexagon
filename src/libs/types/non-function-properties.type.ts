export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/**
 * Exclude all function properties from type.
 */
export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;
