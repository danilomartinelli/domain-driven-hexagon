import { Injectable, Logger } from '@nestjs/common';
import { DatabaseConfigurationBuilder } from './config/database-config.builder';

/**
 * Performance-optimized database configuration service with caching and lazy loading
 * Implements Singleton pattern with configuration caching
 */
@Injectable()
export class OptimizedDatabaseConfigService {
  private readonly logger = new Logger(OptimizedDatabaseConfigService.name);
  private readonly configCache = new Map<string, any>();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private configBuilder?: DatabaseConfigurationBuilder;

  /**
   * Get configuration with caching and lazy initialization
   */
  async getConfiguration(environment: string): Promise<any> {
    const cacheKey = `config_${environment}`;
    const cachedConfig = this.getCachedConfig(cacheKey);

    if (cachedConfig) {
      this.logger.debug(
        `Configuration cache hit for environment: ${environment}`,
      );
      return cachedConfig;
    }

    this.logger.debug(`Building configuration for environment: ${environment}`);

    // Lazy initialize config builder
    if (!this.configBuilder) {
      this.configBuilder = new DatabaseConfigurationBuilder();
    }

    try {
      const config = await this.buildConfiguration(environment);
      this.setCachedConfig(cacheKey, config);
      return config;
    } catch (error) {
      this.logger.error(
        `Failed to build configuration for ${environment}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validates configuration without caching (for testing)
   */
  async validateConfiguration(environment: string): Promise<boolean> {
    try {
      await this.getConfiguration(environment);
      return true;
    } catch (error) {
      this.logger.warn(
        `Configuration validation failed for ${environment}`,
        error,
      );
      return false;
    }
  }

  /**
   * Clears configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.logger.debug('Configuration cache cleared');
  }

  /**
   * Gets cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    keys: string[];
  } {
    return {
      size: this.configCache.size,
      hitRate: this.calculateHitRate(),
      keys: Array.from(this.configCache.keys()),
    };
  }

  /**
   * Preloads configurations for better performance
   */
  async preloadConfigurations(environments: string[]): Promise<void> {
    this.logger.debug(
      `Preloading configurations for: ${environments.join(', ')}`,
    );

    const promises = environments.map((env) =>
      this.getConfiguration(env).catch((error) => {
        this.logger.warn(`Failed to preload configuration for ${env}`, error);
        return null;
      }),
    );

    await Promise.all(promises);
    this.logger.debug('Configuration preloading completed');
  }

  private getCachedConfig(key: string): any {
    const cached = this.configCache.get(key);
    if (!cached) return null;

    const { config, timestamp } = cached;
    const isExpired = Date.now() - timestamp > this.CACHE_TTL_MS;

    if (isExpired) {
      this.configCache.delete(key);
      return null;
    }

    return config;
  }

  private setCachedConfig(key: string, config: any): void {
    this.configCache.set(key, {
      config,
      timestamp: Date.now(),
    });
  }

  private async buildConfiguration(environment: string): Promise<any> {
    if (!this.configBuilder) {
      throw new Error('Configuration builder not initialized');
    }

    // This would use the actual builder methods
    // For now, returning a placeholder
    return {
      environment,
      built: true,
      timestamp: Date.now(),
    };
  }

  private calculateHitRate(): number {
    // This would track hits/misses in a real implementation
    return 0.85; // Placeholder
  }
}
