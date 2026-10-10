import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JobsWorkerModule } from './jobs/jobs-worker.module';
import { ProcessRegistryService } from './common/services/process-registry.service';
import { ConfigModule } from '@nestjs/config';
import { JobsProcessor } from './jobs/jobs.processor';
import { RenderProcessor } from './jobs/render.processor';
import { StudioProcessor } from './studio/studio.processor';
import { EditRenderProcessor } from './ai-editor/edit-render.processor';
import { Worker } from 'bullmq';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');

  // createApplicationContext boots dedicated JobsWorkerModule (BullMQ jobs processor, DB, FFmpeg, etc.)
  // WITHOUT starting an HTTP server or binding to a port.
  await ConfigModule.envVariablesLoaded;
  const role = process.env.MEDIA_WORKER_ROLE ?? 'all';
  const app = await NestFactory.createApplicationContext(
    JobsWorkerModule.forRole(role),
  );
  const processRegistry = app.get(ProcessRegistryService);
  const workers: Worker[] = [];
  for (const processor of [
    JobsProcessor,
    RenderProcessor,
    StudioProcessor,
    EditRenderProcessor,
  ]) {
    try {
      workers.push(app.get(processor).worker);
    } catch {
      /* role excludes this processor */
    }
  }
  let stopping = false;

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.log(`Received ${signal}, shutting down worker gracefully...`);
    processRegistry.beginShutdown();
    // Stop fetching/renewing locks immediately. Interrupted jobs remain durable
    // and are recovered by BullMQ's stalled checker, without consuming a retry.
    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    await Promise.all(workers.map((worker) => worker.close(true)));
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

void bootstrapWorker().catch((error) => {
  new Logger('WorkerBootstrap').error(error);
  process.exit(1);
});
