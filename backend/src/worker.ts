import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ProcessRegistryService } from './common/services/process-registry.service';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');

  // createApplicationContext boots Nest's DI container, config, Mongoose connection,
  // BullMQ processors, and schedule crons WITHOUT starting an HTTP server or binding to a port.
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker gracefully...`);
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log('Worker process started — listening for jobs on the queue.');
}

bootstrapWorker();
