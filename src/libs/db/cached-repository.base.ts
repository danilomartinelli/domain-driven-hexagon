import { AggregateRoot, PaginatedQueryParams, Paginated } from '@libs/ddd';
import { Mapper } from '@libs/ddd';
import { RepositoryPort } from '@libs/ddd';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { None, Option, Some } from 'oxide.ts';
import { DatabasePool, SqlToken } from 'slonik';
import { ZodSchema, ZodType } from 'zod';
import { LoggerPort } from '../ports/logger.port';
import { ObjectLiteral } from '../types';
import { SqlRepositoryBase } from './sql-repository.base';
import { CacheService, CacheKeyBuilder } from '../cache/cache.service';

/**
 * Enhanced repository base class with intelligent caching capabilities
 * Extends SqlRepositoryBase with Redis-based caching for read operations
 */
export abstract class CachedRepositoryBase<
  Aggregate extends AggregateRoot<any>,
  DbModel extends ObjectLiteral,
  EntityId extends string | number = string,
> extends SqlRepositoryBase<Aggregate, DbModel, EntityId> {
  /** Default cache TTL in seconds */
  protected cacheTtl = 300; // 5 minutes

  /** Cache tags for invalidation */
  protected cacheTag: string;

  protected constructor(
    pool: DatabasePool,
    mapper: Mapper<Aggregate, DbModel>,
    eventEmitter: EventEmitter2,
    logger: LoggerPort,
    protected readonly cacheService: CacheService,
    cacheTag?: string,
  ) {
    super(pool, mapper, eventEmitter, logger);
    this.cacheTag = cacheTag || this.tableName;
  }

  /**
   * Find entity by ID with caching
   */
  async findOneById(id: string): Promise<Option<Aggregate>> {
    const cacheKey = this.buildEntityCacheKey(id);

    try {
      // Try cache first
      const cached = await this.cacheService.get<DbModel>(cacheKey);
      if (cached) {
        const entity = this.mapper.toDomain(cached);
        this.logCacheHit('findOneById', { id });
        return Some(entity);
      }

      // Cache miss - fetch from database
      const result = await super.findOneById(id);

      if (result.isSome()) {
        const entity = result.unwrap();
        const persistenceModel = this.mapper.toPersistence(entity);

        // Cache the result
        await this.cacheService.set(cacheKey, persistenceModel, {
          ttl: this.cacheTtl,
          tags: [this.cacheTag, `${this.cacheTag}:${id}`],
        });

        this.logCacheMiss('findOneById', { id });
      }

      return result;
    } catch (error) {
      this.logger.warn('Cache operation failed, falling back to database', {
        operation: 'findOneById',
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return super.findOneById(id);
    }
  }

  /**
   * Insert with cache invalidation
   */
  async insert(entity: Aggregate | Aggregate[]): Promise<void> {
    await super.insert(entity);

    // Invalidate related caches
    await this.invalidateEntityCaches(entity);
  }

  /**
   * Update with cache invalidation
   */
  async update(entity: Aggregate): Promise<void> {
    await super.update(entity);

    // Invalidate specific entity cache and related caches
    await this.invalidateEntityCaches(entity);
  }

  /**
   * Delete with cache invalidation
   */
  async delete(entity: Aggregate): Promise<boolean> {
    const result = await super.delete(entity);

    if (result) {
      await this.invalidateEntityCaches(entity);
    }

    return result;
  }

  /**
   * Delete by ID with cache invalidation
   */
  async deleteById(id: EntityId): Promise<boolean> {
    const result = await super.deleteById(id);

    if (result) {
      await this.invalidateEntityCache(String(id));
    }

    return result;
  }

  /**
   * Count with caching for frequently accessed counts
   */
  async count(where?: SqlToken, cacheable = false): Promise<number> {
    if (!cacheable) {
      return super.count(where);
    }

    const cacheKey = this.buildCountCacheKey(where);

    return this.cacheService.getOrSet(cacheKey, () => super.count(where), {
      ttl: this.cacheTtl / 2, // Shorter TTL for counts
      tags: [this.cacheTag, `${this.cacheTag}:count`],
    });
  }

  /**
   * Cached query execution for complex read operations
   */
  protected async executeCachedQuery<T = any>(
    query: SqlToken,
    operation: string,
    cacheKey: string,
    cacheTtl?: number,
  ): Promise<T[]> {
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.executeQuery<T>(query, operation);
        return result.rows;
      },
      {
        ttl: cacheTtl || this.cacheTtl,
        tags: [this.cacheTag],
      },
    );
  }

  /**
   * Warm up cache with frequently accessed entities
   */
  async warmupCache(entityIds: string[]): Promise<void> {
    this.logger.log(`Warming up cache for ${entityIds.length} entities`, {
      table: this.tableName,
      entityCount: entityIds.length,
    });

    // Fetch entities in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);

      // Use Promise.allSettled to handle individual failures
      await Promise.allSettled(batch.map((id) => this.findOneById(id)));
    }

    this.logger.log('Cache warmup completed', {
      table: this.tableName,
      processedEntities: entityIds.length,
    });
  }

  /**
   * Invalidate all caches related to an entity
   */
  protected async invalidateEntityCaches(
    entity: Aggregate | Aggregate[],
  ): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];

    const tags = [
      this.cacheTag,
      ...entities.map((e) => `${this.cacheTag}:${e.id}`),
      `${this.cacheTag}:count`,
    ];

    await this.cacheService.invalidateByTags(tags);

    this.logCacheInvalidation('entity_operation', {
      entityIds: entities.map((e) => e.id),
      invalidatedTags: tags,
    });
  }

  /**
   * Invalidate cache for a specific entity
   */
  protected async invalidateEntityCache(entityId: string): Promise<void> {
    const tags = [
      this.cacheTag,
      `${this.cacheTag}:${entityId}`,
      `${this.cacheTag}:count`,
    ];

    await this.cacheService.invalidateByTags(tags);

    this.logCacheInvalidation('entity_delete', {
      entityId,
      invalidatedTags: tags,
    });
  }

  /**
   * Build cache key for individual entity
   */
  protected buildEntityCacheKey(id: string): string {
    return `${this.tableName}:entity:${id}`;
  }

  /**
   * Build cache key for count queries
   */
  protected buildCountCacheKey(where?: SqlToken): string {
    const whereHash = where
      ? Buffer.from(JSON.stringify(where)).toString('base64').slice(0, 16)
      : 'all';
    return `${this.tableName}:count:${whereHash}`;
  }

  /**
   * Build cache key for custom queries
   */
  protected buildQueryCacheKey(
    operation: string,
    params: Record<string, any>,
  ): string {
    return CacheKeyBuilder.buildQueryKey(
      `${this.tableName}:${operation}`,
      params,
    );
  }

  /**
   * Log cache hit for monitoring
   */
  protected logCacheHit(
    operation: string,
    context?: Record<string, any>,
  ): void {
    this.logger.debug('Cache hit', {
      table: this.tableName,
      operation,
      ...context,
    });
  }

  /**
   * Log cache miss for monitoring
   */
  protected logCacheMiss(
    operation: string,
    context?: Record<string, any>,
  ): void {
    this.logger.debug('Cache miss', {
      table: this.tableName,
      operation,
      ...context,
    });
  }

  /**
   * Log cache invalidation for monitoring
   */
  protected logCacheInvalidation(
    operation: string,
    context?: Record<string, any>,
  ): void {
    this.logger.debug('Cache invalidated', {
      table: this.tableName,
      operation,
      ...context,
    });
  }

  /**
   * Get cache statistics for this repository
   */
  getCacheStats(): ReturnType<CacheService['getCacheStats']> {
    return this.cacheService.getCacheStats();
  }

  /**
   * Clear all caches for this repository (use carefully)
   */
  async clearRepositoryCache(): Promise<void> {
    await this.cacheService.invalidateByTags([this.cacheTag]);

    this.logger.warn('Repository cache cleared', {
      table: this.tableName,
    });
  }
}

/**
 * Decorator for caching repository methods
 */
export function CacheResult(ttl?: number, tags?: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const repository = this as CachedRepositoryBase<any, any>;
      const cacheKey = repository.buildQueryCacheKey(propertyKey, { args });

      return repository.cacheService.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        {
          ttl: ttl || repository.cacheTtl,
          tags: tags || [repository.cacheTag],
        },
      );
    };

    return descriptor;
  };
}
