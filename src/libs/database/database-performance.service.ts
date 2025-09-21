import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { sql } from 'slonik';

interface PerformanceMetrics {
  readonly connectionPool: ConnectionPoolMetrics;
  readonly queryPerformance: QueryPerformanceMetrics;
  readonly tableStatistics: TableStatistics[];
  readonly indexUsage: IndexUsageMetrics[];
  readonly slowQueries: SlowQueryMetrics[];
}

interface ConnectionPoolMetrics {
  readonly activeConnections: number;
  readonly idleConnections: number;
  readonly totalConnections: number;
  readonly utilization: number;
  readonly waitingClients: number;
}

interface QueryPerformanceMetrics {
  readonly totalQueries: number;
  readonly avgResponseTime: number;
  readonly slowQueryCount: number;
  readonly cacheHitRatio: number;
}

interface TableStatistics {
  readonly tableName: string;
  readonly totalOperations: number;
  readonly inserts: number;
  readonly updates: number;
  readonly deletes: number;
  readonly indexUsagePercent: number;
  readonly sequentialScans: number;
}

interface IndexUsageMetrics {
  readonly indexName: string;
  readonly tableName: string;
  readonly scans: number;
  readonly tuplesFetched: number;
  readonly isEffective: boolean;
}

interface SlowQueryMetrics {
  readonly query: string;
  readonly calls: number;
  readonly totalTime: number;
  readonly meanTime: number;
  readonly rows: number;
  readonly hitPercent: number;
}

interface OptimizationRecommendation {
  readonly type: 'index' | 'query' | 'configuration' | 'schema';
  readonly priority: 'high' | 'medium' | 'low';
  readonly description: string;
  readonly impact: string;
  readonly action: string;
}

@Injectable()
export class DatabasePerformanceService implements OnModuleInit {
  private readonly logger = new Logger(DatabasePerformanceService.name);
  private performanceHistory: PerformanceMetrics[] = [];
  private readonly maxHistorySize = 100; // Keep last 100 measurements

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Database Performance Service initialized');

    // Initial performance check
    try {
      await this.collectPerformanceMetrics();
      this.logger.log('Initial performance metrics collected');
    } catch (error) {
      this.logger.warn('Failed to collect initial performance metrics', error);
    }
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [
        connectionPool,
        queryPerformance,
        tableStatistics,
        indexUsage,
        slowQueries,
      ] = await Promise.all([
        this.getConnectionPoolMetrics(),
        this.getQueryPerformanceMetrics(),
        this.getTableStatistics(),
        this.getIndexUsage(),
        this.getSlowQueries(),
      ]);

      const metrics: PerformanceMetrics = {
        connectionPool,
        queryPerformance,
        tableStatistics,
        indexUsage,
        slowQueries,
      };

      // Store metrics in history
      this.storeMetricsHistory(metrics);

      // Log critical issues
      this.logCriticalIssues(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect performance metrics', error);
      throw error;
    }
  }

  /**
   * Get connection pool metrics
   */
  private async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    try {
      // Query PostgreSQL connection statistics
      const result = await this.databaseService.query(
        sql.unsafe`
          SELECT
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections,
            count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_clients
          FROM pg_stat_activity
          WHERE datname = current_database()
        `,
      );

      const stats = result.rows[0];
      const activeConnections = Number(stats.active_connections) || 0;
      const idleConnections = Number(stats.idle_connections) || 0;
      const totalConnections = Number(stats.total_connections) || 1;
      const waitingClients = Number(stats.waiting_clients) || 0;

      return {
        activeConnections,
        idleConnections,
        totalConnections,
        utilization: (activeConnections / totalConnections) * 100,
        waitingClients,
      };
    } catch (error) {
      this.logger.warn('Failed to get connection pool metrics', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        utilization: 0,
        waitingClients: 0,
      };
    }
  }

  /**
   * Get query performance metrics from pg_stat_statements
   */
  private async getQueryPerformanceMetrics(): Promise<QueryPerformanceMetrics> {
    try {
      const result = await this.databaseService.query(
        sql.unsafe`
          SELECT
            sum(calls) as total_queries,
            avg(mean_time) as avg_response_time,
            count(*) FILTER (WHERE mean_time > 100) as slow_query_count,
            avg(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0)) as cache_hit_ratio
          FROM pg_stat_statements
        `,
      );

      const stats = result.rows[0];

      return {
        totalQueries: Number(stats.total_queries) || 0,
        avgResponseTime: Number(stats.avg_response_time) || 0,
        slowQueryCount: Number(stats.slow_query_count) || 0,
        cacheHitRatio: Number(stats.cache_hit_ratio) || 0,
      };
    } catch (error) {
      this.logger.warn(
        'Failed to get query performance metrics (pg_stat_statements may not be enabled)',
        error,
      );
      return {
        totalQueries: 0,
        avgResponseTime: 0,
        slowQueryCount: 0,
        cacheHitRatio: 0,
      };
    }
  }

  /**
   * Get table usage statistics
   */
  private async getTableStatistics(): Promise<TableStatistics[]> {
    try {
      const result = await this.databaseService.query(
        sql.unsafe`
          SELECT
            tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_tup_ins + n_tup_upd + n_tup_del as total_operations,
            seq_scan,
            idx_scan,
            CASE WHEN seq_scan + idx_scan > 0
              THEN 100.0 * idx_scan / (seq_scan + idx_scan)
              ELSE 0
            END as index_usage_percent
          FROM pg_stat_user_tables
          ORDER BY total_operations DESC
          LIMIT 20
        `,
      );

      return result.rows.map((row) => ({
        tableName: String(row.tablename),
        inserts: Number(row.inserts) || 0,
        updates: Number(row.updates) || 0,
        deletes: Number(row.deletes) || 0,
        totalOperations: Number(row.total_operations) || 0,
        sequentialScans: Number(row.seq_scan) || 0,
        indexUsagePercent: Number(row.index_usage_percent) || 0,
      }));
    } catch (error) {
      this.logger.warn('Failed to get table statistics', error);
      return [];
    }
  }

  /**
   * Get index usage metrics
   */
  private async getIndexUsage(): Promise<IndexUsageMetrics[]> {
    try {
      const result = await this.databaseService.query(
        sql.unsafe`
          SELECT
            schemaname,
            tablename,
            indexname,
            idx_scan as scans,
            idx_tup_fetch as tuples_fetched
          FROM pg_stat_user_indexes
          ORDER BY idx_scan DESC
          LIMIT 50
        `,
      );

      return result.rows.map((row) => ({
        indexName: String(row.indexname),
        tableName: String(row.tablename),
        scans: Number(row.scans) || 0,
        tuplesFetched: Number(row.tuples_fetched) || 0,
        isEffective: Number(row.scans) > 100, // Consider effective if used more than 100 times
      }));
    } catch (error) {
      this.logger.warn('Failed to get index usage metrics', error);
      return [];
    }
  }

  /**
   * Get slow query metrics
   */
  private async getSlowQueries(): Promise<SlowQueryMetrics[]> {
    try {
      const result = await this.databaseService.query(
        sql.unsafe`
          SELECT
            query,
            calls,
            total_time,
            mean_time,
            rows,
            100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
          FROM pg_stat_statements
          WHERE mean_time > 100
          ORDER BY mean_time DESC
          LIMIT 10
        `,
      );

      return result.rows.map((row) => ({
        query: String(row.query).substring(0, 200), // Truncate for logging
        calls: Number(row.calls) || 0,
        totalTime: Number(row.total_time) || 0,
        meanTime: Number(row.mean_time) || 0,
        rows: Number(row.rows) || 0,
        hitPercent: Number(row.hit_percent) || 0,
      }));
    } catch (error) {
      this.logger.warn('Failed to get slow query metrics', error);
      return [];
    }
  }

  /**
   * Generate optimization recommendations based on metrics
   */
  generateOptimizationRecommendations(
    metrics: PerformanceMetrics,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check connection pool utilization
    if (metrics.connectionPool.utilization > 80) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        description: 'Connection pool utilization is high',
        impact: 'May cause connection delays and timeouts',
        action:
          'Consider increasing maximum pool size or optimizing connection usage',
      });
    }

    // Check for tables with low index usage
    metrics.tableStatistics.forEach((table) => {
      if (table.indexUsagePercent < 50 && table.totalOperations > 1000) {
        recommendations.push({
          type: 'index',
          priority: 'medium',
          description: `Table "${table.tableName}" has low index usage (${table.indexUsagePercent.toFixed(1)}%)`,
          impact: 'Sequential scans may be slowing down queries',
          action:
            'Review queries against this table and consider adding appropriate indexes',
        });
      }
    });

    // Check for unused indexes
    metrics.indexUsage.forEach((index) => {
      if (index.scans < 10) {
        recommendations.push({
          type: 'index',
          priority: 'low',
          description: `Index "${index.indexName}" on table "${index.tableName}" is rarely used`,
          impact: 'Unused indexes consume storage and slow down writes',
          action: "Consider dropping this index if it's not needed",
        });
      }
    });

    // Check cache hit ratio
    if (metrics.queryPerformance.cacheHitRatio < 95) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        description: `Cache hit ratio is low (${metrics.queryPerformance.cacheHitRatio.toFixed(1)}%)`,
        impact: 'Queries are reading from disk more than necessary',
        action:
          'Consider increasing shared_buffers or analyzing query patterns',
      });
    }

    // Check for slow queries
    if (metrics.slowQueries.length > 0) {
      recommendations.push({
        type: 'query',
        priority: 'high',
        description: `${metrics.slowQueries.length} slow queries detected`,
        impact: 'Slow queries impact overall application performance',
        action:
          'Review and optimize slow queries, consider adding indexes or rewriting queries',
      });
    }

    return recommendations;
  }

  /**
   * Store metrics in history for trend analysis
   */
  private storeMetricsHistory(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);

    // Keep only the last N measurements
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(
        -this.maxHistorySize,
      );
    }
  }

  /**
   * Log critical performance issues
   */
  private logCriticalIssues(metrics: PerformanceMetrics): void {
    // High connection pool utilization
    if (metrics.connectionPool.utilization > 90) {
      this.logger.warn(
        `High connection pool utilization: ${metrics.connectionPool.utilization.toFixed(1)}%`,
      );
    }

    // Many waiting clients
    if (metrics.connectionPool.waitingClients > 5) {
      this.logger.warn(
        `${metrics.connectionPool.waitingClients} clients waiting for connections`,
      );
    }

    // Low cache hit ratio
    if (metrics.queryPerformance.cacheHitRatio < 90) {
      this.logger.warn(
        `Low cache hit ratio: ${metrics.queryPerformance.cacheHitRatio.toFixed(1)}%`,
      );
    }

    // Many slow queries
    if (metrics.slowQueries.length > 5) {
      this.logger.warn(`${metrics.slowQueries.length} slow queries detected`);
    }
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(): {
    connectionUtilizationTrend: number[];
    avgResponseTimeTrend: number[];
    cacheHitRatioTrend: number[];
  } {
    return {
      connectionUtilizationTrend: this.performanceHistory.map(
        (m) => m.connectionPool.utilization,
      ),
      avgResponseTimeTrend: this.performanceHistory.map(
        (m) => m.queryPerformance.avgResponseTime,
      ),
      cacheHitRatioTrend: this.performanceHistory.map(
        (m) => m.queryPerformance.cacheHitRatio,
      ),
    };
  }

  /**
   * Scheduled performance monitoring (runs every 5 minutes)
   * Note: Schedule this method externally or integrate with your job scheduler
   */
  async scheduledPerformanceCheck(): Promise<void> {
    try {
      const metrics = await this.collectPerformanceMetrics();

      // Generate and log recommendations for critical issues
      const recommendations = this.generateOptimizationRecommendations(metrics);
      const criticalRecommendations = recommendations.filter(
        (r) => r.priority === 'high',
      );

      if (criticalRecommendations.length > 0) {
        this.logger.warn(
          `${criticalRecommendations.length} critical performance issues detected`,
        );
        criticalRecommendations.forEach((rec) => {
          this.logger.warn(`${rec.description}: ${rec.action}`);
        });
      }
    } catch (error) {
      this.logger.error('Scheduled performance check failed', error);
    }
  }

  /**
   * Run database maintenance tasks (materialized view refresh)
   * Note: Schedule this method externally or integrate with your job scheduler
   */
  async scheduledMaintenance(): Promise<void> {
    try {
      this.logger.debug('Running scheduled database maintenance');

      await this.databaseService.query(
        sql.unsafe`SELECT perform_maintenance()`,
      );

      this.logger.debug('Database maintenance completed successfully');
    } catch (error) {
      this.logger.error('Scheduled database maintenance failed', error);
    }
  }

  /**
   * Get current performance summary for health checks
   */
  async getPerformanceSummary(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: Partial<PerformanceMetrics>;
    recommendations: OptimizationRecommendation[];
  }> {
    try {
      const metrics = await this.collectPerformanceMetrics();
      const recommendations = this.generateOptimizationRecommendations(metrics);

      // Determine overall health status
      const criticalIssues = recommendations.filter(
        (r) => r.priority === 'high',
      ).length;
      const warningIssues = recommendations.filter(
        (r) => r.priority === 'medium',
      ).length;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalIssues > 0) {
        status = 'critical';
      } else if (warningIssues > 0) {
        status = 'warning';
      }

      return {
        status,
        metrics: {
          connectionPool: metrics.connectionPool,
          queryPerformance: metrics.queryPerformance,
        },
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      };
    } catch (error) {
      this.logger.error('Failed to get performance summary', error);
      return {
        status: 'critical',
        metrics: {},
        recommendations: [
          {
            type: 'configuration',
            priority: 'high',
            description: 'Failed to collect performance metrics',
            impact: 'Unable to monitor database performance',
            action:
              'Check database connectivity and pg_stat_statements extension',
          },
        ],
      };
    }
  }
}
