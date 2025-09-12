import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: 'Bearer',
    description: 'Token type',
  })
  tokenType: string;

  @ApiProperty({
    example: 900,
    description: 'Token expiration time in seconds',
  })
  expiresIn: number;

  constructor(accessToken: string, refreshToken: string, tokenType: string, expiresIn: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenType = tokenType;
    this.expiresIn = expiresIn;
  }
}

export class RefreshTokenRequestDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'Client IP address (optional)',
    required: false,
  })
  ipAddress?: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    description: 'Client user agent (optional)',
    required: false,
  })
  userAgent?: string;
}

export class LogoutRequestDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token to revoke (optional)',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    example: false,
    description: 'Whether to logout from all devices',
    required: false,
  })
  logoutAllDevices?: boolean;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'Client IP address (optional)',
    required: false,
  })
  ipAddress?: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    description: 'Client user agent (optional)',
    required: false,
  })
  userAgent?: string;
}

export class LogoutResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether logout was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Successfully logged out',
    description: 'Logout message',
  })
  message: string;

  constructor(success: boolean, message: string) {
    this.success = success;
    this.message = message;
  }
}