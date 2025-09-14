# Development Best Practices

This guide outlines the best practices for developing with the Domain-Driven Hexagon project, covering code organization, patterns, conventions, and workflows.

## Table of Contents

- [Code Organization](#code-organization)
- [Domain-Driven Design Patterns](#domain-driven-design-patterns)
- [CQRS Implementation](#cqrs-implementation)
- [Testing Strategies](#testing-strategies)
- [Error Handling](#error-handling)
- [Security Best Practices](#security-best-practices)
- [Performance Optimization](#performance-optimization)
- [Code Quality Standards](#code-quality-standards)
- [Git Workflow](#git-workflow)
- [Documentation Standards](#documentation-standards)

## Code Organization

### Module Structure

Follow the established module structure for consistency:

```
src/modules/{domain}/
├── commands/                    # Write operations (Create, Update, Delete)
│   └── {operation}-{entity}/
│       ├── {operation}-{entity}.command.ts
│       ├── {operation}-{entity}.service.ts
│       ├── {operation}-{entity}.http.controller.ts
│       ├── {operation}-{entity}.graphql-resolver.ts
│       ├── {operation}-{entity}.request.dto.ts
│       └── {operation}-{entity}.spec.ts
├── queries/                     # Read operations (Find, Get, List)
│   └── {operation}-{entities}/
│       ├── {operation}-{entities}.query-handler.ts
│       ├── {operation}-{entities}.http.controller.ts
│       ├── {operation}-{entities}.graphql-resolver.ts
│       ├── {operation}-{entities}.request.dto.ts
│       └── {operation}-{entities}.spec.ts
├── domain/                      # Core business logic
│   ├── entities/
│   │   ├── {entity}.entity.ts
│   │   └── {entity}.entity.spec.ts
│   ├── value-objects/
│   │   ├── {value-object}.value-object.ts
│   │   └── {value-object}.value-object.spec.ts
│   ├── events/
│   │   ├── {event}.domain-event.ts
│   │   └── {event}.domain-event.spec.ts
│   ├── services/
│   │   ├── {domain}.service.ts
│   │   └── {domain}.service.spec.ts
│   ├── {entity}.errors.ts
│   └── {entity}.types.ts
├── database/                    # Persistence layer
│   ├── {entity}.repository.port.ts
│   ├── {entity}.repository.ts
│   ├── {entity}.repository.spec.ts
│   └── {entity}.mapper.ts
├── dtos/                       # Data transfer objects
│   ├── {entity}.response.dto.ts
│   ├── {entity}.paginated.response.dto.ts
│   └── graphql/
│       └── {entity}.graphql-response.dto.ts
├── application/                # Application services
│   └── event-handlers/
│       ├── {event}.handler.ts
│       └── {event}.handler.spec.ts
├── {domain}.module.ts          # Module configuration
└── {domain}.di-tokens.ts       # Dependency injection tokens
```

### Naming Conventions

#### Files and Directories

- **Files**: Use kebab-case (e.g., `create-user.service.ts`)
- **Directories**: Use kebab-case (e.g., `create-user/`)
- **Test files**: Add `.spec.ts` suffix (e.g., `user.entity.spec.ts`)
- **Integration tests**: Add `.integration.spec.ts` suffix
- **E2E tests**: Add `.e2e-spec.ts` suffix

#### Classes and Interfaces

```typescript
// Entities - Always end with "Entity"
export class UserEntity extends AggregateRoot<UserProps> {}

// Value Objects - End with "ValueObject" or descriptive name
export class Email extends ValueObject<EmailProps> {}
export class Address extends ValueObject<AddressProps> {}

// Commands - End with "Command"
export class CreateUserCommand extends CommandBase {}

// Queries - End with "Query"
export class FindUsersQuery extends QueryBase {}

// Handlers - End with "Handler"
export class CreateUserHandler implements ICommandHandler {}
export class FindUsersHandler implements IQueryHandler {}

// Controllers - End with "Controller"
export class CreateUserHttpController {}
export class FindUsersGraphqlResolver {}

// DTOs - End with "Dto"
export class CreateUserRequestDto {}
export class UserResponseDto {}

// Events - End with "Event"
export class UserCreatedEvent extends DomainEvent {}

// Repositories - End with "Repository" or "RepositoryPort"
export interface UserRepositoryPort {}
export class UserRepository implements UserRepositoryPort {}

// Errors - End with "Error" or "Exception"
export class UserAlreadyExistsError extends ExceptionBase {}
export class InvalidEmailFormatException extends ArgumentInvalidException {}
```

#### Variables and Methods

```typescript
// Use camelCase for variables and methods
const userEmail = 'user@example.com';
const createdUser = await this.userRepository.save(user);

// Use descriptive names
const isValidEmail = this.validateEmailFormat(email);
const hasRequiredPermissions = this.checkUserPermissions(user, ['user:create']);

// Boolean variables should be prefixed with is/has/can/should
const isEmailValid = true;
const hasPermissions = false;
const canCreateUser = true;
const shouldSendEmail = false;
```

### Import Organization

Organize imports in the following order:

```typescript
// 1. Node.js built-in modules
import { readFileSync } from 'fs';
import { join } from 'path';

// 2. Third-party libraries
import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result } from 'oxide.ts';

// 3. Application imports (using path aliases)
import { UserEntity } from '@modules/user/domain/user.entity';
import { Email } from '@modules/user/domain/value-objects/email.value-object';
import { DatabaseService } from '@libs/database/database.service';
import { AggregateID } from '@libs/ddd';

// 4. Relative imports
import { CreateUserCommand } from './create-user.command';
import { UserAlreadyExistsError } from '../domain/user.errors';
```

## Domain-Driven Design Patterns

### Entities

Entities should encapsulate business logic and maintain consistency:

```typescript
export class UserEntity extends AggregateRoot<UserProps> {
  private constructor(props: UserProps, id?: AggregateID) {
    super(props, id);
  }

  // Factory method for creation
  static create(props: CreateUserProps): UserEntity {
    const id = AggregateID.generate();
    const user = new UserEntity({
      email: props.email,
      name: props.name,
      address: props.address,
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);

    // Add domain event
    user.addEvent(new UserCreatedEvent({
      aggregateId: id.value,
      email: props.email.value,
      name: props.name,
    }));

    // Validate invariants
    user.validate();

    return user;
  }

  // Business methods should be intention-revealing
  changeEmail(newEmail: Email): void {
    if (this.props.email.equals(newEmail)) {
      return; // No change needed
    }

    const oldEmail = this.props.email;
    this.props.email = newEmail;
    this.props.updatedAt = new Date();

    this.addEvent(new UserEmailChangedEvent({
      aggregateId: this.id.value,
      oldEmail: oldEmail.value,
      newEmail: newEmail.value,
    }));

    this.validate();
  }

  // Private validation method
  public validate(): void {
    if (!this.props.email) {
      throw new ArgumentNotProvidedException('User email is required');
    }
    if (!this.props.name || this.props.name.trim().length === 0) {
      throw new ArgumentNotProvidedException('User name is required');
    }
    if (this.props.name.length > 100) {
      throw new ArgumentInvalidException('User name cannot exceed 100 characters');
    }
  }

  // Getters for accessing properties
  get id(): AggregateID {
    return this._id;
  }

  get email(): Email {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }

  // No setters - use business methods instead
}
```

### Value Objects

Value Objects should be immutable and self-validating:

```typescript
export class Email extends ValueObject<EmailProps> {
  constructor(value: string) {
    // Normalize the input
    const normalizedValue = value.toLowerCase().trim();
    super({ value: normalizedValue });

    // Validate immediately
    this.validate();
  }

  get value(): string {
    return this.props.value;
  }

  private validate(): void {
    if (!this.props.value) {
      throw new ArgumentNotProvidedException('Email is required');
    }

    if (!this.isValidFormat(this.props.value)) {
      throw new ArgumentInvalidException('Invalid email format');
    }

    if (this.props.value.length > 320) { // RFC 5321 limit
      throw new ArgumentInvalidException('Email address too long');
    }
  }

  private isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Factory method for better API
  static create(value: string): Email {
    return new Email(value);
  }

  // Utility methods
  getDomain(): string {
    return this.props.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.props.value.split('@')[0];
  }
}
```

### Domain Services

Use domain services for business logic that doesn't fit in a single entity:

```typescript
@Injectable()
export class WalletDomainService {
  private readonly logger = new Logger(WalletDomainService.name);

  transferMoney(
    fromWallet: WalletEntity,
    toWallet: WalletEntity,
    amount: Money,
    reason?: string
  ): void {
    // Validate business rules
    this.validateTransfer(fromWallet, toWallet, amount);

    // Perform the transfer
    fromWallet.withdraw(amount, reason);
    toWallet.deposit(amount, reason);

    this.logger.log(
      `Money transferred: ${amount.amount} ${amount.currency.code} ` +
      `from ${fromWallet.id.value} to ${toWallet.id.value}`
    );
  }

  private validateTransfer(
    fromWallet: WalletEntity,
    toWallet: WalletEntity,
    amount: Money
  ): void {
    if (fromWallet.id.equals(toWallet.id)) {
      throw new ArgumentInvalidException('Cannot transfer to the same wallet');
    }

    if (!fromWallet.currency.equals(toWallet.currency)) {
      throw new ArgumentInvalidException('Currency mismatch between wallets');
    }

    if (!fromWallet.currency.equals(amount.currency)) {
      throw new ArgumentInvalidException('Amount currency does not match wallet currency');
    }
  }
}
```

### Repository Pattern

Implement repositories following the port/adapter pattern:

```typescript
// Port (Interface) - in domain layer
export interface UserRepositoryPort {
  findById(id: AggregateID): Promise<UserEntity | null>;
  findByEmail(email: Email): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  delete(id: AggregateID): Promise<void>;
  findManyPaginated(params: FindManyPaginatedParams): Promise<Paginated<UserEntity>>;
}

// Adapter (Implementation) - in infrastructure layer
@Injectable()
export class UserRepository implements UserRepositoryPort {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly database: DatabaseService) {}

  async findById(id: AggregateID): Promise<UserEntity | null> {
    try {
      const result = await this.database.query(sql`
        SELECT * FROM users
        WHERE id = ${id.value} AND deleted_at IS NULL
      `);

      if (result.rows.length === 0) {
        return null;
      }

      return this.toDomainEntity(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to find user by id: ${id.value}`, error);
      throw new RepositoryError('Failed to find user');
    }
  }

  async save(user: UserEntity): Promise<void> {
    const userModel = this.toUserModel(user);

    try {
      await this.database.query(sql`
        INSERT INTO users (id, email, name, country, street, postal_code, created_at, updated_at)
        VALUES (${userModel.id}, ${userModel.email}, ${userModel.name},
                ${userModel.country}, ${userModel.street}, ${userModel.postalCode},
                ${userModel.createdAt}, ${userModel.updatedAt})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          country = EXCLUDED.country,
          street = EXCLUDED.street,
          postal_code = EXCLUDED.postal_code,
          updated_at = EXCLUDED.updated_at
      `);

      this.logger.log(`User saved: ${user.id.value}`);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new UserAlreadyExistsError('User with this email already exists');
      }

      this.logger.error(`Failed to save user: ${user.id.value}`, error);
      throw new RepositoryError('Failed to save user');
    }
  }

  private toDomainEntity(model: UserModel): UserEntity {
    return UserEntity.reconstitute({
      id: new AggregateID(model.id),
      email: new Email(model.email),
      name: model.name,
      address: new Address({
        country: model.country,
        street: model.street,
        postalCode: model.postalCode,
      }),
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      deletedAt: model.deletedAt,
    });
  }

  private toUserModel(entity: UserEntity): UserModel {
    return {
      id: entity.id.value,
      email: entity.email.value,
      name: entity.name,
      country: entity.address.country,
      street: entity.address.street,
      postalCode: entity.address.postalCode,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    };
  }
}
```

## CQRS Implementation

### Command Handlers

Command handlers should focus on business operations:

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  private readonly logger = new Logger(CreateUserHandler.name);

  constructor(
    @Inject(USER_TOKENS.UserRepositoryPort)
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<Result<AggregateID, Error>> {
    try {
      // 1. Validate business rules
      await this.validateUserDoesNotExist(command.email);

      // 2. Create domain entity
      const user = UserEntity.create({
        email: new Email(command.email),
        name: command.name,
        address: new Address({
          country: command.country,
          street: command.street,
          postalCode: command.postalCode,
        }),
      });

      // 3. Persist the entity
      await this.userRepository.save(user);

      // 4. Publish domain events
      await this.publishEvents(user);

      this.logger.log(`User created successfully: ${user.id.value}`);

      return Ok(user.id);
    } catch (error) {
      this.logger.error('Failed to create user', error);

      if (error instanceof UserAlreadyExistsError) {
        return Err(error);
      }

      return Err(new Error('Failed to create user'));
    }
  }

  private async validateUserDoesNotExist(email: string): Promise<void> {
    const existingUser = await this.userRepository.findByEmail(new Email(email));

    if (existingUser) {
      throw new UserAlreadyExistsError(`User with email ${email} already exists`);
    }
  }

  private async publishEvents(user: UserEntity): Promise<void> {
    const events = user.getUncommittedEvents();

    for (const event of events) {
      await this.eventBus.publish(event);
    }

    user.markEventsAsCommitted();
  }
}
```

### Query Handlers

Query handlers should focus on data retrieval:

```typescript
@QueryHandler(FindUsersQuery)
export class FindUsersHandler implements IQueryHandler<FindUsersQuery> {
  private readonly logger = new Logger(FindUsersHandler.name);

  constructor(
    @Inject(USER_TOKENS.UserRepositoryPort)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: FindUsersQuery): Promise<Result<Paginated<UserModel>, Error>> {
    try {
      const params = {
        page: query.page || 1,
        limit: query.limit || 20,
        filters: this.buildFilters(query),
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'DESC',
      };

      const result = await this.userRepository.findManyPaginated(params);

      this.logger.log(`Found ${result.data.length} users`);

      return Ok(result);
    } catch (error) {
      this.logger.error('Failed to find users', error);
      return Err(new Error('Failed to find users'));
    }
  }

  private buildFilters(query: FindUsersQuery): Record<string, any> {
    const filters: Record<string, any> = {};

    if (query.email) {
      filters.email = query.email;
    }

    if (query.country) {
      filters.country = query.country;
    }

    if (query.createdAfter) {
      filters.createdAfter = query.createdAfter;
    }

    if (query.createdBefore) {
      filters.createdBefore = query.createdBefore;
    }

    return filters;
  }
}
```

## Testing Strategies

### Unit Testing

Focus on testing business logic in isolation:

```typescript
describe('UserEntity', () => {
  describe('create', () => {
    it('should create a user with valid data', () => {
      // Arrange
      const email = new Email('test@example.com');
      const address = new Address({
        country: 'USA',
        street: '123 Test St',
        postalCode: '12345',
      });

      // Act
      const user = UserEntity.create({
        email,
        name: 'Test User',
        address,
      });

      // Assert
      expect(user.email).toEqual(email);
      expect(user.name).toBe('Test User');
      expect(user.address).toEqual(address);

      const events = user.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
    });

    it('should throw error when email is invalid', () => {
      // Arrange
      const invalidEmail = 'invalid-email';
      const address = new Address({
        country: 'USA',
        street: '123 Test St',
        postalCode: '12345',
      });

      // Act & Assert
      expect(() => {
        UserEntity.create({
          email: new Email(invalidEmail),
          name: 'Test User',
          address,
        });
      }).toThrow('Invalid email format');
    });
  });

  describe('changeEmail', () => {
    it('should change email and add domain event', () => {
      // Arrange
      const user = createTestUser();
      const newEmail = new Email('new@example.com');

      // Act
      user.changeEmail(newEmail);

      // Assert
      expect(user.email).toEqual(newEmail);

      const events = user.getUncommittedEvents();
      const emailChangedEvent = events.find(e => e instanceof UserEmailChangedEvent);
      expect(emailChangedEvent).toBeDefined();
    });

    it('should not add event when email is the same', () => {
      // Arrange
      const user = createTestUser();
      const sameEmail = user.email;

      // Act
      user.changeEmail(sameEmail);

      // Assert
      const events = user.getUncommittedEvents();
      expect(events.filter(e => e instanceof UserEmailChangedEvent)).toHaveLength(0);
    });
  });
});

// Test helpers
function createTestUser(): UserEntity {
  return UserEntity.create({
    email: new Email('test@example.com'),
    name: 'Test User',
    address: new Address({
      country: 'USA',
      street: '123 Test St',
      postalCode: '12345',
    }),
  });
}
```

### Integration Testing

Test component interactions with real dependencies:

```typescript
describe('CreateUserHandler (Integration)', () => {
  let app: TestingModule;
  let handler: CreateUserHandler;
  let userRepository: UserRepositoryPort;
  let database: DatabaseService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [DatabaseTestModule, UserModule],
    }).compile();

    handler = app.get<CreateUserHandler>(CreateUserHandler);
    userRepository = app.get<UserRepositoryPort>(USER_TOKENS.UserRepositoryPort);
    database = app.get<DatabaseService>(DatabaseService);
  });

  beforeEach(async () => {
    await database.query(sql`TRUNCATE TABLE users CASCADE`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('execute', () => {
    it('should create user successfully', async () => {
      // Arrange
      const command = new CreateUserCommand({
        email: 'integration@test.com',
        name: 'Integration Test',
        country: 'USA',
        street: '123 Integration St',
        postalCode: '12345',
      });

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isOk()).toBe(true);

      const userId = result.unwrap();
      const savedUser = await userRepository.findById(userId);

      expect(savedUser).toBeDefined();
      expect(savedUser!.email.value).toBe('integration@test.com');
      expect(savedUser!.name).toBe('Integration Test');
    });

    it('should fail when user already exists', async () => {
      // Arrange
      const email = 'duplicate@test.com';

      // Create first user
      const firstCommand = new CreateUserCommand({
        email,
        name: 'First User',
        country: 'USA',
        street: '123 First St',
        postalCode: '12345',
      });
      await handler.execute(firstCommand);

      // Try to create duplicate
      const duplicateCommand = new CreateUserCommand({
        email,
        name: 'Duplicate User',
        country: 'USA',
        street: '456 Duplicate St',
        postalCode: '54321',
      });

      // Act
      const result = await handler.execute(duplicateCommand);

      // Assert
      expect(result.isErr()).toBe(true);

      const error = result.unwrapErr();
      expect(error).toBeInstanceOf(UserAlreadyExistsError);
    });
  });
});
```

### End-to-End Testing

Test complete user workflows:

```typescript
describe('User Management (E2E)', () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app); // Apply the same configuration as main.ts

    await app.init();

    database = app.get<DatabaseService>(DatabaseService);
  });

  beforeEach(async () => {
    await database.query(sql`TRUNCATE TABLE users CASCADE`);
    await database.query(sql`TRUNCATE TABLE wallets CASCADE`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/users', () => {
    it('should create user and wallet', async () => {
      // Arrange
      const userData = {
        email: 'e2e@test.com',
        name: 'E2E Test User',
        country: 'USA',
        street: '123 E2E Street',
        postalCode: '12345',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/v1/users')
        .send(userData)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);

      // Verify user was created in database
      const users = await database.query(sql`
        SELECT * FROM users WHERE email = ${userData.email}
      `);
      expect(users.rows).toHaveLength(1);

      // Verify wallet was created via domain event
      const wallets = await database.query(sql`
        SELECT * FROM wallets WHERE user_id = ${response.body.id}
      `);
      expect(wallets.rows).toHaveLength(1);
      expect(wallets.rows[0].balance).toBe('0');
    });

    it('should return conflict when email already exists', async () => {
      // Arrange
      const userData = {
        email: 'conflict@test.com',
        name: 'Conflict Test',
        country: 'USA',
        street: '123 Conflict St',
        postalCode: '12345',
      };

      // Create first user
      await request(app.getHttpServer())
        .post('/v1/users')
        .send(userData)
        .expect(201);

      // Act - Try to create duplicate
      const response = await request(app.getHttpServer())
        .post('/v1/users')
        .send(userData)
        .expect(409);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/v1/users')
        .send({
          email: 'invalid-email', // Invalid email
          // Missing required fields
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });
  });
});
```

## Error Handling

### Custom Exceptions

Create specific exceptions for different error types:

```typescript
// Base domain exception
export abstract class DomainException extends ExceptionBase {
  constructor(message: string, cause?: Error, metadata?: unknown) {
    super(message, cause, metadata);
  }
}

// Specific domain exceptions
export class UserAlreadyExistsError extends DomainException {
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
  }
}

export class InsufficientBalanceError extends DomainException {
  constructor(currentBalance: number, requiredAmount: number) {
    super(
      `Insufficient balance. Current: ${currentBalance}, Required: ${requiredAmount}`,
      undefined,
      { currentBalance, requiredAmount }
    );
  }
}

// Validation exceptions
export class InvalidEmailFormatError extends ArgumentInvalidException {
  constructor(email: string) {
    super(`Invalid email format: "${email}"`);
  }
}
```

### Error Handling in Controllers

Handle errors appropriately in controllers:

```typescript
@Controller('v1')
export class CreateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('users')
  async create(@Body() body: CreateUserRequestDto): Promise<IdResponse> {
    try {
      const command = new CreateUserCommand(body);
      const result = await this.commandBus.execute(command);

      return match(result, {
        Ok: (id: AggregateID) => new IdResponse(id.value),
        Err: (error: Error) => {
          this.handleError(error);
        },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: Error): never {
    if (error instanceof UserAlreadyExistsError) {
      throw new ConflictException(error.message);
    }

    if (error instanceof ArgumentInvalidException) {
      throw new BadRequestException(error.message);
    }

    if (error instanceof ArgumentNotProvidedException) {
      throw new BadRequestException(error.message);
    }

    // Log unexpected errors
    Logger.error('Unexpected error in CreateUserController', error.stack);
    throw new InternalServerErrorException('An unexpected error occurred');
  }
}
```

## Security Best Practices

### Input Validation

Always validate and sanitize inputs:

```typescript
export class CreateUserRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(320, { message: 'Email too long' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(1, { message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name too long' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'United States' })
  @IsString({ message: 'Country must be a string' })
  @IsNotEmpty({ message: 'Country is required' })
  @MinLength(2, { message: 'Country too short' })
  @MaxLength(100, { message: 'Country too long' })
  @Transform(({ value }) => value?.trim())
  country: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString({ message: 'Street must be a string' })
  @IsNotEmpty({ message: 'Street is required' })
  @MaxLength(255, { message: 'Street too long' })
  @Transform(({ value }) => value?.trim())
  street: string;

  @ApiProperty({ example: '12345' })
  @IsString({ message: 'Postal code must be a string' })
  @IsNotEmpty({ message: 'Postal code is required' })
  @MaxLength(20, { message: 'Postal code too long' })
  @Transform(({ value }) => value?.trim())
  postalCode: string;
}
```

### SQL Injection Prevention

Always use parameterized queries with Slonik:

```typescript
// ✅ Good - Parameterized query
async findByEmail(email: Email): Promise<UserEntity | null> {
  const result = await this.database.query(sql`
    SELECT * FROM users
    WHERE email = ${email.value} AND deleted_at IS NULL
  `);

  return result.rows[0] ? this.toDomainEntity(result.rows[0]) : null;
}

// ❌ Bad - String concatenation (vulnerable to SQL injection)
async findByEmailBad(email: string): Promise<UserEntity | null> {
  const result = await this.database.query(`
    SELECT * FROM users WHERE email = '${email}'
  `);

  return result.rows[0] ? this.toDomainEntity(result.rows[0]) : null;
}
```

### Permission Checks

Implement proper authorization:

```typescript
@Controller('v1')
@ApiBearerAuth()
export class CreateUserHttpController {
  @Post('users')
  @RequirePermissions(['user:create']) // Custom decorator for permission check
  @ApiOperation({ summary: 'Create a user' })
  async create(
    @Body() body: CreateUserRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser // Custom decorator to get current user
  ): Promise<IdResponse> {
    // Verify additional business rules
    if (!this.canUserCreateUser(currentUser)) {
      throw new ForbiddenException('Insufficient privileges to create user');
    }

    const command = new CreateUserCommand({
      ...body,
      createdBy: currentUser.id,
    });

    const result = await this.commandBus.execute(command);
    return this.handleResult(result);
  }

  private canUserCreateUser(user: AuthenticatedUser): boolean {
    return user.hasRole('admin') || user.hasRole('user-manager');
  }
}
```

## Performance Optimization

### Database Queries

Optimize database queries for performance:

```typescript
export class UserRepository implements UserRepositoryPort {
  async findManyPaginated(
    params: FindManyPaginatedParams
  ): Promise<Paginated<UserEntity>> {
    // Use proper indexes and efficient queries
    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM users
      WHERE deleted_at IS NULL
      ${params.filters.email ? sql`AND email = ${params.filters.email}` : sql``}
      ${params.filters.country ? sql`AND country = ${params.filters.country}` : sql``}
    `;

    const dataQuery = sql`
      SELECT id, email, name, country, street, postal_code, created_at, updated_at
      FROM users
      WHERE deleted_at IS NULL
      ${params.filters.email ? sql`AND email = ${params.filters.email}` : sql``}
      ${params.filters.country ? sql`AND country = ${params.filters.country}` : sql``}
      ORDER BY ${sql.identifier([params.sortBy])} ${sql.raw(params.sortOrder)}
      LIMIT ${params.limit} OFFSET ${(params.page - 1) * params.limit}
    `;

    const [countResult, dataResult] = await Promise.all([
      this.database.query(countQuery),
      this.database.query(dataQuery),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const data = dataResult.rows.map(row => this.toDomainEntity(row));

    return new Paginated({
      data,
      count: total,
      limit: params.limit,
      page: params.page,
    });
  }
}
```

### Caching Strategies

Implement caching for frequently accessed data:

```typescript
@Injectable()
export class UserQueryService {
  private readonly cache = new Map<string, any>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly redis: Redis, // If using Redis
  ) {}

  async getUserProfile(userId: string): Promise<UserProfileDto> {
    const cacheKey = `user:profile:${userId}`;

    // Try to get from cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const user = await this.userRepository.findById(new AggregateID(userId));
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = new UserProfileDto({
      id: user.id.value,
      email: user.email.value,
      name: user.name,
      country: user.address.country,
      createdAt: user.createdAt,
    });

    // Cache the result
    await this.setCache(cacheKey, profile, this.CACHE_TTL);

    return profile;
  }

  private async getFromCache(key: string): Promise<any> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      Logger.warn(`Cache get failed for key ${key}`, error);
      return null;
    }
  }

  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(value));
    } catch (error) {
      Logger.warn(`Cache set failed for key ${key}`, error);
    }
  }
}
```

## Code Quality Standards

### TypeScript Configuration

Use strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### ESLint Configuration

Follow consistent coding standards:

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Code Documentation

Document complex business logic:

```typescript
/**
 * Transfers money between two wallets within the same currency.
 *
 * This operation is atomic and will either complete successfully
 * or fail entirely without partial state changes.
 *
 * @param fromWallet - Source wallet (must have sufficient balance)
 * @param toWallet - Destination wallet (must use same currency)
 * @param amount - Amount to transfer (must be positive)
 * @param reason - Optional reason for the transfer
 *
 * @throws {ArgumentInvalidException} When wallets have different currencies
 * @throws {InsufficientBalanceError} When source wallet has insufficient funds
 * @throws {ArgumentInvalidException} When amount is negative or zero
 *
 * @example
 * ```typescript
 * const usdAmount = Money.create(100, Currency.USD);
 * walletService.transferMoney(wallet1, wallet2, usdAmount, 'Payment');
 * ```
 */
transferMoney(
  fromWallet: WalletEntity,
  toWallet: WalletEntity,
  amount: Money,
  reason?: string
): void {
  // Implementation...
}
```

## Git Workflow

### Commit Message Format

Follow conventional commit format:

```
type(scope): subject

body

footer
```

Examples:
- `feat(user): add email change functionality`
- `fix(wallet): prevent negative balance transfers`
- `docs(api): update user creation examples`
- `refactor(domain): extract address validation logic`
- `test(user): add email validation test cases`

### Branch Naming

Use descriptive branch names:

- `feature/user-email-change`
- `fix/wallet-negative-balance`
- `refactor/extract-validation-service`
- `docs/update-api-examples`

### Pull Request Guidelines

1. **Title**: Use clear, descriptive title
2. **Description**: Explain what changes were made and why
3. **Testing**: Describe how the changes were tested
4. **Breaking Changes**: Highlight any breaking changes
5. **Dependencies**: Note any new dependencies or requirements

## Documentation Standards

### API Documentation

Always document new endpoints:

```typescript
@ApiOperation({
  summary: 'Update user email address',
  description: `
    Updates the email address for an existing user. This operation:
    - Validates the new email format and uniqueness
    - Sends verification email to the new address
    - Publishes UserEmailChangedEvent for downstream processing
    - Requires user:update permission
  `
})
@ApiResponse({
  status: 200,
  description: 'Email updated successfully',
  type: UserResponseDto
})
@ApiResponse({
  status: 400,
  description: 'Invalid email format or missing required fields'
})
@ApiResponse({
  status: 409,
  description: 'Email address already in use by another user'
})
@Put('users/:id/email')
async updateEmail(@Param('id') id: string, @Body() body: UpdateEmailDto) {
  // Implementation...
}
```

### Code Comments

Add comments for complex business logic:

```typescript
export class WalletEntity extends AggregateRoot<WalletProps> {
  withdraw(amount: Money, reason?: string): void {
    // Business Rule: Prevent overdraft
    // The wallet balance must never go below zero to maintain
    // financial integrity and prevent negative balance scenarios
    if (this.props.balance.isLessThan(amount)) {
      throw new InsufficientBalanceError(
        this.props.balance.amount,
        amount.amount
      );
    }

    // Business Rule: Currency consistency
    // All operations on a wallet must use the same currency
    // to prevent currency mixing and maintain data integrity
    if (!this.props.currency.equals(amount.currency)) {
      throw new ArgumentInvalidException(
        `Currency mismatch: wallet uses ${this.props.currency.code}, ` +
        `but amount is in ${amount.currency.code}`
      );
    }

    const newBalance = this.props.balance.subtract(amount);
    this.props.balance = newBalance;
    this.props.updatedAt = new Date();

    // Publish domain event for downstream processing
    // This allows other bounded contexts to react to the withdrawal
    this.addEvent(new MoneyWithdrawnEvent({
      aggregateId: this.id.value,
      amount: amount.amount,
      currency: amount.currency.code,
      newBalance: newBalance.amount,
      reason,
      timestamp: new Date(),
    }));
  }
}
```

Following these best practices will help maintain code quality, consistency, and maintainability as the project grows and evolves.