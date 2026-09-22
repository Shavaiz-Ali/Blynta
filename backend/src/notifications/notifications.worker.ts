import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NotificationsWorkerModule } from './notifications-worker.module';
import { ProcessRegistryService } from '../common/services/process-registry.service';

async function bootstrapNotificationsWorker() {
  const logger = new Logger('NotificationsWorkerBootstrap');

  // Bootstraps dedicated NotificationsWorkerModule (BullMQ notification processor, DB connection, config)
  // without starting an HTTP web server or listening on a port.
  const app = await NestFactory.createApplicationContext(
    NotificationsWorkerModule,
  );
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(
      `Received ${signal}, shutting down notifications worker gracefully...`,
    );
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log(
    'Notifications worker started — listening for jobs on the notifications queue.',
  );
}

bootstrapNotificationsWorker();
