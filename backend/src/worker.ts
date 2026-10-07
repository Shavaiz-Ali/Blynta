import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JobsWorkerModule } from './jobs/jobs-worker.module';
import { ProcessRegistryService } from './common/services/process-registry.service';
import { ConfigModule } from '@nestjs/config';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');

  // createApplicationContext boots dedicated JobsWorkerModule (BullMQ jobs processor, DB, FFmpeg, etc.)
  // WITHOUT starting an HTTP server or binding to a port.
  await ConfigModule.envVariablesLoaded;
  const role = process.env.MEDIA_WORKER_ROLE ?? 'all';
  const app = await NestFactory.createApplicationContext(
    JobsWorkerModule.forRole(role),
  );
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker gracefully...`);
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  logger.log(`Worker process started (MEDIA_WORKER_ROLE=${role}).`);
}

void bootstrapWorker();
