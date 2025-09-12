import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UnauthorizedException,
  BadRequestException,
  TooManyRequestsException,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match, Result } from 'oxide.ts';
import { Request } from 'express';

import { LoginCommand } from './login.command';
import { LoginRequestDto } from '../../dtos/login.request.dto';
import { TokenResponseDto } from '../../dtos/auth.response.dto';
import { TokenPair } from '../../domain/auth.types';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountInactiveError,
  EmailNotVerifiedError,
} from '../../domain/auth.errors';
import { ApiErrorResponse } from '@libs/api/api-error.response';
import { Public } from '../../infrastructure/decorators/auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class LoginHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or account issues',
    type: ApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request format',
    type: ApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many login attempts',
    type: ApiErrorResponse,
  })
  @Post('login')
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
  ): Promise<TokenResponseDto> {
    const command = new LoginCommand({
      email: body.email,
      password: body.password,
      ipAddress: body.ipAddress || this.extractIpAddress(req),
      userAgent: body.userAgent || req.get('User-Agent'),
    });

    const result: Result<TokenPair, Error> = await this.commandBus.execute(command);

    return match(result, {
      Ok: (tokenPair: TokenPair) => new TokenResponseDto(
        tokenPair.accessToken,
        tokenPair.refreshToken,
        tokenPair.tokenType,
        tokenPair.expiresIn,
      ),
      Err: (error: Error) => {
        if (error instanceof InvalidCredentialsError) {
          throw new UnauthorizedException(error.message);
        }
        if (error instanceof AccountLockedError) {
          throw new TooManyRequestsException(error.message);
        }
        if (error instanceof AccountInactiveError) {
          throw new UnauthorizedException(error.message);
        }
        if (error instanceof EmailNotVerifiedError) {
          throw new UnauthorizedException(error.message);
        }
        
        // Generic error handling
        throw new BadRequestException(error.message || 'Login failed');
      },
    });
  }

  private extractIpAddress(req: Request): string {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req as any).connection?.socket?.remoteAddress ||
      'unknown'
    );
  }
}