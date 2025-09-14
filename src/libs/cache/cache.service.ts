import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

// Enhanced Redis-like interface (can be replaced with actual Redis)
interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<number>;
  flushAll(): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
}

// In-memory cache implementation (replace with Redis in production)
class InMemoryCacheClient implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt?: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<number> {
    return this.cache.delete(key) ? 1 : 0;
  }

  async flushAll(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry || !entry.expiresAt) return -1;

    const remaining = Math.max(0, entry.expiresAt - Date.now()) / 1000;
    return Math.ceil(remaining);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Cache configuration interface
interface CacheConfig {
  readonly enabled: boolean;
  readonly defaultTtl: number;
  readonly maxKeys: number;
  readonly enableMetrics: boolean;
  readonly keyPrefix: string;
}

// Cache metrics interface
interface CacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly sets: number;
  readonly deletes: number;
  readonly hitRatio: number;
  readonly totalOperations: number;
}

// Cache entry metadata
interface CacheEntryMetadata {
  readonly key: string;
  readonly size: number;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly hits: number;
}

// Cache strategy enum
enum CacheStrategy {
  CACHE_FIRST = 'cache_first',
  CACHE_ASIDE = 'cache_aside',
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
}

// Cache tag for invalidation
type CacheTag = string;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: CacheClient;
  private readonly config: CacheConfig;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRatio: 0,
    totalOperations: 0,
  };

  // Tag-to-keys mapping for batch invalidation
  private readonly tagToKeys = new Map<CacheTag, Set<string>>();

  constructor(private readonly configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('cache.enabled', true),
      defaultTtl: this.configService.get<number>('cache.defaultTtl', 300), // 5 minutes
      maxKeys: this.configService.get<number>('cache.maxKeys', 10000),
      enableMetrics: this.configService.get<boolean>('cache.enableMetrics', true),
      keyPrefix: this.configService.get<string>('cache.keyPrefix', 'ddh:'),
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      // Initialize cache client (replace with Redis client in production)
      this.client = new InMemoryCacheClient();

      if (this.config.enabled) {
        this.logger.log('Cache service initialized successfully');
        this.logger.log(`Cache configuration: TTL=${this.config.defaultTtl}s, MaxKeys=${this.config.maxKeys}`);
      } else {
        this.logger.log('Cache service is disabled');
      }
    } catch (error) {
      this.logger.error('Failed to initialize cache service', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client instanceof InMemoryCacheClient) {
        this.client.destroy();
      }
      this.logger.log('Cache service destroyed');
    } catch (error) {
      this.logger.error('Error during cache service destruction', error);
    }
  }

  /**
   * Get value from cache with automatic deserialization
   */
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.config.enabled) {
      return defaultValue;
    }

    try {
      const fullKey = this.buildKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        this.recordMiss();
        return defaultValue;
      }

      this.recordHit();
      return this.deserialize<T>(value);
    } catch (error) {
      this.logger.warn(`Cache get failed for key: ${key}`, error);
      this.recordMiss();
      return defaultValue;
    }
  }

  /**
   * Set value in cache with automatic serialization and optional TTL
   */
  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds?: number,
    tags?: CacheTag[]
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const serializedValue = this.serialize(value);
      const ttl = ttlSeconds ?? this.config.defaultTtl;

      await this.client.setex(fullKey, ttl, serializedValue);

      // Associate key with tags for batch invalidation
      if (tags && tags.length > 0) {
        this.associateKeyWithTags(fullKey, tags);
      }

      this.recordSet();
      return true;
    } catch (error) {
      this.logger.warn(`Cache set failed for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const deleted = await this.client.del(fullKey);

      // Remove from tag associations
      this.removeKeyFromTags(fullKey);

      if (deleted > 0) {
        this.recordDelete();
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn(`Cache delete failed for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      return await this.client.exists(fullKey);
    } catch (error) {
      this.logger.warn(`Cache exists check failed for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.config.enabled) {
      return -1;
    }

    try {
      const fullKey = this.buildKey(key);
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.logger.warn(`Cache TTL check failed for key: ${key}`, error);
      return -1;
    }
  }

  /**
   * Get or set pattern - fetch from cache, or compute and cache if not found
   */
  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T> | T,
    ttlSeconds?: number,
    tags?: CacheTag[]
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    // Not in cache, compute the value
    try {
      const value = await factory();

      // Cache the computed value (don't await to avoid blocking)
      this.set(key, value, ttlSeconds, tags).catch(error => {
        this.logger.warn(`Failed to cache computed value for key: ${key}`, error);
      });

      return value;
    } catch (error) {
      this.logger.error(`Factory function failed for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Invalidate all keys associated with specific tags
   */
  async invalidateByTags(tags: CacheTag[]): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    let deletedCount = 0;

    try {
      for (const tag of tags) {
        const keysForTag = this.tagToKeys.get(tag);

        if (keysForTag && keysForTag.size > 0) {
          // Delete all keys for this tag
          for (const key of keysForTag) {
            const deleted = await this.client.del(key);
            if (deleted > 0) {
              deletedCount++;
            }
          }

          // Clear the tag association
          this.tagToKeys.delete(tag);
        }
      }

      if (deletedCount > 0) {
        this.logger.debug(`Invalidated ${deletedCount} cache entries by tags: ${tags.join(', ')}`);
        this.metrics.deletes += deletedCount;
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by tags: ${tags.join(', ')}`, error);
      return 0;
    }
  }

  /**
   * Invalidate keys matching a pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    try {
      const keys = await this.client.keys(this.buildKey(pattern));
      let deletedCount = 0;

      for (const key of keys) {
        const deleted = await this.client.del(key);
        if (deleted > 0) {
          deletedCount++;
          this.removeKeyFromTags(key);
        }
      }

      if (deletedCount > 0) {
        this.logger.debug(`Invalidated ${deletedCount} cache entries by pattern: ${pattern}`);
        this.metrics.deletes += deletedCount;
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by pattern: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.client.flushAll();
      this.tagToKeys.clear();
      this.logger.log('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      throw error;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalOps = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRatio: totalOps > 0 ? (this.metrics.hits / totalOps) * 100 : 0,
      totalOperations: totalOps,
    };
  }

  /**
   * Get cache information and statistics
   */
  async getInfo(): Promise<{
    config: CacheConfig;
    metrics: CacheMetrics;
    keyCount: number;
    tagCount: number;
  }> {
    let keyCount = 0;

    try {
      if (this.config.enabled) {
        const keys = await this.client.keys(this.buildKey('*'));
        keyCount = keys.length;
      }
    } catch (error) {
      this.logger.warn('Failed to get cache key count', error);
    }

    return {
      config: this.config,
      metrics: this.getMetrics(),
      keyCount,
      tagCount: this.tagToKeys.size,
    };
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUp(data: Array<{ key: string; value: unknown; ttl?: number; tags?: CacheTag[] }>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log(`Warming up cache with ${data.length} entries`);

    try {
      const promises = data.map(({ key, value, ttl, tags }) =>
        this.set(key, value, ttl, tags)
      );

      await Promise.allSettled(promises);
      this.logger.log('Cache warm-up completed');
    } catch (error) {
      this.logger.error('Cache warm-up failed', error);
    }
  }

  // Private helper methods

  private buildKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string): T {
    return JSON.parse(value);
  }

  private associateKeyWithTags(key: string, tags: CacheTag[]): void {
    for (const tag of tags) {
      if (!this.tagToKeys.has(tag)) {
        this.tagToKeys.set(tag, new Set());
      }
      this.tagToKeys.get(tag)!.add(key);
    }
  }

  private removeKeyFromTags(key: string): void {
    for (const [tag, keys] of this.tagToKeys) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagToKeys.delete(tag);
      }
    }
  }

  private recordHit(): void {
    if (this.config.enableMetrics) {
      this.metrics.hits++;
    }
  }

  private recordMiss(): void {
    if (this.config.enableMetrics) {
      this.metrics.misses++;
    }
  }

  private recordSet(): void {
    if (this.config.enableMetrics) {
      this.metrics.sets++;
    }
  }

  private recordDelete(): void {
    if (this.config.enableMetrics) {
      this.metrics.deletes++;
    }
  }
}

// Utility decorator for caching method results
export function Cacheable(
  keyGenerator: (args: any[]) => string,
  ttlSeconds?: number,
  tags?: CacheTag[]
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService || this.cache;

      if (!cacheService) {
        // No cache service available, call method directly
        return method.apply(this, args);
      }

      const cacheKey = keyGenerator(args);

      return cacheService.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        ttlSeconds,
        tags
      );
    };
  };
}

// Cache strategy decorator
export function CacheStrategy(strategy: CacheStrategy) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value.cacheStrategy = strategy;
    return descriptor;
  };
}