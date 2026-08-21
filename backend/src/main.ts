import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ProcessRegistryService } from './common/services/process-registry.service';
import * as dns from 'dns';
import * as express from 'express';
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // We disable Nest's automatic body parser globally because we need the
  // Stripe webhook endpoint to receive the ORIGINAL raw request body for
  // signature verification (Stripe's HMAC check fails if JSON parser has
  // already re-serialized the body). We instead apply body parsers
  // selectively ourselves on the underlying Express app.
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    rawBody: true,
  });
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const adapter = app.getHttpAdapter();
  const instance = adapter.getInstance();

  // 1) For the Stripe webhook ONLY — parse body as RAW Buffer, and let
  // Nest's rawBody flag + @nestjs/platform-express attach `req.rawBody`.
  instance.use(
    '/billing/webhook',
    express.raw({ type: 'application/json' }),
  );

  // 2) For EVERYTHING ELSE — standard JSON body parser (the default Nest
  // behavior we disabled above).
  instance.use(
    '/',
    (req: any, res: any, next: any) => {
      if (req.path.startsWith('/billing/webhook')) return next();
      return express.json({ limit: '10mb' })(req, res, next);
    },
  );
  instance.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

  app.enableCors({
    origin: [frontendOrigin, 'http://127.0.0.1:3000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ZodValidationPipe(),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 5001;
  await app.listen(port);
}
bootstrap();
