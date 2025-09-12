import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UnauthorizedException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match, Result } from 'oxide.ts';
import { Request } from 'express';

import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenRequestDto, TokenResponseDto } from '../../dtos/auth.response.dto';
import { TokenPair } from '../../domain/auth.types';
import {
  InvalidTokenError,
  TokenExpiredError,
  RefreshTokenNotFoundError,
  AccountInactiveError,
} from '../../domain/auth.errors';
import { ApiErrorResponse } from '@libs/api/api-error.response';
import { Public } from '../../infrastructure/decorators/auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class RefreshTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully refreshed',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
    type: ApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request format',
    type: ApiErrorResponse,
  })
  @Post('refresh')
  async refresh(
    @Body() body: RefreshTokenRequestDto,
    @Req() req: Request,
  ): Promise<TokenResponseDto> {
    const command = new RefreshTokenCommand({
      refreshToken: body.refreshToken,
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
        if (
          error instanceof InvalidTokenError ||
          error instanceof TokenExpiredError ||
          error instanceof RefreshTokenNotFoundError
        ) {
          throw new UnauthorizedException(error.message);
        }
        if (error instanceof AccountInactiveError) {
          throw new UnauthorizedException(error.message);
        }
        
        // Generic error handling
        throw new BadRequestException(error.message || 'Token refresh failed');
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