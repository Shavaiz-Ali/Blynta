import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { workerConcurrency } from '../jobs/jobs.constants';
import { Model } from 'mongoose';
import { Job } from 'bullmq';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { MediaInspectionService } from '../media/services/media-inspection.service';
import { R2Service } from '../storage/r2.service';
import { TranscriptionService } from '../media/services/transcription.service';
import { ProcessRegistryService } from '../common/services/process-registry.service';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';
import type { StudioAsset, StudioRender } from './studio.schemas';
import { renderPlan, RenderInput } from './studio.renderer';

@Processor('studio', {
  concurrency: 1,
  autorun: false,
  lockDuration: 60000,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class StudioProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private logger = new Logger(StudioProcessor.name);
  constructor(
    @InjectModel('StudioAsset') private assets: Model<StudioAsset>,
    @InjectModel('StudioRender') private renders: Model<StudioRender>,
    private r2: R2Service,
    private transcription: TranscriptionService,
    private registry: ProcessRegistryService,
    private inspection: MediaInspectionService,
    private config: ConfigService,
  ) {
    super();
  }
  onApplicationBootstrap() {
    this.worker.concurrency = workerConcurrency(
      this.config.get('STUDIO_CONCURRENCY'),
      'STUDIO_CONCURRENCY',
    );
    this.worker.on('error', (error) => this.logger.error(error));
    void this.worker.run().catch((error) => this.logger.error(error));
  }
  async process(
    job: Job<{
      userId: string;
      projectId: string;
      assetId: string;
      renderId: string;
    }>,
  ) {
    const directory = await mkdtemp(join(tmpdir(), 'blynta-studio-'));
    try {
      if (job.name === 'render') await this.render(job, directory);
      else await this.media(job, directory);
    } catch (error) {
      this.logger.error(
        `Studio ${job.name} job ${job.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      const final = job.attemptsMade + 1 >= (job.opts.attempts || 1);
      if (job.name === 'render')
        await this.renders.updateOne(
          { _id: job.data.renderId },
          {
            $set: {
              status: final ? 'failed' : 'queued',
              error: final
                ? 'Video rendering failed. Check that media is available and try again.'
                : undefined,
            },
          },
        );
      else if (job.name === 'metadata')
        await this.assets.updateOne(
          {
            userId: job.data.userId,
            projectId: job.data.projectId,
            assetId: job.data.assetId,
          },
          {
            $set: {
              status: final ? 'failed' : 'processing',
              error: final
                ? 'Media could not be processed. Upload a supported file.'
                : undefined,
            },
          },
        );
      else
        await this.assets.updateOne(
          {
            userId: job.data.userId,
            projectId: job.data.projectId,
            assetId: job.data.assetId,
          },
          {
            $set: {
              transcriptStatus: final ? 'failed' : 'queued',
              error: final
                ? 'Transcription failed. Try Add captions again.'
                : undefined,
            },
          },
        );
      throw error;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  private async media(
    job: Job<{ userId: string; projectId: string; assetId: string }>,
    directory: string,
  ) {
    const a = await this.assets.findOne({
      userId: job.data.userId,
      projectId: job.data.projectId,
      assetId: job.data.assetId,
    });
    if (!a) throw new Error('Asset not found');
    const input = join(directory, 'input');
    await this.r2.downloadToLocal(a.storageKey, input);
    if (job.name === 'transcribe') {
      if (a.transcript?.length) return;
      await this.assets.updateOne(
        { _id: a._id },
        { $set: { transcriptStatus: 'processing' } },
      );
      const audio = join(directory, 'audio.wav');
      await runCommandWithProgress(
        'ffmpeg',
        ['-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', audio],
        () => {},
        this.registry,
      );
      const transcript = await this.transcription.transcribe(audio, (value) => {
        void job
          .updateProgress(value)
          .catch(() =>
            this.logger.warn(
              `Could not update transcription progress for ${job.id}`,
            ),
          );
      });
      await this.assets.updateOne(
        { _id: a._id },
        {
          $set: { transcript, transcriptStatus: 'completed' },
          $unset: { error: '' },
        },
      );
      return;
    }
    const metadata = await this.inspection.inspect(input);
    const video = metadata.hasVideo ? metadata : undefined;
    const hasAudio = metadata.hasAudio;
    if ((a.kind === 'audio' && !hasAudio) || (a.kind !== 'audio' && !video))
      throw new Error('Media type mismatch');
    const duration = a.kind === 'image' ? 5 : metadata.durationSeconds;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 14400)
      throw new Error('Unsupported media duration');
    let thumbnailKey: string | undefined;
    if (video) {
      const thumb = join(directory, 'thumbnail.png');
      await runCommandWithProgress(
        'ffmpeg',
        ['-y', '-i', input, '-frames:v', '1', '-vf', 'scale=320:-1', thumb],
        () => {},
        this.registry,
      );
      const { readFile } = await import('fs/promises');
      thumbnailKey = `studio/${a.userId}/${a.projectId}/thumbnails/${a.assetId}.png`;
      await this.r2.uploadBuffer(
        await readFile(thumb),
        thumbnailKey,
        'image/png',
      );
    }
    await this.assets.updateOne(
      { _id: a._id },
      {
        $set: {
          status: 'ready',
          duration,
          width: video?.width,
          height: video?.height,
          hasAudio,
          thumbnailKey,
        },
        $unset: { error: '' },
      },
    );
  }
  private async render(job: Job<{ renderId: string }>, directory: string) {
    const r = await this.renders.findById(job.data.renderId);
    if (!r || r.status === 'completed') return;
    await this.renders.updateOne(
      { _id: r._id },
      { $set: { status: 'processing', progress: 1 }, $unset: { error: '' } },
    );
    const inputs = new Map<string, RenderInput>();
    for (const c of r.document.clips) {
      if (c.kind === 'text' || inputs.has(c.assetId)) continue;
      const a = await this.assets.findOne({
        userId: r.userId,
        projectId: r.projectId,
        assetId: c.assetId,
        status: 'ready',
      });
      if (!a) throw new Error('Render asset not available');
      const path = join(directory, `asset-${inputs.size}`);
      await this.r2.downloadToLocal(a.storageKey, path);
      const probe = await this.inspection.inspect(path);
      inputs.set(c.assetId, {
        path,
        hasAudio: probe.hasAudio,
      });
    }
    const plan = renderPlan(r.document, r.settings, inputs);
    // The shared command runner has no cwd parameter; use absolute paths for all generated files.
    await writeFile(
      join(directory, 'filters.txt'),
      plan.filters.replace(
        /textfile=(text-\d+\.txt)/g,
        (_, name: string) =>
          `textfile='${join(directory, name).replace(/\\/g, '/').replace(/:/g, '\\:')}'`,
      ),
    );
    for (const file of plan.textFiles)
      await writeFile(join(directory, file.name), file.text);
    const args = plan.args.map((arg) =>
      ['filters.txt', 'output.mp4'].includes(arg) ? join(directory, arg) : arg,
    );
    let lastProgress = 0;
    let progressWrite = Promise.resolve();
    let progressError: unknown;
    await runCommandWithProgress(
      'ffmpeg',
      args,
      (line) => {
        if (!line.startsWith('out_time_us=')) return;
        const progress = Math.min(
          95,
          Math.max(
            1,
            Math.round((Number(line.split('=')[1]) / 1e6 / plan.duration) * 95),
          ),
        );
        if (progress <= lastProgress) return;
        lastProgress = progress;
        progressWrite = progressWrite
          .then(async () => {
            await job.updateProgress(progress);
            await this.renders.updateOne(
              { _id: r._id },
              { $set: { progress } },
            );
          })
          .catch((error: unknown) => {
            progressError = error;
          });
      },
      this.registry,
    );
    await progressWrite;
    if (progressError)
      throw progressError instanceof Error
        ? progressError
        : new Error('Could not persist render progress');
    const outputKey = `studio/${r.userId}/${r.projectId}/renders/${String(r._id)}.mp4`;
    await this.r2.uploadFile(join(directory, 'output.mp4'), outputKey);
    await this.renders.updateOne(
      { _id: r._id },
      {
        $set: {
          status: 'completed',
          progress: 100,
          outputKey,
          completedAt: new Date(),
        },
      },
    );
  }
}
