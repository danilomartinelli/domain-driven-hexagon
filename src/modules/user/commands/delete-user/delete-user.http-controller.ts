import {
  Controller,
  Delete,
  HttpStatus,
  NotFoundException as NotFoundHttpException,
  Param,
} from '@nestjs/common';
import { routesV1 } from '@config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteUserCommand } from './delete-user.service';
import { match, Result } from 'oxide.ts';
import { NotFoundException } from '@libs/exceptions';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiErrorResponse } from '@src/libs/api/api-error.response';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/auth.decorator';
import { ResourceOwnerGuard } from '@modules/auth/infrastructure/guards/resource-owner.guard';
import { UseGuards } from '@nestjs/common';

@Controller(routesV1.version)
@ApiBearerAuth()
export class DeleteUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({
    description: 'User deleted',
    status: HttpStatus.OK,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: NotFoundException.message,
    type: ApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or not resource owner',
    type: ApiErrorResponse,
  })
  @RequirePermissions(['user:delete'])
  @UseGuards(ResourceOwnerGuard)
  @Delete(routesV1.user.delete)
  async deleteUser(@Param('id') id: string): Promise<void> {
    const command = new DeleteUserCommand({ userId: id });
    const result: Result<boolean, NotFoundException> =
      await this.commandBus.execute(command);

    match(result, {
      Ok: (isOk: boolean) => isOk,
      Err: (error: Error) => {
        if (error instanceof NotFoundException)
          throw new NotFoundHttpException(error.message);
        throw error;
      },
    });
  }
}
