import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { SecurityService } from '@libs/security/security.service';
import { EnvValidatorService } from '@libs/security/env-validator.service';
import { SecurityMiddleware } from '@libs/security/security.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable CORS with security configuration
    cors: false, // We'll configure CORS manually with SecurityService
  });

  // Get security services
  const securityService = app.get(SecurityService);
  const envValidator = app.get(EnvValidatorService);
  const securityMiddleware = app.get(SecurityMiddleware);

  // Apply security middleware
  app.use((req, res, next) => securityMiddleware.use(req, res, next));

  // Apply Helmet security headers
  app.use(securityService.getHelmetConfig());

  // Configure CORS with security settings
  app.enableCors(securityService.getCorsConfig());

  // Enhanced validation pipe with security considerations
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: envValidator.get('NODE_ENV') === 'production',
      validateCustomDecorators: true,
      transformOptions: {
        enableImplicitConversion: false, // Prevent type coercion attacks
      },
    }),
  );

  // Swagger configuration with security
  const swaggerOptions = new DocumentBuilder()
    .setTitle('Domain-Driven Hexagon API')
    .setDescription('A secure Domain-Driven Design API with Hexagonal Architecture')
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
  if (envValidator.get('NODE_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Get port from environment
  const port = envValidator.get('PORT');
  
  // Start server
  await app.listen(port);
  
  // Log startup information (with security consideration)
  const environment = envValidator.get('NODE_ENV');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📝 Environment: ${environment}`);
  
  if (environment !== 'production') {
    console.log(`📚 API Documentation: http://localhost:${port}/docs`);
  }
  
  console.log('🔐 Security features enabled:');
  console.log('  ✓ Helmet security headers');
  console.log('  ✓ CORS protection');
  console.log('  ✓ Rate limiting');
  console.log('  ✓ Input validation & sanitization');
  console.log('  ✓ SQL injection protection');
  console.log('  ✓ XSS prevention');
  console.log('  ✓ Security logging & monitoring');
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
