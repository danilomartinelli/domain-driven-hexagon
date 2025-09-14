import { Injectable, Logger } from '@nestjs/common';
import { DatabasePool } from 'slonik';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerPort } from '@libs/ports/logger.port';

/**
 * Factory for creating optimized repository instances with shared connection pooling
 * Implements Singleton pattern for connection reuse and Factory pattern for repository creation
 */
@Injectable()
export class RepositoryFactory {
  private readonly logger = new Logger(RepositoryFactory.name);
  private readonly repositoryCache = new Map<string, any>();

  constructor(
    private readonly pool: DatabasePool,
    private readonly eventEmitter: EventEmitter2,
    private readonly loggerPort: LoggerPort,
  ) {}

  /**
   * Creates or retrieves cached repository instance
   * Implements Repository pattern with connection pooling optimization
   */
  createRepository<T, M>(
    repositoryClass: new (...args: any[]) => T,
    mapper: M,
    tableName: string,
  ): T {
    const cacheKey = `${repositoryClass.name}_${tableName}`;

    if (this.repositoryCache.has(cacheKey)) {
      this.logger.debug(`Repository cache hit for ${cacheKey}`);
      return this.repositoryCache.get(cacheKey);
    }

    this.logger.debug(`Creating new repository instance for ${cacheKey}`);
    const repository = new repositoryClass(
      this.pool,
      mapper,
      this.eventEmitter,
      this.loggerPort,
    );

    // Cache the repository for reuse
    this.repositoryCache.set(cacheKey, repository);

    return repository;
  }

  /**
   * Clears repository cache - useful for testing or memory optimization
   */
  clearCache(): void {
    this.repositoryCache.clear();
    this.logger.debug('Repository cache cleared');
  }

  /**
   * Gets cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.repositoryCache.size,
      keys: Array.from(this.repositoryCache.keys()),
    };
  }
}
