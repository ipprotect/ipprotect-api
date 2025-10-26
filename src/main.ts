import { NestFactory } from '@nestjs/core';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from './common/config/config.service';
import { requestIdMiddleware } from './common/util/request-id.middleware';
// ✅ new
import { makeRateLimiters } from './common/util/rate-limit';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import type { Application as ExpressApp, Request, Response, NextFunction } from 'express';
// Import the feature modules so we can pass them to Swagger "include"
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LegalModule } from './legal/legal.module';
import { HealthModule } from './health/health.module';

async function bootstrap() {
  // Strongly type options to avoid "unsafe assignment" lint
  const opts: NestApplicationOptions = { bufferLogs: true };

  // Strongly type the Nest app (no `any`)
  const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(
    AppModule,
    opts,
  );
  const config = app.get(AppConfigService);
  const prefix = config.getApiPrefix();
  // Get the underlying Express instance and type it explicitly
  const expressApp: ExpressApp = app.getHttpAdapter().getInstance();

  // Render (and most PaaS) run behind a proxy → enable this BEFORE any middleware that reads req.ip/req.secure
  expressApp.set('trust proxy', config.getTrustProxy());
  // 🔹 Global middleware (early)
  app.use(requestIdMiddleware);

  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: config.getAllowedOrigins().length ? config.getAllowedOrigins() : '*',
    credentials: true,
  });

  // 🔹 Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('IPProtect API')
    .setDescription('Proofs, Auth, Wallet, and Verification endpoints')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [AuthModule, UsersModule, LegalModule, HealthModule],
  });
  SwaggerModule.setup('/api/docs', app, document, {
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const { rlAuth, rlProofCreate, rlVerify, healthLimiter, statusLimiter } =
    makeRateLimiters(config);
  // Route-scoped rate limits
  app.use(`${prefix}/auth`, rlAuth);
  app.use(`${prefix}/proofs`, rlProofCreate);
  app.use(`${prefix}/public`, rlVerify);

  // 🔹 Health & status
  app.use(
    `${prefix}/health`,
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    healthLimiter,
  );

  app.use(
    `${prefix}/status`,
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    statusLimiter,
  );

  // 🔹 Global pipes/filters/interceptors
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  //raceful shutdown hooks
  app.enableShutdownHooks();

  await app.listen(config.getPort());
}
void bootstrap();
