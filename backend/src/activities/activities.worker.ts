import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ActivitiesWorkerModule } from './activities-worker.module';
import { ProcessRegistryService } from '../common/services/process-registry.service';

async function bootstrapActivitiesWorker() {
  const logger = new Logger('ActivitiesWorkerBootstrap');

  // Bootstraps dedicated ActivitiesWorkerModule (BullMQ activity processor, DB connection, config)
  // without starting an HTTP web server or listening on a port.
  const app = await NestFactory.createApplicationContext(
    ActivitiesWorkerModule,
  );
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(
      `Received ${signal}, shutting down activities worker gracefully...`,
    );
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log(
    'Activities worker started — listening for jobs on the activities queue.',
  );
}

bootstrapActivitiesWorker();
