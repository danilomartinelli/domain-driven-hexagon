import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DATABASE_POOL_TOKEN } from '@libs/database';
import { SqlRepositoryBase } from '@src/libs/db/sql-repository.base';
import { UserRepositoryPort } from './user.repository.port';
import { UserMapper } from '../user.mapper';
import { UserRoles } from '../domain/user.types';
import { UserEntity } from '../domain/user.entity';

/**
 * Runtime validation of user object for extra safety (in case database schema changes).
 * https://github.com/gajus/slonik#runtime-validation
 * If you prefer to avoid performance penalty of validation, use interfaces instead.
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.preprocess((val: any) => new Date(val), z.date()),
  updatedAt: z.preprocess((val: any) => new Date(val), z.date()),
  email: z.string().email(),
  country: z.string().min(1).max(255),
  postalCode: z.string().min(1).max(20),
  street: z.string().min(1).max(255),
  role: z.nativeEnum(UserRoles),
});

export type UserModel = z.TypeOf<typeof userSchema>;

/**
 *  Repository is used for retrieving/saving domain entities
 * */
@Injectable()
export class UserRepository
  extends SqlRepositoryBase<UserEntity, UserModel>
  implements UserRepositoryPort
{
  protected tableName = 'users';

  protected schema = userSchema;

  constructor(
    @Inject(DATABASE_POOL_TOKEN)
    pool: DatabasePool,
    mapper: UserMapper,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, eventEmitter, new Logger(UserRepository.name));
  }

  async updateAddress(user: UserEntity): Promise<void> {
    const address = user.getProps().address;
    const statement = sql.type(userSchema)`
      UPDATE "users" SET
        street = ${address.street}, 
        country = ${address.country}, 
        "postalCode" = ${address.postalCode},
        "updatedAt" = ${sql.timestamp(new Date())}
      WHERE id = ${user.id}
    `;

    await this.executeWriteQuery(statement, user, 'updateAddress');
  }

  async findOneByEmail(email: string): Promise<UserEntity | null> {
    try {
      // Optimized query using partial index for active users
      const result = await this.executeQuery(
        sql.type(userSchema)`
          SELECT * FROM "users"
          WHERE email = ${email} AND "isActive" = true
          LIMIT 1
        `,
        'findOneByEmail',
      );

      if (result.rows.length === 0) {
        return null;
      }

      const validatedUser = this.schema.parse(result.rows[0]);
      return this.mapper.toDomain(validatedUser);
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findOneByEmail', { email });
      return null;
    }
  }

  /**
   * Find user by email for authentication (includes inactive users)
   */
  async findByEmailForAuth(email: string): Promise<UserEntity | null> {
    try {
      // Uses composite index: IDX_users_email_active_verified
      const result = await this.executeQuery(
        sql.type(userSchema)`
          SELECT * FROM "users"
          WHERE email = ${email}
          LIMIT 1
        `,
        'findByEmailForAuth',
      );

      if (result.rows.length === 0) {
        return null;
      }

      const validatedUser = this.schema.parse(result.rows[0]);
      return this.mapper.toDomain(validatedUser);
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findByEmailForAuth', { email });
      return null;
    }
  }

  /**
   * Find users by role with pagination support
   */
  async findByRole(
    role: UserRoles,
    limit = 50,
    offset = 0,
  ): Promise<UserEntity[]> {
    try {
      const result = await this.executeQuery(
        sql.type(userSchema)`
          SELECT * FROM "users" 
          WHERE role = ${role}
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        'findByRole',
      );

      return result.rows.map((row) => {
        const validatedUser = this.schema.parse(row);
        return this.mapper.toDomain(validatedUser);
      });
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findByRole', {
        role,
        limit,
        offset,
      });
      return [];
    }
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(
        sql.unsafe`SELECT 1 FROM "users" WHERE email = ${email} LIMIT 1`,
        'existsByEmail',
      );

      return result.rows.length > 0;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'existsByEmail', { email });
      return false;
    }
  }
}
