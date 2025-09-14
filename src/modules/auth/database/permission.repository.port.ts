import { RepositoryPort } from '@libs/ddd';
import { Option } from 'oxide.ts';
import { PermissionEntity } from '../domain/entities/permission.entity';

export interface PermissionRepositoryPort
  extends RepositoryPort<PermissionEntity> {
  findByName(name: string): Promise<Option<PermissionEntity>>;
  findByResourceAndAction(
    resource: string,
    action: string,
  ): Promise<Option<PermissionEntity>>;
  findByResource(resource: string): Promise<PermissionEntity[]>;
  findByAction(action: string): Promise<PermissionEntity[]>;
  findByIds(ids: string[]): Promise<PermissionEntity[]>;
  findUserPermissions(userId: string): Promise<PermissionEntity[]>;
  findRolePermissions(roleId: string): Promise<PermissionEntity[]>;
  userHasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean>;
}
