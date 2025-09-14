import { AggregateRoot, AggregateID } from '@libs/ddd';
import { CreatePermissionProps, PermissionProps } from '../auth.types';
import { Guard } from '@libs/guard';
import { ArgumentInvalidException } from '@libs/exceptions';
import { randomUUID } from 'crypto';

export class PermissionEntity extends AggregateRoot<PermissionProps> {
  protected readonly _id: AggregateID;

  static create(create: CreatePermissionProps): PermissionEntity {
    const id = randomUUID();
    const props: PermissionProps = {
      name: create.name,
      resource: create.resource,
      action: create.action,
      description: create.description,
    };

    const permission = new PermissionEntity({ id, props });
    return permission;
  }

  get name(): string {
    return this.props.name;
  }

  get resource(): string {
    return this.props.resource;
  }

  get action(): string {
    return this.props.action;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get fullName(): string {
    return `${this.props.resource}:${this.props.action}`;
  }

  updateDescription(description: string): void {
    this.props.description = description;
  }

  matches(resource: string, action: string): boolean {
    return this.props.resource === resource && this.props.action === action;
  }

  validate(): void {
    if (!Guard.lengthIsBetween(this.props.name, 2, 100)) {
      throw new ArgumentInvalidException(
        'Permission name must be between 2 and 100 characters',
      );
    }

    if (!Guard.lengthIsBetween(this.props.resource, 2, 50)) {
      throw new ArgumentInvalidException(
        'Permission resource must be between 2 and 50 characters',
      );
    }

    if (!Guard.lengthIsBetween(this.props.action, 2, 50)) {
      throw new ArgumentInvalidException(
        'Permission action must be between 2 and 50 characters',
      );
    }

    if (
      this.props.description &&
      !Guard.lengthIsBetween(this.props.description, 0, 255)
    ) {
      throw new ArgumentInvalidException(
        'Permission description must not exceed 255 characters',
      );
    }

    // Validate naming conventions
    const namePattern = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;
    if (!namePattern.test(this.props.name)) {
      throw new ArgumentInvalidException(
        'Permission name must follow the pattern "resource:action" with lowercase letters, numbers, underscores, and hyphens',
      );
    }

    const resourcePattern = /^[a-z][a-z0-9_-]*$/;
    if (!resourcePattern.test(this.props.resource)) {
      throw new ArgumentInvalidException(
        'Permission resource must contain only lowercase letters, numbers, underscores, and hyphens',
      );
    }

    const actionPattern = /^[a-z][a-z0-9_-]*$/;
    if (!actionPattern.test(this.props.action)) {
      throw new ArgumentInvalidException(
        'Permission action must contain only lowercase letters, numbers, underscores, and hyphens',
      );
    }
  }
}
