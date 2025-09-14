import { AggregateRoot, AggregateID } from '@libs/ddd';
import { CreateRoleProps, RoleProps } from '../auth.types';
import { Guard } from '@libs/guard';
import { ArgumentInvalidException } from '@libs/exceptions';
import { randomUUID } from 'crypto';

export class RoleEntity extends AggregateRoot<RoleProps> {
  protected readonly _id: AggregateID;

  static create(create: CreateRoleProps): RoleEntity {
    const id = randomUUID();
    const props: RoleProps = {
      name: create.name,
      description: create.description,
      isActive: true,
      permissions: create.permissions || [],
    };

    const role = new RoleEntity({ id, props });
    return role;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get permissions(): string[] {
    return [...this.props.permissions];
  }

  addPermission(permissionId: string): void {
    if (!Guard.isUuid(permissionId)) {
      throw new ArgumentInvalidException('Permission ID must be a valid UUID');
    }

    if (!this.props.permissions.includes(permissionId)) {
      this.props.permissions.push(permissionId);
    }
  }

  removePermission(permissionId: string): void {
    const index = this.props.permissions.indexOf(permissionId);
    if (index > -1) {
      this.props.permissions.splice(index, 1);
    }
  }

  hasPermission(permissionId: string): boolean {
    return this.props.permissions.includes(permissionId);
  }

  activate(): void {
    this.props.isActive = true;
  }

  deactivate(): void {
    this.props.isActive = false;
  }

  updateDescription(description: string): void {
    this.props.description = description;
  }

  validate(): void {
    if (!Guard.lengthIsBetween(this.props.name, 2, 50)) {
      throw new ArgumentInvalidException(
        'Role name must be between 2 and 50 characters',
      );
    }

    if (
      this.props.description &&
      !Guard.lengthIsBetween(this.props.description, 0, 255)
    ) {
      throw new ArgumentInvalidException(
        'Role description must not exceed 255 characters',
      );
    }

    // Validate permission IDs are UUIDs
    for (const permissionId of this.props.permissions) {
      if (!Guard.isUuid(permissionId)) {
        throw new ArgumentInvalidException(
          `Invalid permission ID: ${permissionId}`,
        );
      }
    }
  }
}
