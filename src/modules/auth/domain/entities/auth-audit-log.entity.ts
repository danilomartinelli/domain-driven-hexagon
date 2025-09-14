import { AggregateRoot, AggregateID } from '@libs/ddd';
import { CreateAuthAuditLogProps, AuthAuditLogProps } from '../auth.types';
import { Guard } from '@libs/guard';
import { ArgumentInvalidException } from '@libs/exceptions';
import { randomUUID } from 'crypto';

export class AuthAuditLogEntity extends AggregateRoot<AuthAuditLogProps> {
  protected readonly _id: AggregateID;

  static create(create: CreateAuthAuditLogProps): AuthAuditLogEntity {
    const id = randomUUID();
    const props: AuthAuditLogProps = {
      userId: create.userId,
      action: create.action,
      details: create.details,
      ipAddress: create.ipAddress,
      userAgent: create.userAgent,
      success: create.success,
    };

    const auditLog = new AuthAuditLogEntity({ id, props });
    return auditLog;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get action(): string {
    return this.props.action;
  }

  get details(): Record<string, any> | undefined {
    return this.props.details;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get success(): boolean {
    return this.props.success;
  }

  validate(): void {
    if (!Guard.lengthIsBetween(this.props.action, 2, 100)) {
      throw new ArgumentInvalidException(
        'Action must be between 2 and 100 characters',
      );
    }

    if (this.props.userId && !Guard.isUuid(this.props.userId)) {
      throw new ArgumentInvalidException('User ID must be a valid UUID');
    }

    if (this.props.ipAddress && !this.isValidIpAddress(this.props.ipAddress)) {
      throw new ArgumentInvalidException('IP address must be valid');
    }

    if (this.props.userAgent && this.props.userAgent.length > 1000) {
      throw new ArgumentInvalidException(
        'User agent must not exceed 1000 characters',
      );
    }

    // Validate details object is serializable
    if (this.props.details) {
      try {
        JSON.stringify(this.props.details);
      } catch {
        throw new ArgumentInvalidException(
          'Details must be a JSON-serializable object',
        );
      }
    }
  }

  private isValidIpAddress(ip: string): boolean {
    // Simple IPv4 and IPv6 validation
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}
