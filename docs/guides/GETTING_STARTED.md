# Getting Started Guide

This comprehensive guide will help you set up, understand, and start working with the Domain-Driven Hexagon project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [First Steps](#first-steps)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

- **Node.js 24.0+** and **npm 10.0+**
  ```bash
  node --version  # Should be >= 24.0.0
  npm --version   # Should be >= 10.0.0
  ```

- **Docker** and **Docker Compose** (for development environment)
  ```bash
  docker --version
  docker-compose --version
  ```

- **Git** for version control
  ```bash
  git --version
  ```

### Recommended Tools

- **VS Code** with recommended extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Docker
  - REST Client
  - GraphQL

- **PostgreSQL Client** (optional, for direct database access)
  - pgAdmin, DBeaver, or command-line `psql`

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/danilomartinelli/domain-driven-hexagon.git
cd domain-driven-hexagon
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- NestJS framework and modules
- TypeScript and compilation tools
- Database libraries (Slonik)
- Testing frameworks (Jest, Cucumber)
- Code quality tools (ESLint, Prettier)

### 3. Environment Setup

#### Option A: Docker Development (Recommended)

Start all services with Docker Compose:

```bash
# Start all services (PostgreSQL, Redis, RabbitMQ, App)
docker compose up -d

# View logs
docker compose logs -f app

# Check service status
docker compose ps
```

#### Option B: Local Development

If you prefer to run services locally:

```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your local configuration
# DATABASE_URL=postgresql://user:password@localhost:5432/ddh
# REDIS_URL=redis://localhost:6379
# etc.

# Start PostgreSQL and Redis locally (using your preferred method)

# Install and run migrations
npm run migration:up

# Start development server
npm run start:dev
```

### 4. Database Setup

Run database migrations and seed data:

```bash
# Run migrations
npm run migration:up

# Seed initial data (optional)
npm run seed:up

# Check migration status
npm run migration:status
```

### 5. Verify Installation

Test that everything is working:

```bash
# Check if the API is responding
curl http://localhost:3000/health

# Run tests
npm test

# Check code quality
npm run lint
npm run deps:validate
```

## Project Structure

Understanding the project structure is crucial for effective development:

```
domain-driven-hexagon/
├── src/                        # Source code
│   ├── modules/                # Business modules (bounded contexts)
│   │   ├── user/              # User domain module
│   │   │   ├── commands/      # Write operations
│   │   │   ├── queries/       # Read operations
│   │   │   ├── domain/        # Business logic
│   │   │   ├── database/      # Data persistence
│   │   │   └── dtos/          # Data transfer objects
│   │   ├── wallet/            # Wallet domain module
│   │   └── auth/              # Authentication module
│   ├── libs/                   # Shared libraries
│   │   ├── api/               # API utilities
│   │   ├── database/          # Database configuration
│   │   ├── ddd/               # DDD building blocks
│   │   ├── exceptions/        # Error handling
│   │   └── security/          # Security utilities
│   ├── configs/               # Configuration files
│   └── main.ts                # Application entry point
├── tests/                     # Test files
├── database/                  # Database migrations and seeds
├── docs/                      # Documentation
├── devtools/                  # Development tools and scripts
└── docker-compose.yml         # Docker services configuration
```

### Key Architectural Layers

1. **API Layer** (`controllers`, `resolvers`): Handles HTTP/GraphQL requests
2. **Application Layer** (`commands`, `queries`, `handlers`): Orchestrates business operations
3. **Domain Layer** (`entities`, `value-objects`, `events`): Contains business logic
4. **Infrastructure Layer** (`database`, `repositories`): External integrations

## First Steps

### 1. Explore the API

Once the application is running, you can explore the available APIs:

#### REST API Documentation
- **Swagger UI**: http://localhost:3000/api
- **OpenAPI Spec**: http://localhost:3000/api-json

#### GraphQL API
- **GraphQL Playground**: http://localhost:3000/graphql

#### Health Check
```bash
curl http://localhost:3000/health
```

### 2. Create Your First User

Try creating a user using the REST API:

```bash
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "country": "United States",
    "street": "123 Test Street",
    "postalCode": "12345"
  }'
```

Or using GraphQL:

```graphql
mutation {
  createUser(input: {
    email: "test@example.com"
    name: "Test User"
    country: "United States"
    street: "123 Test Street"
    postalCode: "12345"
  }) {
    id
  }
}
```

### 3. Explore the Database

Check the created user and associated wallet:

```bash
# Connect to PostgreSQL (if using Docker)
docker compose exec postgres psql -U user -d ddh

# Query users
SELECT * FROM users;

# Query wallets
SELECT * FROM wallets;

# Exit
\q
```

## Development Workflow

### 1. Code-First Development

The project follows a domain-driven approach. When adding new features:

1. **Start with Domain Logic**: Define entities, value objects, and business rules
2. **Add Application Services**: Create commands/queries and their handlers
3. **Implement Infrastructure**: Add repositories and external integrations
4. **Expose via API**: Create controllers and DTOs
5. **Write Tests**: Add unit, integration, and end-to-end tests

### 2. Working with Commands and Queries

#### Creating a New Command

Example: Adding an "Update User Email" command

1. **Create the Command**:
   ```typescript
   // src/modules/user/commands/update-user-email/update-user-email.command.ts
   export class UpdateUserEmailCommand extends CommandBase {
     constructor(public readonly props: UpdateUserEmailProps) {
       super(props);
     }
   }
   ```

2. **Create the Handler**:
   ```typescript
   // src/modules/user/commands/update-user-email/update-user-email.service.ts
   @CommandHandler(UpdateUserEmailCommand)
   export class UpdateUserEmailHandler implements ICommandHandler {
     async execute(command: UpdateUserEmailCommand): Promise<Result<void, Error>> {
       // Business logic here
     }
   }
   ```

3. **Add the Controller**:
   ```typescript
   // src/modules/user/commands/update-user-email/update-user-email.http.controller.ts
   @Controller('v1')
   export class UpdateUserEmailHttpController {
     @Put('users/:id/email')
     async updateEmail(@Param('id') id: string, @Body() body: UpdateEmailDto) {
       // Controller logic
     }
   }
   ```

#### Creating a New Query

Example: Adding a "Get User Profile" query

1. **Create the Query**:
   ```typescript
   // src/modules/user/queries/get-user-profile/get-user-profile.query.ts
   export class GetUserProfileQuery extends QueryBase {
     constructor(public readonly userId: string) {
       super();
     }
   }
   ```

2. **Create the Handler**:
   ```typescript
   // src/modules/user/queries/get-user-profile/get-user-profile.query-handler.ts
   @QueryHandler(GetUserProfileQuery)
   export class GetUserProfileHandler implements IQueryHandler {
     async execute(query: GetUserProfileQuery): Promise<UserProfileModel> {
       // Query logic here
     }
   }
   ```

### 3. Domain Events

When domain entities need to communicate with other parts of the system:

1. **Define the Event**:
   ```typescript
   // src/modules/user/domain/events/user-email-changed.domain-event.ts
   export class UserEmailChangedEvent extends DomainEvent {
     constructor(
       public readonly userId: string,
       public readonly oldEmail: string,
       public readonly newEmail: string,
     ) {
       super({ aggregateId: userId });
     }
   }
   ```

2. **Publish from Entity**:
   ```typescript
   // In your user entity
   changeEmail(newEmail: Email): void {
     const oldEmail = this.props.email;
     this.props.email = newEmail;

     this.addEvent(new UserEmailChangedEvent(
       this.id.value,
       oldEmail.value,
       newEmail.value
     ));
   }
   ```

3. **Handle the Event**:
   ```typescript
   // src/modules/user/application/event-handlers/user-email-changed.handler.ts
   @EventsHandler(UserEmailChangedEvent)
   export class UserEmailChangedHandler implements IEventHandler {
     async handle(event: UserEmailChangedEvent): Promise<void> {
       // Handle the event (send email, update other systems, etc.)
     }
   }
   ```

## Testing

The project includes comprehensive testing strategies:

### 1. Unit Tests

Test individual components in isolation:

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test src/modules/user/domain/user.entity.spec.ts
```

### 2. Integration Tests

Test component interactions with real database:

```bash
# Run database integration tests
npm run test:database

# Run in watch mode
npm run test:database:watch
```

### 3. End-to-End Tests

Test complete user workflows:

```bash
# Run E2E tests
npm run test:e2e
```

### 4. Writing Tests

#### Unit Test Example

```typescript
describe('UserEntity', () => {
  it('should create a user with valid data', () => {
    // Arrange
    const email = new Email('test@example.com');
    const address = new Address({
      country: 'USA',
      street: '123 Test St',
      postalCode: '12345'
    });

    // Act
    const user = UserEntity.create({
      email,
      name: 'Test User',
      address
    });

    // Assert
    expect(user.email.value).toBe('test@example.com');
    expect(user.name).toBe('Test User');
  });

  it('should throw error with invalid email', () => {
    // Arrange & Act & Assert
    expect(() => {
      new Email('invalid-email');
    }).toThrow('Invalid email format');
  });
});
```

#### Integration Test Example

```typescript
describe('CreateUserHandler (Integration)', () => {
  let handler: CreateUserHandler;
  let userRepository: UserRepositoryPort;

  beforeEach(async () => {
    // Setup test database and dependencies
  });

  it('should create user and wallet', async () => {
    // Arrange
    const command = new CreateUserCommand({
      email: 'integration@test.com',
      name: 'Integration Test',
      country: 'USA',
      street: '123 Integration St',
      postalCode: '12345'
    });

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isOk()).toBe(true);

    const savedUser = await userRepository.findByEmail(
      new Email('integration@test.com')
    );
    expect(savedUser).toBeDefined();
  });
});
```

## Common Tasks

### 1. Adding a New Module

To add a new business domain (e.g., "Product"):

```bash
# Create module structure
mkdir -p src/modules/product/{commands,queries,domain,database,dtos,application}
mkdir -p src/modules/product/domain/{entities,value-objects,events}

# Create basic files
touch src/modules/product/product.module.ts
touch src/modules/product/product.di-tokens.ts
touch src/modules/product/domain/product.entity.ts
touch src/modules/product/domain/product.types.ts
```

### 2. Database Migrations

```bash
# Create a new migration
npm run migration:create -- add-products-table

# Run pending migrations
npm run migration:up

# Rollback last migration
npm run migration:down

# Check migration status
npm run migration:status
```

### 3. Code Quality Checks

```bash
# Lint and fix code
npm run lint

# Format code
npm run format

# Validate architectural dependencies
npm run deps:validate

# Generate dependency graph
npm run deps:graph
```

### 4. Development Commands

```bash
# Start in development mode (with hot reload)
npm run start:dev

# Start in debug mode
npm run start:debug

# Build for production
npm run build

# Start production build
npm run start:prod
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

#### Database Connection Issues

```bash
# Check database container status
docker compose ps postgres

# View database logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

#### Migration Failures

```bash
# Check migration status
npm run migration:status

# Reset database (WARNING: destroys all data)
docker compose down -v
docker compose up -d postgres
npm run migration:up
```

#### TypeScript Compilation Errors

```bash
# Clean build directory
npm run prebuild

# Rebuild
npm run build

# Check TypeScript configuration
npx tsc --showConfig
```

### Debugging

#### Application Debugging

```bash
# Start in debug mode
npm run start:debug

# Attach debugger (VS Code)
# Go to Run and Debug → Attach to Node.js
# Or use Chrome DevTools at chrome://inspect
```

#### Database Debugging

```bash
# Connect to database directly
docker compose exec postgres psql -U user -d ddh

# View recent logs
docker compose logs -f postgres --tail=100

# Query system tables
SELECT * FROM pg_stat_activity;
```

#### Test Debugging

```bash
# Debug specific test
npm run test:debug -- --testNamePattern="should create user"

# Run single test file
npm test -- src/modules/user/domain/user.entity.spec.ts

# Enable verbose output
npm test -- --verbose
```

## Next Steps

Now that you have the basic setup working, here are some recommended next steps:

### 1. Learn the Domain Model

- Read the [Domain Model Documentation](../architecture/domain-model.md)
- Understand the User and Wallet aggregates
- Learn about Value Objects and Domain Events

### 2. Explore the API

- Use the Swagger UI at http://localhost:3000/api
- Try the GraphQL Playground at http://localhost:3000/graphql
- Read the [API Guide](../api/API_GUIDE.md)

### 3. Study the Architecture

- Read the [Architecture Documentation](../architecture/ARCHITECTURE.md)
- Understand CQRS and Event-Driven patterns
- Learn about Hexagonal Architecture principles

### 4. Add Your First Feature

Try implementing a simple feature like:
- User profile updates
- Wallet transaction history
- User search functionality

### 5. Advanced Topics

- Implement your own bounded context
- Add integration with external services
- Implement advanced querying with filters and sorting
- Add caching strategies
- Implement audit logging

### 6. Contributing

- Read the [Contributing Guidelines](../../CONTRIBUTING.md)
- Check the [Development Guide](../DEVELOPER_GUIDE.md)
- Look at open issues in the GitHub repository

### Resources

- **NestJS Documentation**: https://docs.nestjs.com/
- **Domain-Driven Design**: https://www.domainlanguage.com/ddd/
- **Clean Architecture**: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- **CQRS Pattern**: https://martinfowler.com/bliki/CQRS.html
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

You're now ready to start building with the Domain-Driven Hexagon project! Remember to refer to the comprehensive documentation as you work, and don't hesitate to explore the codebase to understand the patterns and practices used.