import {
  Body,
  Controller,
  HttpStatus,
  Post,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { match, Result } from 'oxide.ts';
import { Request } from 'express';

import { LogoutCommand } from './logout.command';
import { LogoutRequestDto, LogoutResponseDto } from '../../dtos/auth.response.dto';
import { ApiErrorResponse } from '@libs/api/api-error.response';
import { CurrentUser, AuthenticatedUser } from '../../infrastructure/decorators/current-user.decorator';
import { AuthenticatedOnly } from '../../infrastructure/decorators/auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
@AuthenticatedOnly()
@ApiBearerAuth()
export class LogoutHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Logout failed',
    type: ApiErrorResponse,
  })
  @Post('logout')
  async logout(
    @Body() body: LogoutRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<LogoutResponseDto> {
    const command = new LogoutCommand({
      userId: user.sub,
      refreshToken: body.refreshToken,
      logoutAllDevices: body.logoutAllDevices || false,
      ipAddress: body.ipAddress || this.extractIpAddress(req),
      userAgent: body.userAgent || req.get('User-Agent'),
    });

    const result: Result<boolean, Error> = await this.commandBus.execute(command);

    return match(result, {
      Ok: (success: boolean) => {
        if (body.logoutAllDevices) {
          return new LogoutResponseDto(success, 'Successfully logged out from all devices');
        }
        return new LogoutResponseDto(success, 'Successfully logged out');
      },
      Err: (error: Error) => {
        throw new BadRequestException(error.message || 'Logout failed');
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