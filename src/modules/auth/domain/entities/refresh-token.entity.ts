import { AggregateRoot, AggregateID } from '@libs/ddd';
import { CreateRefreshTokenProps, RefreshTokenProps } from '../auth.types';
import { Guard } from '@libs/guard';
import { ArgumentInvalidException } from '@libs/exceptions';
import { randomUUID } from 'crypto';

export class RefreshTokenEntity extends AggregateRoot<RefreshTokenProps> {
  protected readonly _id: AggregateID;

  static create(create: CreateRefreshTokenProps): RefreshTokenEntity {
    const id = randomUUID();
    const props: RefreshTokenProps = {
      token: create.token,
      userId: create.userId,
      expiresAt: create.expiresAt,
      isRevoked: false,
      createdByIp: create.createdByIp,
      userAgent: create.userAgent,
    };

    const refreshToken = new RefreshTokenEntity({ id, props });
    return refreshToken;
  }

  get token(): string {
    return this.props.token;
  }

  get userId(): string {
    return this.props.userId;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get isRevoked(): boolean {
    return this.props.isRevoked;
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }

  get revokedByIp(): string | undefined {
    return this.props.revokedByIp;
  }

  get replacedByToken(): string | undefined {
    return this.props.replacedByToken;
  }

  get createdByIp(): string | undefined {
    return this.props.createdByIp;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get isExpired(): boolean {
    return new Date() >= this.props.expiresAt;
  }

  get isActive(): boolean {
    return !this.props.isRevoked && !this.isExpired;
  }

  revoke(revokedByIp?: string, replacedByToken?: string): void {
    if (this.props.isRevoked) {
      return; // Already revoked
    }

    this.props.isRevoked = true;
    this.props.revokedAt = new Date();
    this.props.revokedByIp = revokedByIp;
    this.props.replacedByToken = replacedByToken;
  }

  validate(): void {
    if (!Guard.lengthIsBetween(this.props.token, 10, 500)) {
      throw new ArgumentInvalidException('Token must be between 10 and 500 characters');
    }

    if (!Guard.isUuid(this.props.userId)) {
      throw new ArgumentInvalidException('User ID must be a valid UUID');
    }

    if (!this.props.expiresAt || this.props.expiresAt <= new Date()) {
      throw new ArgumentInvalidException('Expires at must be a future date');
    }

    if (this.props.createdByIp && !this.isValidIpAddress(this.props.createdByIp)) {
      throw new ArgumentInvalidException('Created by IP must be a valid IP address');
    }

    if (this.props.revokedByIp && !this.isValidIpAddress(this.props.revokedByIp)) {
      throw new ArgumentInvalidException('Revoked by IP must be a valid IP address');
    }

    if (this.props.replacedByToken && !Guard.lengthIsBetween(this.props.replacedByToken, 10, 500)) {
      throw new ArgumentInvalidException('Replaced by token must be between 10 and 500 characters');
    }

    if (this.props.userAgent && this.props.userAgent.length > 1000) {
      throw new ArgumentInvalidException('User agent must not exceed 1000 characters');
    }
  }

  private isValidIpAddress(ip: string): boolean {
    // Simple IPv4 and IPv6 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}