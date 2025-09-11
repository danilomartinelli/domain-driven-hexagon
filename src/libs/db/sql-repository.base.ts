import { RequestContextService } from '@libs/application/context/AppRequestContext';
import { AggregateRoot, PaginatedQueryParams, Paginated } from '@libs/ddd';
import { Mapper } from '@libs/ddd';
import { RepositoryPort } from '@libs/ddd';
import { ConflictException } from '@libs/exceptions';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { None, Option, Some } from 'oxide.ts';
import {
  DatabasePool,
  DatabaseTransactionConnection,
  // IdentifierSqlToken,
  QueryResult,
  sql,
  UniqueIntegrityConstraintViolationError,
  NotFoundError,
  DataIntegrityError,
  // ValueExpressionToken, // Not available in v48
  SqlToken,
} from 'slonik';
import { ZodSchema, ZodType, z } from 'zod';
import { LoggerPort } from '../ports/logger.port';
import { ObjectLiteral } from '../types';

/**
 * Generic type-safe repository base class for SQL operations using Slonik.
 * Provides common CRUD operations with proper type safety, validation, and event handling.
 *
 * @template Aggregate - The domain aggregate type
 * @template DbModel - The database model type
 * @template EntityId - The entity identifier type (defaults to string)
 */
export abstract class SqlRepositoryBase<
  Aggregate extends AggregateRoot<any>,
  DbModel extends ObjectLiteral,
  EntityId extends string | number = string,
> implements RepositoryPort<Aggregate>
{
  /** Table name for this repository */
  protected abstract tableName: string;

  /** Zod schema for validating database records */
  protected abstract schema: ZodSchema<DbModel>;

  /** Optional schema for validating entity IDs */
  protected idSchema?: ZodType<EntityId> =
    z.string() as unknown as ZodType<EntityId>;

  protected constructor(
    private readonly _pool: DatabasePool,
    protected readonly mapper: Mapper<Aggregate, DbModel>,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly logger: LoggerPort,
  ) {}

  /**
   * Find a single entity by its ID with proper type safety and validation
   */
  async findOneById(id: string): Promise<Option<Aggregate>> {
    try {
      // Validate ID format if schema is provided
      const validatedId = this.idSchema ? this.idSchema.parse(id) : id;

      const query = sql.type(this.schema)`
        SELECT * FROM ${sql.identifier([this.tableName])} 
        WHERE id = ${validatedId}
      `;

      const result = await this.executeQuery(query, 'findOneById');

      if (result.rows.length === 0) {
        return None;
      }

      const validatedRow = this.schema.parse(result.rows[0]);
      const entity = this.mapper.toDomain(validatedRow);

      this.logOperation('findOneById', { id: validatedId, found: true });
      return Some(entity);
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findOneById', { id });
      return None;
    }
  }

  /**
   * Find all entities with optional ordering and filtering
   */
  async findAll(options?: {
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    where?: SqlToken;
  }): Promise<Aggregate[]> {
    try {
      let query = sql.type(
        this.schema,
      )`SELECT * FROM ${sql.identifier([this.tableName])}`;

      // Add WHERE clause if provided
      if (options?.where) {
        query = sql.type(this.schema)`${query} WHERE ${options.where}`;
      }

      // Add ORDER BY clause if provided
      if (options?.orderBy) {
        const direction = options.orderDirection || 'ASC';
        query = sql.type(
          this.schema,
        )`${query} ORDER BY ${sql.identifier([options.orderBy])} ${sql.fragment`${direction}`}`;
      }

      const result = await this.executeQuery(query, 'findAll');

      const entities = result.rows.map((row) => {
        const validatedRow = this.schema.parse(row);
        return this.mapper.toDomain(validatedRow);
      });

      this.logOperation('findAll', { count: entities.length });
      return entities;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findAll');
      return [];
    }
  }

  /**
   * Find entities with pagination, including total count for proper pagination metadata
   */
  async findAllPaginated(
    params: PaginatedQueryParams,
    options?: {
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      where?: SqlToken;
    },
  ): Promise<Paginated<Aggregate>> {
    try {
      // Build base query
      let baseQuery = sql.fragment`FROM ${sql.identifier([this.tableName])}`;

      if (options?.where) {
        baseQuery = sql.fragment`${baseQuery} WHERE ${options.where}`;
      }

      // Get total count for pagination metadata
      const countQuery = sql.unsafe`SELECT COUNT(*) as total ${baseQuery}`;
      const countResult = await this.executeQuery(
        countQuery,
        'findAllPaginated:count',
      );
      const totalCount = Number(countResult.rows[0]?.total || 0);

      // Build main query with pagination
      let dataQuery = sql.type(this.schema)`SELECT * ${baseQuery}`;

      // Add ordering
      if (options?.orderBy) {
        const direction = options.orderDirection || 'ASC';
        dataQuery = sql.type(
          this.schema,
        )`${dataQuery} ORDER BY ${sql.identifier([options.orderBy])} ${sql.fragment`${direction}`}`;
      }

      // Add pagination
      dataQuery = sql.type(
        this.schema,
      )`${dataQuery} LIMIT ${params.limit} OFFSET ${params.offset}`;

      const result = await this.executeQuery(
        dataQuery,
        'findAllPaginated:data',
      );

      const entities = result.rows.map((row) => {
        const validatedRow = this.schema.parse(row);
        return this.mapper.toDomain(validatedRow);
      });

      const paginatedResult = new Paginated({
        data: entities,
        count: totalCount,
        limit: params.limit,
        page: params.page,
      });

      this.logOperation('findAllPaginated', {
        count: entities.length,
        totalCount,
        page: params.page,
        limit: params.limit,
      });

      return paginatedResult;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findAllPaginated', params);
      // Return empty paginated result on error
      return new Paginated({
        data: [],
        count: 0,
        limit: params.limit,
        page: params.page,
      });
    }
  }

  /**
   * Delete an entity by its instance with proper validation and event publishing
   */
  async delete(entity: Aggregate): Promise<boolean> {
    try {
      entity.validate();

      const validatedId = this.idSchema
        ? this.idSchema.parse(entity.id)
        : entity.id;

      const query = sql.unsafe`
        DELETE FROM ${sql.identifier([this.tableName])} 
        WHERE id = ${validatedId}
      `;

      const result = await this.executeWriteQuery(query, entity, 'delete');
      const deleted = result.rowCount > 0;

      if (deleted) {
        await entity.publishEvents(this.logger, this.eventEmitter);
        this.logOperation('delete', { id: entity.id, success: true });
      } else {
        this.logOperation('delete', {
          id: entity.id,
          success: false,
          reason: 'not_found',
        });
      }

      return deleted;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'delete', { id: entity.id });
      return false;
    }
  }

  /**
   * Delete an entity by its ID
   */
  async deleteById(id: EntityId): Promise<boolean> {
    try {
      const validatedId = this.idSchema ? this.idSchema.parse(id) : id;

      const query = sql.unsafe`
        DELETE FROM ${sql.identifier([this.tableName])} 
        WHERE id = ${validatedId}
      `;

      const result = await this.executeQuery(query, 'deleteById');
      const deleted = result.rowCount > 0;

      this.logOperation('deleteById', { id: validatedId, success: deleted });
      return deleted;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'deleteById', { id });
      return false;
    }
  }

  /**
   * Insert one or more entities with proper validation and event publishing
   */
  async insert(entity: Aggregate | Aggregate[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];

    if (entities.length === 0) {
      return;
    }

    try {
      // Validate all entities before persistence
      entities.forEach((entity) => entity.validate());

      const records = entities.map((entity) => {
        const persistenceModel = this.mapper.toPersistence(entity);
        // Validate against schema before insertion
        return this.schema.parse(persistenceModel);
      });

      const query = this.generateBatchInsertQuery(records);

      await this.executeWriteQuery(query, entities, 'insert');

      // Publish events for all entities
      await Promise.all(
        entities.map((entity) =>
          entity.publishEvents(this.logger, this.eventEmitter),
        ),
      );

      this.logOperation('insert', {
        count: entities.length,
        ids: entities.map((e) => e.id),
      });
    } catch (error) {
      if (error instanceof UniqueIntegrityConstraintViolationError) {
        this.logger.debug(
          `[${RequestContextService.getRequestId()}] Unique constraint violation: ${error.message}`,
        );
        throw new ConflictException('Record already exists', error);
      }
      this.handleRepositoryError(error as Error, 'insert', {
        count: entities.length,
      });
      throw error;
    }
  }

  /**
   * Update an existing entity
   */
  async update(entity: Aggregate): Promise<void> {
    try {
      entity.validate();

      const persistenceModel = this.mapper.toPersistence(entity);
      const validatedModel = this.schema.parse(persistenceModel);
      const validatedId = this.idSchema
        ? this.idSchema.parse(entity.id)
        : entity.id;

      const query = this.generateUpdateQuery(
        validatedModel,
        validatedId as EntityId,
      );

      const result = await this.executeWriteQuery(query, entity, 'update');

      if (result.rowCount === 0) {
        throw new NotFoundError(`Entity with id ${entity.id} not found`, {
          sql: 'UPDATE query',
          values: [],
        });
      }

      await entity.publishEvents(this.logger, this.eventEmitter);

      this.logOperation('update', { id: entity.id, success: true });
    } catch (error) {
      this.handleRepositoryError(error as Error, 'update', { id: entity.id });
      throw error;
    }
  }

  /**
   * Upsert (insert or update) an entity
   */
  async upsert(entity: Aggregate): Promise<void> {
    try {
      entity.validate();

      const persistenceModel = this.mapper.toPersistence(entity);
      const validatedModel = this.schema.parse(persistenceModel);

      const query = this.generateUpsertQuery(validatedModel);

      await this.executeWriteQuery(query, entity, 'upsert');
      await entity.publishEvents(this.logger, this.eventEmitter);

      this.logOperation('upsert', { id: entity.id, success: true });
    } catch (error) {
      this.handleRepositoryError(error as Error, 'upsert', { id: entity.id });
      throw error;
    }
  }

  /**
   * Execute a write query with proper error handling and logging
   */
  protected async executeWriteQuery<T = any>(
    sqlQuery: SqlToken,
    entity: Aggregate | Aggregate[],
    operation: string,
  ): Promise<QueryResult<T>> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const entityIds = entities.map((e) => e.id);
    const startTime = Date.now();

    this.logger.debug(
      `[${RequestContextService.getRequestId()}] ${operation}: writing ${
        entities.length
      } entities to "${this.tableName}" table: ${entityIds}`,
    );

    try {
      const result = await this.pool.query(sqlQuery as any);

      const duration = Date.now() - startTime;
      this.logger.debug(
        `[${RequestContextService.getRequestId()}] ${operation} completed in ${duration}ms, affected rows: ${result.rowCount}`,
      );

      return result as QueryResult<T>;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${RequestContextService.getRequestId()}] ${operation} failed after ${duration}ms`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          entityIds,
        },
      );
      throw error;
    }
  }

  /**
   * Execute a read query with proper error handling and logging
   */
  protected async executeQuery<T = any>(
    sqlQuery: SqlToken,
    operation: string,
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    this.logger.debug(
      `[${RequestContextService.getRequestId()}] ${operation}: executing query on "${this.tableName}" table`,
    );

    try {
      const result = await this.pool.query(sqlQuery as any);

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        this.logger.warn(
          `[${RequestContextService.getRequestId()}] Slow query detected: ${operation} took ${duration}ms`,
        );
      }

      return result as QueryResult<T>;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${RequestContextService.getRequestId()}] ${operation} failed after ${duration}ms`,
        { error: error instanceof Error ? error.message : 'Unknown error' },
      );
      throw error;
    }
  }

  /**
   * Generate optimized batch insert query for multiple records
   */
  protected generateBatchInsertQuery(models: DbModel[]): SqlToken {
    if (models.length === 0) {
      throw new Error('Cannot generate insert query for empty array');
    }

    const firstModel = models[0];
    const columns = Object.keys(firstModel).filter(
      (key) => firstModel[key] !== undefined,
    );

    if (columns.length === 0) {
      throw new Error(
        'Cannot generate insert query for object with no defined properties',
      );
    }

    const columnIdentifiers = columns.map((col) => sql.identifier([col]));
    const columnFragment = sql.join(columnIdentifiers, sql.fragment`, `);

    // Generate values for batch insert
    const valueRows = models.map((model) => {
      const values = columns.map((col) => this.formatValueForQuery(model[col]));
      return sql.join(values, sql.fragment`, `);
    });

    const valuesFragment = sql.join(
      valueRows.map((row) => sql.fragment`(${row})`),
      sql.fragment`, `,
    );

    return sql.unsafe`
      INSERT INTO ${sql.identifier([this.tableName])} 
      (${columnFragment}) 
      VALUES ${valuesFragment}
    `;
  }

  /**
   * Generate update query for a single record
   */
  protected generateUpdateQuery(model: DbModel, id: EntityId): SqlToken {
    const entries = Object.entries(model).filter(
      ([key, value]) => key !== 'id' && value !== undefined,
    );

    if (entries.length === 0) {
      throw new Error('Cannot generate update query with no fields to update');
    }

    const setClause = entries.map(
      ([key, value]) =>
        sql.fragment`${sql.identifier([key])} = ${this.formatValueForQuery(value)}`,
    );

    return sql.unsafe`
      UPDATE ${sql.identifier([this.tableName])} 
      SET ${sql.join(setClause, sql.fragment`, `)} 
      WHERE id = ${id}
    `;
  }

  /**
   * Generate upsert query using ON CONFLICT clause
   */
  protected generateUpsertQuery(model: DbModel): SqlToken {
    const columns = Object.keys(model).filter(
      (key) => model[key] !== undefined,
    );
    const columnIdentifiers = columns.map((col) => sql.identifier([col]));
    const columnFragment = sql.join(columnIdentifiers, sql.fragment`, `);

    const values = columns.map((col) => this.formatValueForQuery(model[col]));
    const valuesFragment = sql.join(values, sql.fragment`, `);

    // Generate SET clause for ON CONFLICT UPDATE (exclude id)
    const updateColumns = columns.filter((col) => col !== 'id');
    const setClause = updateColumns.map(
      (col) =>
        sql.fragment`${sql.identifier([col])} = EXCLUDED.${sql.identifier([col])}`,
    );

    return sql.unsafe`
      INSERT INTO ${sql.identifier([this.tableName])} 
      (${columnFragment}) 
      VALUES (${valuesFragment})
      ON CONFLICT (id) DO UPDATE SET 
      ${sql.join(setClause, sql.fragment`, `)}
    `;
  }

  /**
   * Format value for SQL query with proper type handling
   */
  protected formatValueForQuery(value: unknown): any {
    // ValueExpressionToken not available in v48
    if (value === null || value === undefined) {
      return sql.fragment`NULL`;
    }

    if (value instanceof Date) {
      return sql.timestamp(value);
    }

    if (typeof value === 'object' && value !== null) {
      return sql.json(JSON.stringify(value));
    }

    return value;
  }

  /**
   * Execute operations within a database transaction with proper error handling
   */
  public async transaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    options?: {
      isolationLevel?:
        | 'READ_UNCOMMITTED'
        | 'READ_COMMITTED'
        | 'REPEATABLE_READ'
        | 'SERIALIZABLE';
      timeout?: number;
    },
  ): Promise<T> {
    const startTime = Date.now();
    const requestId = RequestContextService.getRequestId();

    return this.pool.transaction(async (connection) => {
      this.logger.debug(
        `[${requestId}] Transaction started for ${this.tableName}`,
        { isolationLevel: options?.isolationLevel, timeout: options?.timeout },
      );

      // Set transaction isolation level if specified
      if (options?.isolationLevel) {
        await connection.query(
          sql.unsafe`SET TRANSACTION ISOLATION LEVEL ${sql.identifier([options.isolationLevel])}`,
        );
      }

      // Set statement timeout if specified
      if (options?.timeout) {
        await connection.query(
          sql.unsafe`SET statement_timeout = ${options.timeout}`,
        );
      }

      // Set transaction connection in context if not already set
      if (!RequestContextService.getTransactionConnection()) {
        RequestContextService.setTransactionConnection(connection);
      }

      try {
        const result = await handler(connection);
        const duration = Date.now() - startTime;

        this.logger.debug(
          `[${requestId}] Transaction committed successfully in ${duration}ms`,
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.logger.error(
          `[${requestId}] Transaction failed and rolled back after ${duration}ms`,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            table: this.tableName,
          },
        );

        throw error;
      } finally {
        RequestContextService.cleanTransactionConnection();
      }
    });
  }

  /**
   * Get database pool or transaction connection based on current context
   */
  protected get pool(): DatabasePool | DatabaseTransactionConnection {
    return (
      RequestContextService.getContext().transactionConnection ?? this._pool
    );
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: EntityId): Promise<boolean> {
    try {
      const validatedId = this.idSchema ? this.idSchema.parse(id) : id;

      const query = sql.unsafe`
        SELECT 1 FROM ${sql.identifier([this.tableName])} 
        WHERE id = ${validatedId} 
        LIMIT 1
      `;

      const result = await this.executeQuery(query, 'exists');
      return result.rows.length > 0;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'exists', { id });
      return false;
    }
  }

  /**
   * Count entities matching optional criteria
   */
  async count(where?: SqlToken): Promise<number> {
    try {
      let query = sql.unsafe`SELECT COUNT(*) as total FROM ${sql.identifier([this.tableName])}`;

      if (where) {
        query = sql.unsafe`${query} WHERE ${where}`;
      }

      const result = await this.executeQuery(query, 'count');
      return Number(result.rows[0]?.total || 0);
    } catch (error) {
      this.handleRepositoryError(error as Error, 'count');
      return 0;
    }
  }

  /**
   * Log repository operations for debugging and monitoring
   */
  protected logOperation(
    operation: string,
    details?: Record<string, any>,
  ): void {
    if (this.logger) {
      this.logger.debug(
        `[${RequestContextService.getRequestId()}] Repository ${operation} on ${this.tableName}`,
        details,
      );
    }
  }

  /**
   * Handle repository errors with proper logging and context
   */
  protected handleRepositoryError(
    error: Error,
    operation: string,
    context?: Record<string, unknown>,
  ): void {
    const errorDetails = {
      operation,
      table: this.tableName,
      error: error.message,
      stack: error.stack,
      context,
    };

    if (error instanceof UniqueIntegrityConstraintViolationError) {
      this.logger.warn(
        `[${RequestContextService.getRequestId()}] Unique constraint violation in ${operation}`,
        errorDetails,
      );
    } else if (error instanceof NotFoundError) {
      this.logger.debug(
        `[${RequestContextService.getRequestId()}] Entity not found in ${operation}`,
        errorDetails,
      );
    } else if (error instanceof DataIntegrityError) {
      this.logger.error(
        `[${RequestContextService.getRequestId()}] Data integrity error in ${operation}`,
        errorDetails,
      );
    } else {
      this.logger.error(
        `[${RequestContextService.getRequestId()}] Repository error in ${operation}`,
        errorDetails,
      );
    }
  }
}
