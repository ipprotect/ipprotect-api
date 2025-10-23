import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from './common/config/config.service';
import { requestIdMiddleware } from './common/util/request-id.middleware';
import {
  rlAuth,
  rlProofCreate,
  rlVerify,
  healthLimiter,
  statusLimiter,
} from './common/util/rate-limit';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // optional to capture early logs
  });
  const config = app.get(AppConfigService);
  const prefix = config.getApiPrefix();

  app.setGlobalPrefix(config.getApiPrefix());
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getAllowedOrigins().length
      ? config.getAllowedOrigins()
      : '*',
    credentials: true,
  });

  // Swagger / OpenAPI
  const cfg = new DocumentBuilder()
    .setTitle('IPProtect API')
    .setDescription('Proofs, Auth, Wallet, and Verification endpoints')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup('/api/docs', app, document, {
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  // Request ID
  app.use(requestIdMiddleware);

  // Route-scoped rate limits
  app.use(`${prefix}/auth`, rlAuth);
  app.use(`${prefix}/proofs`, rlProofCreate);
  app.use(`${prefix}/public`, rlVerify);

  // Public health/status (no-store)
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

  // Global pipes/filters/interceptors
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(config.getPort());
}
void bootstrap();
