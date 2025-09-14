import { RepositoryPort, PaginatedQueryParams, Paginated } from '@libs/ddd';
import { AuthAuditLogEntity } from '../domain/entities/auth-audit-log.entity';

export interface AuthAuditLogRepositoryPort
  extends RepositoryPort<AuthAuditLogEntity> {
  findByUserId(
    userId: string,
    params?: PaginatedQueryParams,
  ): Promise<Paginated<AuthAuditLogEntity>>;
  findByAction(
    action: string,
    params?: PaginatedQueryParams,
  ): Promise<Paginated<AuthAuditLogEntity>>;
  findFailedLoginAttempts(
    ipAddress: string,
    since: Date,
  ): Promise<AuthAuditLogEntity[]>;
  findUserFailedLoginAttempts(
    userId: string,
    since: Date,
  ): Promise<AuthAuditLogEntity[]>;
  findRecentActivity(
    userId: string,
    limit?: number,
  ): Promise<AuthAuditLogEntity[]>;
  cleanupOldLogs(olderThan: Date): Promise<number>;
}
