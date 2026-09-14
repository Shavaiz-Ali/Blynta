import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MailWorkerModule } from './mail-worker.module';
import { ProcessRegistryService } from '../common/services/process-registry.service';

async function bootstrapMailWorker() {
  const logger = new Logger('MailWorkerBootstrap');

  // Bootstraps dedicated MailWorkerModule (BullMQ mail processor, Redis connection, config)
  // without starting an HTTP web server or listening on a port.
  const app = await NestFactory.createApplicationContext(MailWorkerModule);
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down mail worker gracefully...`);
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log('Mail worker started — listening for jobs on the "mail" queue.');
}

bootstrapMailWorker();
