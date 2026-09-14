import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JobsWorkerModule } from './jobs/jobs-worker.module';
import { ProcessRegistryService } from './common/services/process-registry.service';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');

  // createApplicationContext boots dedicated JobsWorkerModule (BullMQ jobs processor, DB, FFmpeg, etc.)
  // WITHOUT starting an HTTP server or binding to a port.
  const app = await NestFactory.createApplicationContext(JobsWorkerModule);
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
