import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { DATABASE_POOL_TOKEN } from '@libs/database';
import { SqlRepositoryBase } from '@src/libs/db/sql-repository.base';
import { WalletRepositoryPort } from './wallet.repository.port';
import { WalletEntity } from '../domain/wallet.entity';
import { WalletMapper } from '../wallet.mapper';

export const walletSchema = z.object({
  id: z.string().min(1).max(255),
  createdAt: z.preprocess((val: any) => new Date(val), z.date()),
  updatedAt: z.preprocess((val: any) => new Date(val), z.date()),
  balance: z.number().min(0).max(9999999),
  userId: z.string().min(1).max(255),
});

export type WalletModel = z.TypeOf<typeof walletSchema>;

@Injectable()
export class WalletRepository
  extends SqlRepositoryBase<WalletEntity, WalletModel>
  implements WalletRepositoryPort
{
  protected tableName = 'wallets';

  protected schema = walletSchema;

  constructor(
    @Inject(DATABASE_POOL_TOKEN)
    pool: DatabasePool,
    mapper: WalletMapper,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, eventEmitter, new Logger(WalletRepository.name));
  }

  /**
   * Find wallet by user ID
   */
  async findByUserId(userId: string): Promise<WalletEntity | null> {
    try {
      const result = await this.executeQuery(
        sql.type(walletSchema)`
          SELECT * FROM "wallets" 
          WHERE "userId" = ${userId}
        `,
        'findByUserId',
      );

      if (result.rows.length === 0) {
        return null;
      }

      const validatedWallet = this.schema.parse(result.rows[0]);
      return this.mapper.toDomain(validatedWallet);
    } catch (error) {
      this.handleRepositoryError(error as Error, 'findByUserId', { userId });
      return null;
    }
  }

  /**
   * Update wallet balance with optimistic locking
   */
  async updateBalance(
    walletId: string,
    newBalance: number,
    expectedVersion?: number,
  ): Promise<boolean> {
    try {
      let query;

      if (expectedVersion !== undefined) {
        // Optimistic locking - include version check
        query = sql.unsafe`
          UPDATE "wallets" 
          SET 
            balance = ${newBalance},
            "updatedAt" = ${sql.timestamp(new Date())}
          WHERE 
            id = ${walletId} 
            AND version = ${expectedVersion}
        `;
      } else {
        // Simple update without version check
        query = sql.unsafe`
          UPDATE "wallets" 
          SET 
            balance = ${newBalance},
            "updatedAt" = ${sql.timestamp(new Date())}
          WHERE id = ${walletId}
        `;
      }

      const result = await this.executeQuery(query, 'updateBalance');
      return result.rowCount > 0;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'updateBalance', {
        walletId,
        newBalance,
        expectedVersion,
      });
      return false;
    }
  }

  /**
   * Check if wallet exists for user
   */
  async existsForUser(userId: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(
        sql.unsafe`
          SELECT 1 FROM "wallets" 
          WHERE "userId" = ${userId} 
          LIMIT 1
        `,
        'existsForUser',
      );

      return result.rows.length > 0;
    } catch (error) {
      this.handleRepositoryError(error as Error, 'existsForUser', { userId });
      return false;
    }
  }
}
