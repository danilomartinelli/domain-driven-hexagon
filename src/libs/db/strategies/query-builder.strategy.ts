import { sql, SqlToken } from 'slonik';
import { ObjectLiteral } from '../../types';

/**
 * Strategy interface for building SQL queries
 */
export interface QueryBuilderStrategy {
  buildInsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    models: TModel[],
  ): SqlToken;

  buildUpdateQuery<TModel extends ObjectLiteral>(
    tableName: string,
    model: TModel,
    id: string | number,
  ): SqlToken;

  buildUpsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    model: TModel,
  ): SqlToken;
}

/**
 * PostgreSQL-specific query builder implementation
 */
export class PostgreSqlQueryBuilderStrategy implements QueryBuilderStrategy {
  private static readonly MAX_BATCH_SIZE = 1000;

  buildInsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    models: TModel[],
  ): SqlToken {
    this.validateBatchInsertInput(models);

    const firstModel = models[0];
    const columns = this.extractDefinedColumns(firstModel);

    if (columns.length === 0) {
      throw new QueryBuilderError(
        'Cannot generate insert query for object with no defined properties',
        'EMPTY_COLUMNS',
      );
    }

    const columnIdentifiers = columns.map((col) => sql.identifier([col]));
    const columnFragment = sql.join(columnIdentifiers, sql.fragment`, `);

    // Optimize for single vs batch inserts
    if (models.length === 1) {
      return this.buildSingleInsertQuery(
        tableName,
        columnFragment,
        columns,
        firstModel,
      );
    }

    return this.buildBatchInsertQuery(
      tableName,
      columnFragment,
      columns,
      models,
    );
  }

  buildUpdateQuery<TModel extends ObjectLiteral>(
    tableName: string,
    model: TModel,
    id: string | number,
  ): SqlToken {
    const updateEntries = Object.entries(model).filter(
      ([key, value]) => key !== 'id' && value !== undefined,
    );

    if (updateEntries.length === 0) {
      throw new QueryBuilderError(
        'Cannot generate update query with no fields to update',
        'NO_UPDATE_FIELDS',
      );
    }

    const setClause = updateEntries.map(
      ([key, value]) =>
        sql.unsafe`${sql.identifier([key])} = ${this.formatQueryValue(value)}`,
    );

    return sql.unsafe`
      UPDATE ${sql.identifier([tableName])} 
      SET ${sql.join(setClause, sql.fragment`, `)} 
      WHERE id = ${id}
    `;
  }

  buildUpsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    model: TModel,
  ): SqlToken {
    const columns = this.extractDefinedColumns(model);

    if (columns.length === 0) {
      throw new QueryBuilderError(
        'Cannot generate upsert query for object with no defined properties',
        'EMPTY_COLUMNS',
      );
    }

    const columnIdentifiers = columns.map((col) => sql.identifier([col]));
    const columnFragment = sql.join(columnIdentifiers, sql.fragment`, `);

    const values = columns.map((col) => this.formatQueryValue(model[col]));
    const valuesFragment = sql.join(values, sql.fragment`, `);

    // Generate SET clause for ON CONFLICT UPDATE (exclude id and timestamps)
    const updateColumns = columns.filter(
      (col) => col !== 'id' && col !== 'created_at' && col !== 'createdAt',
    );

    if (updateColumns.length === 0) {
      // If no updatable columns, use DO NOTHING
      return sql.unsafe`
        INSERT INTO ${sql.identifier([tableName])} 
        (${columnFragment}) 
        VALUES (${valuesFragment})
        ON CONFLICT (id) DO NOTHING
      `;
    }

    const setClause = updateColumns.map(
      (col) =>
        sql.unsafe`${sql.identifier([col])} = EXCLUDED.${sql.identifier([col])}`,
    );

    return sql.unsafe`
      INSERT INTO ${sql.identifier([tableName])} 
      (${columnFragment}) 
      VALUES (${valuesFragment})
      ON CONFLICT (id) DO UPDATE SET 
      ${sql.join(setClause, sql.fragment`, `)}
    `;
  }

  private buildSingleInsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    columnFragment: SqlToken,
    columns: string[],
    model: TModel,
  ): SqlToken {
    const values = columns.map((col) => this.formatQueryValue(model[col]));
    const valuesFragment = sql.join(values, sql.fragment`, `);

    return sql.unsafe`
      INSERT INTO ${sql.identifier([tableName])} 
      (${columnFragment}) 
      VALUES (${valuesFragment})
    `;
  }

  private buildBatchInsertQuery<TModel extends ObjectLiteral>(
    tableName: string,
    columnFragment: SqlToken,
    columns: string[],
    models: TModel[],
  ): SqlToken {
    // Process in chunks to avoid query size limits
    const chunks = this.chunkArray(
      models,
      PostgreSqlQueryBuilderStrategy.MAX_BATCH_SIZE,
    );

    if (chunks.length > 1) {
      throw new QueryBuilderError(
        `Batch size exceeds maximum allowed (${PostgreSqlQueryBuilderStrategy.MAX_BATCH_SIZE}). Consider using multiple smaller batches.`,
        'BATCH_TOO_LARGE',
      );
    }

    const valueRows = models.map((model) => {
      const values = columns.map((col) => this.formatQueryValue(model[col]));
      return sql.join(values, sql.fragment`, `);
    });

    const valuesFragment = sql.join(
      valueRows.map((row) => sql.unsafe`(${row})`),
      sql.fragment`, `,
    );

    return sql.unsafe`
      INSERT INTO ${sql.identifier([tableName])} 
      (${columnFragment}) 
      VALUES ${valuesFragment}
    `;
  }

  private extractDefinedColumns<TModel extends ObjectLiteral>(
    model: TModel,
  ): string[] {
    return Object.keys(model).filter((key) => model[key] !== undefined);
  }

  /**
   * Format values for SQL queries with enhanced type safety and performance
   */
  private formatQueryValue(value: unknown): SqlToken {
    if (value === null || value === undefined) {
      return sql.unsafe`NULL`;
    }

    // Handle Date objects with timezone awareness
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        throw new QueryBuilderError(
          'Invalid Date object provided',
          'INVALID_DATE',
        );
      }
      return sql.timestamp(value);
    }

    // Handle arrays (PostgreSQL arrays)
    if (Array.isArray(value)) {
      return sql.array(value, 'text');
    }

    // Handle objects (JSON/JSONB)
    if (typeof value === 'object' && value !== null) {
      try {
        return sql.json(JSON.stringify(value));
      } catch (error) {
        throw new QueryBuilderError(
          `Failed to serialize object to JSON: ${(error as Error).message}`,
          'JSON_SERIALIZATION_ERROR',
        );
      }
    }

    // Handle bigint
    if (typeof value === 'bigint') {
      return sql.unsafe`${value.toString()}`;
    }

    // Handle boolean explicitly
    if (typeof value === 'boolean') {
      return sql.unsafe`${value}`;
    }

    // Handle numbers with validation
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new QueryBuilderError(
          'Invalid number value (NaN or Infinity)',
          'INVALID_NUMBER',
        );
      }
      return sql.unsafe`${value}`;
    }

    // Handle strings and other primitive types
    return value as SqlToken;
  }

  private validateBatchInsertInput<TModel extends ObjectLiteral>(
    models: TModel[],
  ): void {
    if (models.length === 0) {
      throw new QueryBuilderError(
        'Cannot generate insert query for empty array',
        'EMPTY_MODELS_ARRAY',
      );
    }

    if (models.length > PostgreSqlQueryBuilderStrategy.MAX_BATCH_SIZE) {
      throw new QueryBuilderError(
        `Batch size (${models.length}) exceeds maximum allowed (${PostgreSqlQueryBuilderStrategy.MAX_BATCH_SIZE})`,
        'BATCH_TOO_LARGE',
      );
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Custom error class for query builder operations
 */
export class QueryBuilderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'QueryBuilderError';
  }
}
