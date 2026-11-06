import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { requestLogger } from './common/request-logger';
import { APP_CONFIG, type AppConfig } from './config/configuration';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function configureApp(app: INestApplication) {
  const cfg = app.get<AppConfig>(APP_CONFIG);
  (app as NestExpressApplication).disable?.('x-powered-by');
  (app as NestExpressApplication).set?.('trust proxy', 1);
  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: cfg.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], exposedHeaders: ['X-Data-Source'], maxAge: 600 });
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => { res.setHeader('X-Data-Source', cfg.dataSource); next(); });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('RANNAMATE API')
    .setDescription('Main backend for RANNAMATE — Your Kitchen. Your Mood. Your Mate.\n\nAll responses: `{ data, meta? }`; errors: `{ error: { code, message, details? } }`.\n\nData source for this instance: **' + cfg.dataSource + '**.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' });
  return cfg;
}
