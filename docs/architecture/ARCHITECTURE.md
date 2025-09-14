# Architecture Documentation

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Domain-Driven Design](#domain-driven-design)
- [Hexagonal Architecture](#hexagonal-architecture)
- [CQRS Pattern](#cqrs-pattern)
- [Module Structure](#module-structure)
- [Data Flow](#data-flow)
- [Domain Events](#domain-events)
- [Database Design](#database-design)
- [Security Architecture](#security-architecture)

## Overview

The Domain-Driven Hexagon project implements a sophisticated architecture that combines multiple design patterns and principles to create a maintainable, testable, and scalable application.

### Core Architectural Principles

1. **Domain-Driven Design (DDD)**: Business logic is organized around domain concepts
2. **Hexagonal Architecture**: Clean separation between business logic and external concerns
3. **CQRS Pattern**: Separate models for reading and writing operations
4. **Event-Driven Architecture**: Loose coupling through domain events
5. **Dependency Inversion**: Dependencies point inward to the domain

### Key Benefits

- **Testability**: Each layer can be tested in isolation
- **Maintainability**: Clear boundaries and responsibilities
- **Flexibility**: Easy to change external integrations
- **Scalability**: Commands and queries can scale independently
- **Domain Focus**: Business logic remains pure and focused

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WebApp[Web Application]
        Mobile[Mobile App]
        ThirdParty[Third-party Services]
    end

    subgraph "API Layer"
        REST[REST Controllers]
        GraphQL[GraphQL Resolvers]
        CLI[CLI Controllers]
        MessageQueue[Message Controllers]
    end

    subgraph "Application Layer"
        CommandHandlers[Command Handlers]
        QueryHandlers[Query Handlers]
        EventHandlers[Event Handlers]
        Services[Application Services]
    end

    subgraph "Domain Layer"
        Entities[Domain Entities]
        ValueObjects[Value Objects]
        DomainServices[Domain Services]
        DomainEvents[Domain Events]
        Repositories[Repository Ports]
    end

    subgraph "Infrastructure Layer"
        Database[PostgreSQL Database]
        Redis[Redis Cache]
        EventBus[Event Bus]
        FileStorage[File Storage]
        EmailService[Email Service]
        RepositoryImpl[Repository Implementation]
    end

    WebApp --> REST
    Mobile --> GraphQL
    ThirdParty --> REST

    REST --> CommandHandlers
    REST --> QueryHandlers
    GraphQL --> CommandHandlers
    GraphQL --> QueryHandlers
    CLI --> CommandHandlers
    MessageQueue --> CommandHandlers

    CommandHandlers --> Entities
    CommandHandlers --> DomainServices
    QueryHandlers --> Repositories
    EventHandlers --> Entities
    Services --> Entities

    Entities --> DomainEvents
    DomainServices --> Entities
    Repositories --> RepositoryImpl

    RepositoryImpl --> Database
    EventHandlers --> EventBus
    Services --> EmailService
    QueryHandlers --> Redis

    EventBus --> EventHandlers
```

## Domain-Driven Design

### Bounded Contexts

The application is organized into distinct bounded contexts, each representing a specific business domain:

```mermaid
graph LR
    subgraph "User Context"
        UserAggregate[User Aggregate]
        UserEmail[Email VO]
        UserAddress[Address VO]
        UserEvents[User Events]
    end

    subgraph "Wallet Context"
        WalletAggregate[Wallet Aggregate]
        Money[Money VO]
        Currency[Currency VO]
        WalletEvents[Wallet Events]
    end

    subgraph "Auth Context"
        AuthService[Auth Service]
        JWTToken[JWT Token VO]
        Permissions[Permissions]
    end

    UserEvents -.-> WalletAggregate
    WalletEvents -.-> UserAggregate
```

### Domain Model Components

#### 1. Aggregates

**User Aggregate** (`src/modules/user/domain/user.entity.ts`)
- **Purpose**: Manages user identity and personal information
- **Invariants**: Email uniqueness, valid address components
- **Commands**: CreateUser, UpdateUser, DeleteUser
- **Events**: UserCreated, UserUpdated, UserDeleted

**Wallet Aggregate** (`src/modules/wallet/domain/wallet.entity.ts`)
- **Purpose**: Manages financial balance and transactions
- **Invariants**: Non-negative balance, currency consistency
- **Commands**: CreateWallet, Deposit, Withdraw
- **Events**: WalletCreated, MoneyDeposited, MoneyWithdrawn

#### 2. Value Objects

**Email** (`src/modules/user/domain/value-objects/email.value-object.ts`)
```typescript
export class Email extends ValueObject<string> {
  constructor(value: string) {
    super({ value });
    this.validate();
  }

  private validate(): void {
    if (!this.isValidEmail(this.props.value)) {
      throw new ArgumentInvalidException('Invalid email format');
    }
  }
}
```

**Address** (`src/modules/user/domain/value-objects/address.value-object.ts`)
```typescript
export class Address extends ValueObject<AddressProps> {
  constructor(props: AddressProps) {
    super(props);
    this.validate();
  }

  get country(): string {
    return this.props.country;
  }

  get street(): string {
    return this.props.street;
  }

  get postalCode(): string {
    return this.props.postalCode;
  }
}
```

#### 3. Domain Services

Domain services handle business logic that doesn't naturally fit within a single aggregate:

```typescript
@Injectable()
export class WalletDomainService {
  transferMoney(
    fromWallet: WalletEntity,
    toWallet: WalletEntity,
    amount: Money
  ): void {
    // Complex business logic spanning multiple aggregates
    fromWallet.withdraw(amount);
    toWallet.deposit(amount);
  }
}
```

## Hexagonal Architecture

### Ports and Adapters

The hexagonal architecture ensures that the domain layer remains isolated from external concerns:

```mermaid
graph TD
    subgraph "Domain Core (Hexagon)"
        Domain[Domain Logic]
        Ports[Ports/Interfaces]
    end

    subgraph "Primary Adapters (Driving)"
        REST[REST API]
        GraphQL[GraphQL API]
        CLI[CLI Interface]
        Tests[Test Suites]
    end

    subgraph "Secondary Adapters (Driven)"
        PostgresAdapter[PostgreSQL Adapter]
        RedisAdapter[Redis Adapter]
        EmailAdapter[Email Service Adapter]
        FileAdapter[File Storage Adapter]
    end

    REST --> Ports
    GraphQL --> Ports
    CLI --> Ports
    Tests --> Ports

    Ports --> Domain
    Domain --> Ports

    Ports --> PostgresAdapter
    Ports --> RedisAdapter
    Ports --> EmailAdapter
    Ports --> FileAdapter
```

### Repository Pattern Implementation

```typescript
// Domain Port (Interface)
export interface UserRepositoryPort {
  findById(id: UserId): Promise<UserEntity | null>;
  findByEmail(email: Email): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  delete(id: UserId): Promise<void>;
}

// Infrastructure Adapter (Implementation)
@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: UserId): Promise<UserEntity | null> {
    // Database-specific implementation
    const result = await this.database.query(sql`
      SELECT * FROM users WHERE id = ${id.value}
    `);

    return result.rows[0] ? this.toDomainEntity(result.rows[0]) : null;
  }

  // More implementations...
}
```

## CQRS Pattern

Commands and Queries are strictly separated to enable independent scaling and optimization:

```mermaid
graph LR
    subgraph "Command Side (Write)"
        Commands[Commands]
        CommandHandlers[Command Handlers]
        Aggregates[Domain Aggregates]
        WriteDB[(Write Database)]
    end

    subgraph "Query Side (Read)"
        Queries[Queries]
        QueryHandlers[Query Handlers]
        ReadModels[Read Models]
        ReadDB[(Read Database/Cache)]
    end

    subgraph "Integration"
        EventBus[Event Bus]
        Projections[Event Projections]
    end

    Commands --> CommandHandlers
    CommandHandlers --> Aggregates
    Aggregates --> WriteDB
    Aggregates --> EventBus

    Queries --> QueryHandlers
    QueryHandlers --> ReadModels
    ReadModels --> ReadDB

    EventBus --> Projections
    Projections --> ReadDB
```

### Command Flow

1. **API Layer** receives HTTP request
2. **Controller** creates and validates Command DTO
3. **Command Handler** processes business logic
4. **Domain Entity** applies business rules
5. **Repository** persists changes
6. **Domain Events** are published
7. **Event Handlers** update read models

### Query Flow

1. **API Layer** receives HTTP request
2. **Controller** creates Query DTO
3. **Query Handler** retrieves data
4. **Read Model** provides optimized data structure
5. **Response DTO** formats output

## Module Structure

Each business domain follows a consistent structure:

```
src/modules/{domain}/
├── commands/                    # Write Operations
│   ├── create-{entity}/
│   │   ├── create-{entity}.command.ts
│   │   ├── create-{entity}.service.ts
│   │   ├── create-{entity}.http.controller.ts
│   │   ├── create-{entity}.request.dto.ts
│   │   └── create-{entity}.cli.controller.ts
│   └── update-{entity}/
├── queries/                     # Read Operations
│   ├── find-{entities}/
│   │   ├── find-{entities}.query-handler.ts
│   │   ├── find-{entities}.http.controller.ts
│   │   ├── find-{entities}.graphql-resolver.ts
│   │   └── find-{entities}.request.dto.ts
│   └── get-{entity}/
├── domain/                      # Core Business Logic
│   ├── entities/
│   │   └── {entity}.entity.ts
│   ├── value-objects/
│   │   ├── {value-object}.value-object.ts
│   │   └── ...
│   ├── events/
│   │   ├── {entity}-created.domain-event.ts
│   │   └── ...
│   ├── services/
│   │   └── {domain}.service.ts
│   └── {entity}.types.ts
├── database/                    # Persistence Layer
│   ├── {entity}.repository.port.ts
│   ├── {entity}.repository.ts
│   └── {entity}.mapper.ts
├── dtos/                       # Data Transfer Objects
│   ├── {entity}.response.dto.ts
│   ├── {entity}.paginated.response.dto.ts
│   └── graphql/
│       └── {entity}.graphql-response.dto.ts
├── application/                # Application Services
│   └── event-handlers/
│       └── {event}.handler.ts
├── {domain}.module.ts          # Module Configuration
└── {domain}.di-tokens.ts       # Dependency Injection Tokens
```

## Data Flow

### Command Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant CommandBus
    participant Handler
    participant Entity
    participant Repository
    participant EventBus
    participant EventHandler

    Client->>Controller: POST /users
    Controller->>Controller: Validate DTO
    Controller->>CommandBus: Execute Command
    CommandBus->>Handler: Handle CreateUserCommand
    Handler->>Entity: Create User Entity
    Entity->>Entity: Apply Business Rules
    Handler->>Repository: Save User
    Repository->>Repository: Persist to Database
    Entity->>EventBus: Publish UserCreatedEvent
    EventBus->>EventHandler: Handle Event
    EventHandler->>EventHandler: Create Wallet
    Handler-->>Controller: Return UserId
    Controller-->>Client: Return 201 Created
```

### Query Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant QueryBus
    participant Handler
    participant Repository
    participant Database

    Client->>Controller: GET /users
    Controller->>Controller: Validate Query Params
    Controller->>QueryBus: Execute Query
    QueryBus->>Handler: Handle FindUsersQuery
    Handler->>Repository: Find Users
    Repository->>Database: Execute SQL Query
    Database-->>Repository: Return Rows
    Repository-->>Handler: Return User Models
    Handler-->>Controller: Return Paginated Results
    Controller-->>Client: Return 200 OK
```

## Domain Events

Domain events enable loose coupling between bounded contexts and provide audit trails:

### Event Architecture

```mermaid
graph TD
    subgraph "Event Publishers"
        UserAggregate[User Aggregate]
        WalletAggregate[Wallet Aggregate]
    end

    subgraph "Event Infrastructure"
        EventBus[In-Process Event Bus]
        EventStore[Event Store/Audit Log]
    end

    subgraph "Event Handlers"
        WalletHandler[Create Wallet Handler]
        EmailHandler[Send Welcome Email Handler]
        AuditHandler[Audit Log Handler]
    end

    UserAggregate -->|UserCreatedEvent| EventBus
    WalletAggregate -->|WalletCreatedEvent| EventBus

    EventBus --> WalletHandler
    EventBus --> EmailHandler
    EventBus --> AuditHandler
    EventBus --> EventStore
```

### Event Implementation

```typescript
// Domain Event
export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string,
  ) {
    super({ aggregateId: userId });
  }
}

// Event Handler
@EventsHandler(UserCreatedEvent)
export class CreateWalletWhenUserCreatedHandler
  implements IEventHandler<UserCreatedEvent> {

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    const command = new CreateWalletCommand({
      userId: event.userId,
      initialBalance: 0,
      currency: 'USD',
    });

    await this.commandBus.execute(command);
  }
}
```

## Database Design

### Schema Overview

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar name
        varchar country
        varchar street
        varchar postal_code
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    wallets {
        uuid id PK
        uuid user_id FK
        decimal balance
        varchar currency
        timestamp created_at
        timestamp updated_at
    }

    user_roles {
        uuid id PK
        uuid user_id FK
        varchar role
        timestamp created_at
    }

    domain_events {
        uuid id PK
        varchar aggregate_id
        varchar event_type
        jsonb event_data
        timestamp occurred_at
        varchar correlation_id
    }

    users ||--|| wallets : "has one"
    users ||--o{ user_roles : "has many"
    users ||--o{ domain_events : "publishes"
    wallets ||--o{ domain_events : "publishes"
```

### Migration Strategy

- **Versioned Migrations**: Each migration has a timestamp and is applied in order
- **Rollback Support**: All migrations include down scripts
- **Data Integrity**: Foreign key constraints and check constraints enforce business rules
- **Performance**: Appropriate indexes for common query patterns

```sql
-- Example Migration: Create Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    street VARCHAR(255) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
```

## Security Architecture

### Authentication & Authorization

```mermaid
graph TD
    subgraph "Authentication"
        Login[Login Endpoint]
        JWT[JWT Token Service]
        TokenValidation[Token Validation]
    end

    subgraph "Authorization"
        Permissions[Permission System]
        RoleGuards[Role Guards]
        ResourceGuards[Resource Guards]
    end

    subgraph "Security Middleware"
        AuthGuard[Authentication Guard]
        ThrottleGuard[Rate Limiting Guard]
        ValidationPipe[Input Validation]
        SanitizationPipe[Input Sanitization]
    end

    Login --> JWT
    JWT --> TokenValidation
    TokenValidation --> AuthGuard
    AuthGuard --> Permissions
    Permissions --> RoleGuards
    RoleGuards --> ResourceGuards

    ThrottleGuard --> ValidationPipe
    ValidationPipe --> SanitizationPipe
```

### Security Layers

1. **Input Validation**: All inputs validated using class-validator
2. **SQL Injection Prevention**: Parameterized queries with Slonik
3. **Authentication**: JWT-based stateless authentication
4. **Authorization**: Role-based access control (RBAC)
5. **Rate Limiting**: Throttling to prevent abuse
6. **Data Sanitization**: Input sanitization to prevent XSS

### Permission System

```typescript
// Permission Decorator
@RequirePermissions(['user:create'])
export class CreateUserController {
  // Controller implementation
}

// Permission Check Implementation
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.getRequiredPermissions(context);
    const userPermissions = this.getUserPermissions(context);

    return this.hasAllPermissions(userPermissions, requiredPermissions);
  }
}
```

## Performance Considerations

### Caching Strategy

- **Redis**: Used for session data, frequently accessed queries
- **Database Connection Pooling**: Optimized connection management
- **Query Optimization**: Proper indexing and query structure
- **Lazy Loading**: Domain entities load relationships on demand

### Scaling Patterns

- **Command/Query Separation**: Independent scaling of read/write operations
- **Event-Driven Architecture**: Asynchronous processing of non-critical operations
- **Microservice Ready**: Clear bounded contexts can be extracted as services
- **Database Sharding Ready**: UUIDs and proper data distribution

This architecture provides a solid foundation for building complex, maintainable applications while following established patterns and best practices from the Domain-Driven Design and Clean Architecture communities.