import 'reflect-metadata';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as loadDotenv } from 'dotenv';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { InvalidEnvironmentConfigurationError } from './config/env.schema.js';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter.js';
import { generateRequestId } from './common/request-id.js';

loadDotenv();

const UPLOAD_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'text/plain'];
const REDACTED_HEADERS = ['authorization', 'cookie'];

async function bootstrap(): Promise<void> {
  const logger = new Logger('bootstrap');

  const adapter = new FastifyAdapter({
    genReqId: generateRequestId,
    trustProxy: true,
    bodyLimit: 6 * 1024 * 1024, // slightly above MAX_ASSET_SIZE_BYTES to allow local-upload
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
      redact: { paths: REDACTED_HEADERS.map((h) => `req.headers.${h}`), censor: '[REDACTED]' },
    },
  });

  adapter
    .getInstance()
    .addContentTypeParser(UPLOAD_CONTENT_TYPES, { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );

  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
      bufferLogs: true,
    });
  } catch (error) {
    if (error instanceof InvalidEnvironmentConfigurationError) {
      logger.error(error.message);
      for (const issue of error.issues) logger.error(`  - ${issue}`);
      process.exit(1);
    }
    throw error;
  }

  const config = app.get(AppConfigService);

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: config.appProfile === 'cloud',
  });

  await app.register(fastifyCors, {
    origin: config.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(fastifyRateLimit, {
    global: false,
  });

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  if (config.appProfile === 'local') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Pamagochi API (local)')
      .setDescription('Local-profile API documentation. Never enabled in the cloud build.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.log(`Pamagochi API listening on port ${config.port} [profile=${config.appProfile}]`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during bootstrap', error);
  process.exit(1);
});
