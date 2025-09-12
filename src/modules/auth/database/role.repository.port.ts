import { RepositoryPort } from '@libs/ddd';
import { Option } from 'oxide.ts';
import { RoleEntity } from '../domain/entities/role.entity';

export interface RoleRepositoryPort extends RepositoryPort<RoleEntity> {
  findByName(name: string): Promise<Option<RoleEntity>>;
  findByNames(names: string[]): Promise<RoleEntity[]>;
  findActiveRoles(): Promise<RoleEntity[]>;
  findRolesWithPermission(permissionId: string): Promise<RoleEntity[]>;
  findUserRoles(userId: string): Promise<RoleEntity[]>;
  assignRoleToUser(userId: string, roleId: string, assignedBy?: string): Promise<void>;
  unassignRoleFromUser(userId: string, roleId: string): Promise<void>;
  getUserRoleIds(userId: string): Promise<string[]>;
}