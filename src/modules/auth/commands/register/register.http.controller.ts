import {
  Body,
  Controller,
  HttpStatus,
  Post,
  ConflictException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { match, Result } from 'oxide.ts';
import { Request } from 'express';

import { RegisterCommand } from './register.command';
import { RegisterRequestDto } from '../../dtos/register.request.dto';
import { IdResponse } from '@libs/api/id.response.dto';
import { UserAlreadyExistsError } from '@modules/user/domain/user.errors';
import {
  PasswordMismatchError,
  WeakPasswordError,
} from '../../domain/auth.errors';
import { ApiErrorResponse } from '@libs/api/api-error.response';
import { AggregateID } from '@libs/ddd';
import { Public } from '../../infrastructure/decorators/auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class RegisterHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: IdResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User with this email already exists',
    type: ApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or weak password',
    type: ApiErrorResponse,
  })
  @Post('register')
  async register(
    @Body() body: RegisterRequestDto,
    @Req() req: Request,
  ): Promise<IdResponse> {
    const command = new RegisterCommand({
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword,
      address: body.address,
      ipAddress: body.ipAddress || this.extractIpAddress(req),
      userAgent: body.userAgent || req.get('User-Agent'),
    });

    const result: Result<AggregateID, Error> =
      await this.commandBus.execute(command);

    return match(result, {
      Ok: (id: string) => new IdResponse(id),
      Err: (error: Error) => {
        if (error instanceof UserAlreadyExistsError) {
          throw new ConflictException(error.message);
        }
        if (error instanceof PasswordMismatchError) {
          throw new BadRequestException(error.message);
        }
        if (error instanceof WeakPasswordError) {
          throw new BadRequestException(error.message);
        }

        // Generic error handling
        throw new BadRequestException(error.message || 'Registration failed');
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
