# Domain-Driven Hexagon

A production-ready **Domain-Driven Design (DDD)** boilerplate implementing **Hexagonal Architecture** with **CQRS** patterns using **NestJS**, **TypeScript**, and **PostgreSQL**. This starter template demonstrates modern software architecture principles through practical, real-world implementations.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.1-red.svg)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24.0+ and **npm** 10.0+
- **Docker** and **Docker Compose** for development environment
- **Git** for version control

### Development Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/danilomartinelli/domain-driven-hexagon.git
   cd domain-driven-hexagon
   npm install
   ```

2. **Start development environment:**

   ```bash
   # Start all services (PostgreSQL, Redis, RabbitMQ, App)
   docker compose up -d

   # View logs
   docker compose logs -f app
   ```

3. **Run database migrations:**

   ```bash
   npm run migration:up
   npm run seed:up
   ```

4. **Access the application:**
   - **REST API**: <http://localhost:3000>
   - **GraphQL Playground**: <http://localhost:3000/graphql>
   - **API Documentation**: <http://localhost:3000/api>
   - **Database**: postgresql://user:password@localhost:5432/ddh
   - **Redis**: redis://localhost:6379
   - **RabbitMQ Management**: <http://localhost:15672> (user/password)

### Alternative Development (Local Setup)

If you prefer to run without Docker:

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local database configuration

# Start PostgreSQL locally and run migrations
npm run migration:up

# Start development server
npm run start:dev
```

## 🏗️ Architecture Overview

This boilerplate implements a **layered architecture** following **Domain-Driven Design** principles:

```text
┌─────────────────────────────────────────────────────────────┐
│                    🌐 API Layer                             │
│              (Controllers, Resolvers, DTOs)                │
├─────────────────────────────────────────────────────────────┤
│                 📋 Application Layer                        │
│             (Commands, Queries, Handlers)                  │
├─────────────────────────────────────────────────────────────┤
│                  🏢 Domain Layer                            │
│          (Entities, Value Objects, Events)                 │
├─────────────────────────────────────────────────────────────┤
│               🔧 Infrastructure Layer                       │
│            (Repositories, Database, Services)              │
└─────────────────────────────────────────────────────────────┘
```

### Core Architectural Patterns

- **Domain-Driven Design (DDD)**: Business logic encapsulated in domain entities and value objects
- **Hexagonal Architecture**: Clean separation between business logic and external concerns
- **CQRS Pattern**: Commands for writes, Queries for reads, with separate handlers
- **Repository Pattern**: Abstract data access with clean domain interfaces
- **Domain Events**: Decoupled communication between bounded contexts
- **Value Objects**: Type-safe, immutable data containers replacing primitives

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | NestJS, TypeScript, Node.js 24+ |
| **Database** | PostgreSQL 16, Slonik Query Builder |
| **APIs** | REST (Express), GraphQL (Apollo) |
| **Testing** | Jest, Cucumber, Supertest |
| **DevOps** | Docker, Docker Compose |
| **Patterns** | CQRS, Event Sourcing, DDD |

## 📁 Project Structure

```text
src/
├── modules/                    # Business Modules (Bounded Contexts)
│   ├── user/                   # User Domain Module
│   │   ├── commands/           # Write Operations (Create, Update, Delete)
│   │   ├── queries/           # Read Operations (Find, Get, List)
│   │   ├── domain/            # Core Business Logic
│   │   │   ├── entities/      # Domain Entities
│   │   │   ├── value-objects/ # Value Objects
│   │   │   └── events/        # Domain Events
│   │   ├── database/          # Persistence Layer
│   │   │   ├── repository/    # Repository Implementation
│   │   │   └── entities/      # Database Models
│   │   ├── dtos/              # Data Transfer Objects
│   │   └── user.module.ts     # Module Configuration
│   └── wallet/                # Wallet Domain Module
├── libs/                      # Shared Libraries
│   ├── api/                   # API Layer Components
│   ├── application/           # Application Services
│   ├── database/              # Database Configuration
│   ├── ddd/                   # DDD Building Blocks
│   ├── exceptions/            # Error Handling
│   └── types/                 # Shared Types
├── configs/                   # Configuration Files
└── main.ts                    # Application Entry Point
```

### Module Organization

Each business domain is organized as a **Bounded Context** with the following structure:

- **Commands/**: Handle state-changing operations (Create, Update, Delete)
- **Queries/**: Handle data retrieval operations (Get, List, Find)
- **Domain/**: Contains pure business logic (Entities, Value Objects, Domain Events)
- **Database/**: Persistence implementations and database models
- **DTOs/**: Input/Output data contracts for API layer

## 🛠️ Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start development server with hot reload |
| `npm run start:debug` | Start with debugging enabled |
| `npm run build` | Build production bundle |
| `npm run lint` | Lint and fix code issues |
| `npm run format` | Format code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run tests with coverage |

### Database Operations

| Script | Description |
|--------|-------------|
| `npm run migration:create -- <name>` | Create new migration |
| `npm run migration:up` | Run pending migrations |
| `npm run migration:down` | Rollback last migration |
| `npm run migration:status` | Check migration status |
| `npm run seed:up` | Run database seeds |

### Code Quality & Architecture

```bash
# Validate architectural dependencies
npm run deps:validate

# Generate dependency graph
npm run deps:graph

# Run all quality checks
npm run lint && npm run test && npm run deps:validate
```

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests** (`.spec.ts`): Test individual components in isolation
2. **Integration Tests** (`.integration.spec.ts`): Test component interactions
3. **End-to-End Tests** (`.e2e-spec.ts`): Test complete user workflows
4. **Behavioral Tests** (`.feature`): Test business scenarios with Gherkin syntax

### Running Tests

```bash
# Unit tests
npm test

# Integration tests with database
npm run test:database

# E2E tests
npm run test:e2e

# Watch mode for TDD
npm run test:watch

# Coverage reports
npm run test:cov
```

### Testing Architecture

- **Test Database**: Separate test database for isolation
- **Test Fixtures**: Reusable test data and setup utilities
- **Behavioral Testing**: Cucumber.js with Gherkin scenarios
- **Mocking Strategy**: Mock external dependencies, use real database for integration tests

## 📊 Domain Examples

### User Module

Demonstrates core DDD patterns:

```typescript
// Domain Entity
export class UserEntity extends AggregateRoot<UserProps> {
  get email(): Email {
    return this.props.email;
  }

  updateEmail(email: Email): void {
    this.props.email = email;
    this.addEvent(new UserEmailUpdatedEvent(this.id, email));
  }
}

// Value Object
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

// Command Handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    const user = UserEntity.create({
      email: new Email(command.email),
      name: command.name,
    });

    await this.userRepo.save(user);
    user.publishEvents(this.eventPublisher);
  }
}
```

### Wallet Module

Shows aggregate relationships and complex business rules:

```typescript
// Domain Service
@Injectable()
export class WalletDomainService {
  transferMoney(
    fromWallet: WalletEntity,
    toWallet: WalletEntity,
    amount: Money
  ): void {
    fromWallet.withdraw(amount);
    toWallet.deposit(amount);

    // Domain events are automatically added to aggregates
  }
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ddh

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://user:password@localhost:5672

# Application
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
```

### Path Aliases

The project uses TypeScript path mapping for clean imports:

```typescript
import { UserEntity } from '@modules/user/domain/user.entity';
import { DatabaseService } from '@libs/database/database.service';
import { ApiResponse } from '@libs/api/api.response';
```

## 🏛️ Architectural Decisions

### Why Slonik over TypeORM?

- **Raw SQL Control**: Better performance for complex queries
- **Type Safety**: Full TypeScript support for SQL queries
- **Migration Control**: Simple, predictable database migrations
- **No ORM Magic**: Explicit database operations, easier debugging

### Why CQRS?

- **Scalability**: Separate read/write models can be optimized independently
- **Complexity Management**: Clear separation of concerns
- **Event Sourcing**: Natural fit for event-driven architectures
- **Testing**: Easier to test commands and queries in isolation

### Why Domain Events?

- **Decoupling**: Bounded contexts communicate without direct dependencies
- **Extensibility**: Easy to add new event handlers
- **Audit Trail**: Natural event log for business operations
- **Integration**: Clean way to trigger external system integrations

## 📚 Domain-Driven Design Concepts

### Entities vs Value Objects

**Entities** have identity and lifecycle:

```typescript
class User extends AggregateRoot {
  constructor(private readonly id: UserId, private props: UserProps) {}

  // Behavior methods
  changeEmail(newEmail: Email): void { ... }
}
```

**Value Objects** are immutable and defined by their values:

```typescript
class Email extends ValueObject<string> {
  // No identity, defined by value
  // Immutable
  // Self-validating
}
```

### Aggregates and Bounded Contexts

- **Aggregates**: Consistency boundaries (User, Wallet)
- **Bounded Contexts**: Business domain boundaries (User Management, Financial Transactions)
- **Domain Events**: Communication between contexts

### Repository Pattern

```typescript
// Domain Interface (Port)
export interface UserRepositoryPort {
  findById(id: UserId): Promise<UserEntity>;
  save(user: UserEntity): Promise<void>;
}

// Infrastructure Implementation (Adapter)
@Injectable()
export class UserRepository implements UserRepositoryPort {
  // Database-specific implementation
}
```

## 🔒 Security Considerations

- **Input Validation**: Using class-validator and DTOs
- **SQL Injection Prevention**: Parameterized queries with Slonik
- **Type Safety**: TypeScript prevents many runtime errors
- **Domain Validation**: Business rules enforced in domain layer
- **Error Handling**: Proper exception handling and logging

## 🚀 Deployment

### Production Build

```bash
# Build application
npm run build

# Build Docker image
docker build -t domain-driven-hexagon .

# Run with Docker Compose
docker compose -f compose.prod.yml up -d
```

### Environment-Specific Configs

- **Development**: Hot reload, detailed logging, debug mode
- **Testing**: In-memory database, mocked external services
- **Production**: Optimized builds, structured logging, health checks

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow** the established patterns and conventions
4. **Write** tests for new functionality
5. **Validate** architecture with `npm run deps:validate`
6. **Submit** a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced code style
- **Prettier**: Automatic code formatting
- **Architecture**: Validated with dependency-cruiser
- **Testing**: Minimum 80% coverage for new features

### Adding New Modules

1. Create module directory in `src/modules/`
2. Follow the established structure (commands, queries, domain, database, dtos)
3. Register module in `app.module.ts`
4. Add appropriate tests
5. Update documentation

## 📖 Learning Resources

### Domain-Driven Design

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design by Vaughn Vernon](https://vaughnvernon.co/?page_id=168)

### Architecture Patterns

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)

### NestJS & TypeScript

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 📋 API Documentation

### REST API

Once the application is running, visit:

- **Swagger UI**: <http://localhost:3000/api>
- **OpenAPI Spec**: <http://localhost:3000/api-json>

### GraphQL

- **GraphQL Playground**: <http://localhost:3000/graphql>
- **Schema**: Auto-generated from TypeScript definitions

### Example Endpoints

```bash
# Create User
POST /users
{
  "email": "user@example.com",
  "name": "John Doe"
}

# Get User
GET /users/:id

# GraphQL Query
query {
  users {
    id
    email
    name
    createdAt
  }
}
```

## 🔍 Troubleshooting

### Common Issues

**Port Conflicts:**

```bash
# Check what's using port 3000
lsof -ti:3000

# Kill process if needed
kill -9 $(lsof -ti:3000)
```

**Database Connection:**

```bash
# Check database status
docker compose ps postgres

# Access database directly
docker compose exec postgres psql -U user -d ddh
```

**Docker Issues:**

```bash
# Clean up containers and volumes
docker compose down -v
docker system prune -f

# Rebuild containers
docker compose build --no-cache
```

### Debug Mode

```bash
# Start with debugging
npm run start:debug

# Attach debugger on port 9229
```

### Logs

```bash
# Application logs
docker compose logs -f app

# Database logs
docker compose logs -f postgres

# All services
docker compose logs -f
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NestJS Team** for the excellent framework
- **Domain-Driven Design Community** for architectural guidance
- **Clean Architecture** principles by Robert C. Martin
- **Hexagonal Architecture** by Alistair Cockburn
- **[Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon)** - Original repository that served as inspiration and reference for this implementation

---

## 🚀 Need Professional Development Services?

**Transform your business with enterprise-grade applications built by experts!**

[**Witek**](https://www.witek.com.br) specializes in developing robust, scalable applications using modern architecture patterns like Domain-Driven Design, Hexagonal Architecture, and CQRS. Our team of experienced developers can help you:

### 🎯 **What We Offer**

- **🏗️ Enterprise Architecture Design** - Design scalable systems that grow with your business
- **⚡ Modern Full-Stack Development** - React, Node.js, NestJS, TypeScript, and cutting-edge technologies
- **🚀 Cloud & DevOps Solutions** - AWS, Docker, Kubernetes, and CI/CD pipelines
- **📊 Database & API Design** - PostgreSQL, MongoDB, GraphQL, and RESTful services
- **🔒 Security & Performance** - Industry best practices for secure, high-performance applications
- **📱 Mobile & Web Applications** - Cross-platform solutions for all your digital needs

### 💼 **Why Choose Witek?**

- ✅ **Proven Expertise** - Years of experience with enterprise applications
- ✅ **Modern Technologies** - Always using the latest, most reliable tech stack
- ✅ **Agile Methodology** - Fast delivery with continuous feedback
- ✅ **Brazilian Excellence** - Local expertise with global standards
- ✅ **End-to-End Solutions** - From concept to deployment and maintenance

### 🤝 **Ready to Start Your Project?**

Whether you need to modernize legacy systems, build new applications from scratch, or scale your existing platform, **Witek** has the expertise to deliver exceptional results.

**📞 Get in touch today:** [**www.witek.com.br**](https://www.witek.com.br)

*Let's build something amazing together!*
