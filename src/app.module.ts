import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserModule } from '@modules/user/user.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { RequestContextModule } from 'nestjs-request-context';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextInterceptor } from './libs/application/context/ContextInterceptor';
import { ExceptionInterceptor } from '@libs/application/interceptors/exception.interceptor';
import { getDatabaseConfig } from './configs/database.config';
import { DatabaseModule } from '@libs/database';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SecurityModule } from '@libs/security/security.module';

const interceptors = [
  {
    provide: APP_INTERCEPTOR,
    useClass: ContextInterceptor,
  },
  {
    provide: APP_INTERCEPTOR,
    useClass: ExceptionInterceptor,
  },
];

@Module({
  imports: [
    // Core modules
    EventEmitterModule.forRoot(),
    RequestContextModule,

    // Security module - loaded first for global security
    SecurityModule,

    // Enhanced database module
    DatabaseModule.forRoot(getDatabaseConfig()),

    CqrsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      // Security configuration for GraphQL
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req, res }) => ({ req, res }),
      formatError: (error) => {
        // Sanitize GraphQL errors in production
        if (process.env.NODE_ENV === 'production') {
          return {
            message: error.message,
            // Remove sensitive details in production
            extensions: {
              code: error.extensions?.code,
            },
          };
        }
        return error;
      },
    }),

    // Business modules
    UserModule,
    WalletModule,
  ],
  controllers: [],
  providers: [...interceptors],
})
export class AppModule {}
