import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { YouTubeWorkerModule } from './youtube/youtube-worker.module';
import { ProcessRegistryService } from './common/services/process-registry.service';

async function bootstrapYouTubeWorker() {
  const logger = new Logger('YouTubeWorkerBootstrap');

  const app = await NestFactory.createApplicationContext(YouTubeWorkerModule);
  app.enableShutdownHooks();

  const processRegistry = app.get(ProcessRegistryService);

  const shutdown = async (signal: string) => {
    logger.log(
      `Received ${signal}, shutting down YouTube worker gracefully...`,
    );
    await processRegistry.killAll();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log(
    'YouTube worker process started — listening for YouTube publishing jobs.',
  );
}

bootstrapYouTubeWorker();
