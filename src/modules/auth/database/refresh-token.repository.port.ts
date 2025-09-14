import { RepositoryPort } from '@libs/ddd';
import { Option } from 'oxide.ts';
import { RefreshTokenEntity } from '../domain/entities/refresh-token.entity';

export interface RefreshTokenRepositoryPort
  extends RepositoryPort<RefreshTokenEntity> {
  findByToken(token: string): Promise<Option<RefreshTokenEntity>>;
  findActiveTokensByUserId(userId: string): Promise<RefreshTokenEntity[]>;
  revokeAllUserTokens(userId: string, revokedByIp?: string): Promise<void>;
  revokeToken(
    token: string,
    revokedByIp?: string,
    replacedByToken?: string,
  ): Promise<void>;
  cleanupExpiredTokens(): Promise<number>;
  countActiveTokensForUser(userId: string): Promise<number>;
}
