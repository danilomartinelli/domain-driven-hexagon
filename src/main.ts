import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SecurityService } from '@libs/security/security.service';
import { EnvValidatorService } from '@libs/security/env-validator.service';
import { SecurityMiddleware } from '@libs/security/security.middleware';

/**
 * Application configuration interface for better type safety
 */
interface AppConfig {
  port: number;
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Bootstrap the NestJS application with comprehensive security and configuration
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS application with security-first configuration
    const app = await NestFactory.create(AppModule, {
      cors: false, // We'll configure CORS manually with SecurityService
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      abortOnError: true, // Fail fast on bootstrap errors
    });

    // Extract security services with proper error handling
    const securityService = app.get(SecurityService);
    const envValidator = app.get(EnvValidatorService);
    const securityMiddleware = app.get(SecurityMiddleware);

    // Build application configuration
    const config = buildAppConfig(envValidator);
    logger.log(`Starting application in ${config.environment} mode`);

    // Configure security middleware in proper order
    await configureSecurityMiddleware(app, securityService, securityMiddleware);

    // Configure global validation pipeline
    configureValidationPipeline(app, config);

    // Configure API documentation
    await configureApiDocumentation(app, config);

    // Enable graceful shutdown hooks
    app.enableShutdownHooks();

    // Start the server
    await app.listen(config.port);

    // Log successful startup
    logSuccessfulStartup(config);
  } catch (error) {
    logger.error('Failed to bootstrap application', error);
    process.exit(1);
  }
}

/**
 * Build type-safe application configuration
 */
function buildAppConfig(envValidator: EnvValidatorService): AppConfig {
  const environment = envValidator.get('NODE_ENV');
  const port = envValidator.get('PORT');

  return {
    port,
    environment,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
  };
}

/**
 * Configure security middleware in the correct order
 */
async function configureSecurityMiddleware(
  app: any,
  securityService: SecurityService,
  securityMiddleware: SecurityMiddleware,
): Promise<void> {
  // Apply custom security middleware first
  app.use((req: any, res: any, next: any) =>
    securityMiddleware.use(req, res, next),
  );

  // Apply Helmet security headers
  app.use(securityService.getHelmetConfig());

  // Configure CORS with security settings
  app.enableCors(securityService.getCorsConfig());
}

/**
 * Configure global validation pipeline with security considerations
 */
function configureValidationPipeline(app: any, config: AppConfig): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: config.isProduction,
      validateCustomDecorators: true,
      transformOptions: {
        enableImplicitConversion: false, // Prevent type coercion attacks
      },
      stopAtFirstError: true, // Improve performance and reduce attack surface
      skipMissingProperties: false, // Ensure all required properties are validated
      skipNullProperties: false, // Don't skip null validation
      skipUndefinedProperties: false, // Don't skip undefined validation
    }),
  );
}

/**
 * Configure Swagger API documentation with security
 */
async function configureApiDocumentation(
  app: any,
  config: AppConfig,
): Promise<void> {
  const swaggerOptions = new DocumentBuilder()
    .setTitle('Domain-Driven Hexagon API')
    .setDescription(
      'A secure Domain-Driven Design API with Hexagonal Architecture',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addSecurityRequirements('JWT-auth')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);

  // Only expose Swagger in non-production environments
  if (!config.isProduction) {
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none', // Collapse all sections by default
        filter: true, // Enable search filter
        showRequestDuration: true,
      },
    });
  }
}

/**
 * Log successful application startup with security information
 */
function logSuccessfulStartup(config: AppConfig): void {
  const logger = new Logger('Bootstrap');

  logger.log(`🚀 Application is running on: http://localhost:${config.port}`);
  logger.log(`📝 Environment: ${config.environment}`);

  if (!config.isProduction) {
    logger.log(`📚 API Documentation: http://localhost:${config.port}/docs`);
  }

  logger.log('🔐 Security features enabled:');
  logger.log('  ✓ Helmet security headers');
  logger.log('  ✓ CORS protection');
  logger.log('  ✓ Rate limiting');
  logger.log('  ✓ Input validation & sanitization');
  logger.log('  ✓ SQL injection protection');
  logger.log('  ✓ XSS prevention');
  logger.log('  ✓ Security logging & monitoring');
}

/**
 * Handle unhandled promise rejections and uncaught exceptions
 */
function setupGlobalErrorHandlers(): void {
  const logger = new Logger('GlobalErrorHandler');

  process.on(
    'unhandledRejection',
    (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection at Promise', { reason, promise });
      // In production, you might want to gracefully shutdown
      process.exit(1);
    },
  );

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logger.log('Received SIGTERM signal, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.log('Received SIGINT signal, shutting down gracefully');
    process.exit(0);
  });
}

// Set up global error handlers
setupGlobalErrorHandlers();

// Bootstrap the application
bootstrap().catch((error: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});
