import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    example: '192.168.1.1',
    description: 'Client IP address (optional, for audit logging)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    description: 'Client user agent (optional, for audit logging)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}