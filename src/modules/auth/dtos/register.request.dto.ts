import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;

  @ApiProperty({
    example: '12345',
    description: 'Postal code',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  postalCode: string;

  @ApiProperty({
    example: '123 Main Street',
    description: 'Street address',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  street: string;
}

export class RegisterRequestDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description:
      'User password (8-128 characters, must contain uppercase, lowercase, number, and special character)',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
  })
  password: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Password confirmation (must match password)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword: string;

  @ApiProperty({
    description: 'User address information',
    type: AddressDto,
  })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

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
