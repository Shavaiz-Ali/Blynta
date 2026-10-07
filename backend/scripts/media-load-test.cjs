/* Local-only fixture test: real Mongo/BullMQ/FFmpeg, disk-backed R2 and fixture AI. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile, fork } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const exec = promisify(execFile);
const { Queue, Worker } = require('bullmq');
const mongoose = require('mongoose');
const { ConfigService } = require('@nestjs/config');
const { Logger } = require('@nestjs/common');
Logger.overrideLogger(['error', 'warn']);
const compiled = path.resolve(__dirname, '../dist/src');
process.env.NODE_PATH = path.dirname(compiled);
require('node:module').Module._initPaths();
const { JobsService } = require(path.join(compiled, 'jobs/jobs.service'));
const { JobsProcessor } = require(path.join(compiled, 'jobs/jobs.processor'));
const { RenderProcessor } = require(
  path.join(compiled, 'jobs/render.processor'),
);
const { RenderSourceService } = require(
  path.join(compiled, 'jobs/render-source.service'),
);
const { JobsCompletionService } = require(
  path.join(compiled, 'jobs/jobs-completion.service'),
);
const { JobSchema, SourcePlatform, JobStatus } = require(
  path.join(compiled, 'jobs/schemas/job.schema'),
);
const { JOBS_QUEUE, RENDER_QUEUE, renderJobId } = require(
  path.join(compiled, 'jobs/jobs.constants'),
);
const { ProcessRegistryService } = require(
  path.join(compiled, 'common/services/process-registry.service'),
);
const { MediaInspectionService } = require(
  path.join(compiled, 'media/services/media-inspection.service'),
);
const { ClipCuttingService } = require(
  path.join(compiled, 'media/services/clip-cutting.service'),
);
const { CaptionBurningService } = require(
  path.join(compiled, 'media/services/caption-burning.service'),
);
const { runCommandWithProgress } = require(
  path.join(compiled, 'media/utils/run-command-with-progress'),
);
const { MailService } = require(path.join(compiled, 'mail/mail.service'));

function cpuCounters() {
  return os.cpus().reduce(
    (sum, cpu) => ({
      idle: sum.idle + cpu.times.idle,
      total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
    }),
    { idle: 0, total: 0 },
  );
}
async function adapters(options) {
  // Deliberately ignore .env: never connect this fixture harness to production.
  const connection = {
    host: '127.0.0.1',
    port: options.redisPort,
    connectTimeout: 2000,
    maxRetriesPerRequest: null,
  };
  const db = await mongoose
    .createConnection(
      `mongodb://127.0.0.1:${options.mongoPort}/${options.database}`,
      { serverSelectionTimeoutMS: 2000 },
    )
    .asPromise();
  const model = db.model('Job', JobSchema);
  const pipeline = new Queue(JOBS_QUEUE, {
    connection,
    prefix: options.prefix,
  });
  const render = new Queue(RENDER_QUEUE, {
    connection,
    prefix: options.prefix,
  });
  const mail = new Queue('mail', { connection, prefix: options.prefix });
  const config = new ConfigService({
    STORAGE_ROOT: options.root,
    PIPELINE_CONCURRENCY: options.pipelineConcurrency,
    RENDER_CONCURRENCY: options.renderConcurrency,
  });
  const registry = new ProcessRegistryService();
  const inspect = new MediaInspectionService(registry);
  const objectPath = (key) => path.join(options.root, 'objects', key);
  const r2 = {
    async uploadFile(input, key) {
      const target = objectPath(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(input, target);
      return key;
    },
    async downloadToLocal(key, target) {
      await fs.copyFile(objectPath(key), target);
    },
    async fileExists(key) {
      return fs.access(objectPath(key)).then(
        () => true,
        () => false,
      );
    },
  };
  const sideEffects = new Set();
  const createOnce = (input) => {
    sideEffects.add(input.dedupeKey);
    return Promise.resolve();
  };
  let charges = 0;
  const users = {
    findById: () =>
      Promise.resolve({ plan: 'free', email: 'fixture@example.test' }),
    deductCredit: () => {
      charges++;
      return Promise.resolve();
    },
  };
  const activities = {
    queueCreate: () => Promise.resolve(),
    queueCreateIfNotExists: createOnce,
  };
  const jobs = new JobsService(
    model,
    pipeline,
    render,
    users,
    config,
    r2,
    activities,
  );
  const completion = new JobsCompletionService(
    jobs,
    users,
    { queueCreateIfNotExists: createOnce },
    new MailService(mail),
    activities,
  );
  const sources = new RenderSourceService(config, r2);
  const cutting = new ClipCuttingService(registry);
  const captions = new CaptionBurningService(registry);
  const renderer = new RenderProcessor(
    jobs,
    completion,
    config,
    cutting,
    captions,
    r2,
    sources,
  );
  return {
    connection,
    db,
    model,
    pipeline,
    render,
    mail,
    config,
    registry,
    inspect,
    r2,
    jobs,
    completion,
    sources,
    renderer,
    cutting,
    users,
    activities,
    sideEffects,
    charges: () => charges,
    async close(drop = false) {
      await registry.killAll();
      await sources.onModuleDestroy();
      if (drop) {
        await pipeline.obliterate({ force: true });
        await render.obliterate({ force: true });
        await mail.obliterate({ force: true });
        await db.dropDatabase();
      }
      await Promise.all([
        pipeline.close(),
        render.close(),
        mail.close(),
        db.close(),
      ]);
    },
  };
}
function attachProcessor(processor, worker) {
  processor._worker = worker;
  worker.on('failed', (job, error) => {
    void processor.onFailed(job, error);
  });
  processor.onApplicationBootstrap();
}
async function childWorker(options) {
  const a = await adapters(options);
  const worker = new Worker(RENDER_QUEUE, (job) => a.renderer.process(job), {
    connection: a.connection,
    prefix: options.prefix,
    autorun: false,
    lockDuration: 3000,
    stalledInterval: 1000,
    maxStalledCount: 1,
  });
  let sent = false;
  worker.on('progress', (job, progress) => {
    if (
      !sent &&
      progress.status === 'cutting' &&
      progress.processedSeconds > 0
    ) {
      sent = true;
      process.send({ event: 'ffmpeg-active', clipId: job.data.clipId });
    }
  });
  attachProcessor(a.renderer, worker);
}
async function runCase(options, fixture) {
  const a = await adapters(options);
  const transcript = Array.from({ length: 6 }, (_, i) => ({
    startTime: i * 10,
    endTime: (i + 1) * 10,
    text: `Fixture clip ${i + 1}`,
  }));
  const highlights = transcript.map((s) => ({
    ...s,
    reason: 'fixture',
    score: 0.9,
    clipTitle: s.text,
    clipDescription: '',
    tags: [],
    style: 'default',
    hookText: '',
    emojis: [],
  }));
  const download = {
    async downloadVideo(_url, directory) {
      const videoPath = path.join(directory, 'source.mp4'),
        audioPath = path.join(directory, 'audio.wav');
      await fs.copyFile(fixture, videoPath);
      await runCommandWithProgress(
        'ffmpeg',
        ['-y', '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1', audioPath],
        () => {},
        a.registry,
      );
      return {
        videoPath,
        audioPath,
        title: 'fixture',
        uploader: '',
        thumbnailUrl: '',
        duration: 60,
      };
    },
  };
  const pipelineProcessor = new JobsProcessor(
    a.jobs,
    a.users,
    a.config,
    download,
    { transcribe: () => Promise.resolve(transcript) },
    { detectHighlightsWithMetadata: () => Promise.resolve({ highlights }) },
    { extractExternalId: () => null },
    a.r2,
    a.inspect,
    a.completion,
    a.activities,
  );
  const counts = new Map();
  let runningPipeline = 0,
    runningRender = 0,
    maxPipeline = 0,
    maxRender = 0,
    progressEvents = 0;
  const pipelineWaits = [],
    renderWaits = [],
    speeds = [],
    renderOrder = [],
    pipelineOrder = [];
  let rendered = 0,
    pipelineFinished = 0,
    failedOnce = false;
  const originalCut = a.cutting.cutClip.bind(a.cutting);
  a.cutting.cutClip = (...args) => {
    if (options.failOnce && !failedOnce) {
      failedOnce = true;
      return Promise.reject(new Error('forced fixture retry'));
    }
    return originalCut(...args);
  };
  const pipelineWorker = new Worker(
    JOBS_QUEUE,
    async (job) => {
      runningPipeline++;
      maxPipeline = Math.max(maxPipeline, runningPipeline);
      pipelineWaits.push(Date.now() - job.timestamp);
      pipelineOrder.push(job.data.jobId);
      counts.set(job.data.jobId, (counts.get(job.data.jobId) ?? 0) + 1);
      try {
        await pipelineProcessor.process(job);
        pipelineFinished++;
      } finally {
        runningPipeline--;
      }
    },
    { connection: a.connection, prefix: options.prefix, autorun: false },
  );
  let renderWorker;
  let child;
  const startRender = () => {
    renderWorker = new Worker(
      RENDER_QUEUE,
      async (job) => {
        runningRender++;
        maxRender = Math.max(maxRender, runningRender);
        renderWaits.push(Date.now() - job.timestamp);
        renderOrder.push(job.data.jobId);
        try {
          await a.renderer.process(job);
          rendered++;
        } finally {
          runningRender--;
        }
      },
      {
        connection: a.connection,
        prefix: options.prefix,
        autorun: false,
        lockDuration: 3000,
        stalledInterval: 1000,
        maxStalledCount: 1,
      },
    );
    renderWorker.on('progress', (_job, p) => {
      if (p.processedSeconds > 0) progressEvents++;
      if (p.speed > 0) speeds.push(p.speed);
    });
    attachProcessor(a.renderer, renderWorker);
  };
  let samples = [];
  let priorCpu = cpuCounters();
  const timer = setInterval(() => {
    const current = cpuCounters();
    samples.push({
      cpu:
        100 *
        (1 -
          (current.idle - priorCpu.idle) /
            Math.max(1, current.total - priorCpu.total)),
      systemUsedRamBytes: os.totalmem() - os.freemem(),
      nodeRssBytes: process.memoryUsage().rss,
    });
    priorCpu = current;
  }, 500);
  const started = Date.now();
  try {
    const owner = new mongoose.Types.ObjectId().toString();
    const submitted = [];
    for (let i = 0; i < 3; i++)
      submitted.push(
        await a.jobs.createJob(owner, {
          sourceUrl: 'https://fixture.invalid/video',
          sourcePlatform: SourcePlatform.UPLOAD,
          stylePreset: 'default',
        }),
      );
    attachProcessor(pipelineProcessor, pipelineWorker);
    if (options.crash) {
      child = fork(__filename, ['--child', JSON.stringify(options)], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('No live child FFmpeg progress within 60s')),
          60000,
        );
        child.once('error', reject);
        child.on('message', (message) => {
          if (message.event === 'ffmpeg-active') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      if (process.platform === 'win32')
        await exec('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
        });
      else {
        child.kill('SIGKILL');
      }
      startRender();
    } else startRender();
    let terminal;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await a.jobs.reconcileMediaJobs();
      terminal = await a.model.find().exec();
      if (
        terminal.length === 3 &&
        terminal.every((j) =>
          [JobStatus.COMPLETED, JobStatus.FAILED].includes(j.status),
        )
      )
        break;
      if (Date.now() - started > 10 * 60 * 1000)
        throw new Error('Fixture test timed out');
    }
    for (const job of terminal) await a.completion.publish(job._id.toString());
    await pipelineWorker.close();
    await renderWorker.close();
    assert(
      terminal.every((j) => j.status === JobStatus.COMPLETED),
      'All fixture parents must succeed',
    );
    assert(
      terminal.every(
        (j) =>
          j.clips.length === 6 &&
          new Set(j.clips.map((c) => c._id.toString())).size === 6,
      ),
    );
    assert.equal(a.charges(), 3, 'Retries must not charge another credit');
    assert.equal(
      await a.render.getJobCountByTypes(),
      18,
      'Exactly one render job per clip',
    );
    assert.equal(
      [...counts.values()].reduce((n, v) => n + v, 0),
      3,
      'Clip failure must not rerun a pipeline',
    );
    assert(maxPipeline <= options.pipelineConcurrency);
    assert(maxRender <= options.renderConcurrency);
    if (!options.crash)
      assert(progressEvents > 0, 'FFmpeg must publish real processed time');
    for (const job of terminal) {
      const id = job._id.toString();
      for (const clip of job.clips)
        assert(
          await a.render.getJob(renderJobId(id, clip._id.toString())),
          'Every persisted clip must have its deterministic queue job',
        );
      await a.jobs.enqueueRenders(id);
      await a.completion.finalize(id);
      await a.completion.publish(id);
      assert.equal(new Set(job.clips.map((c) => c.r2ObjectKey)).size, 6);
      const snapshot = await a.jobs.getRenderSnapshot(job);
      assert.equal(snapshot.ready, 6);
      assert.equal(snapshot.progressPercent, 100);
    }
    assert.equal(await a.render.getJobCountByTypes(), 18);
    assert.equal(
      await a.mail.getJobCountByTypes(),
      3,
      'Completion email jobs must deduplicate',
    );
    const childJobs = await a.render.getJobs(['completed']);
    if (options.failOnce)
      assert(
        childJobs.some((j) => j.attemptsMade > 1),
        'One render must retry',
      );
    if (options.crash)
      assert(
        childJobs.some((j) => j.stalledCounter > 0),
        'A killed worker must be reclaimed',
      );
    if (options.pipelineConcurrency > 1)
      assert(maxPipeline > 1, 'Videos must overlap');
    if (options.renderConcurrency > 1)
      assert(maxRender > 1, 'Clips must overlap');
    if (
      !options.crash &&
      options.pipelineConcurrency > 1 &&
      options.renderConcurrency > 1
    ) {
      const firstVideo = renderOrder[0];
      const firstOther = renderOrder.findIndex((id) => id !== firstVideo);
      assert(
        firstOther >= 0 && firstOther < 6,
        'Another video must start rendering before the first video exhausts its six clips',
      );
    }
    const mean = (items) =>
      items.length ? items.reduce((n, v) => n + v, 0) / items.length : null;
    const result = {
      pipelineConcurrency: options.pipelineConcurrency,
      renderConcurrency: options.renderConcurrency,
      elapsedMs: Date.now() - started,
      pipelinePerMinute: (pipelineFinished * 60000) / (Date.now() - started),
      renderPerMinute: (rendered * 60000) / (Date.now() - started),
      maxPipeline,
      maxRender,
      progressEvents,
      pipelineQueueWaitMeanMs: mean(pipelineWaits),
      renderQueueWaitMeanMs: mean(renderWaits),
      ffmpegSampleSpeedMean: mean(speeds),
      systemCpuPercentMean: mean(samples.map((s) => s.cpu)),
      systemUsedRamPeakBytes: Math.max(
        ...samples.map((s) => s.systemUsedRamBytes),
      ),
      nodeRssPeakBytes: Math.max(...samples.map((s) => s.nodeRssBytes)),
      pipelineOrder,
      renderOrder,
      crashReclaimed: !!options.crash,
      forcedRenderRetry: !!options.failOnce,
      note: 'Fixture AI/disk storage. System CPU/RAM include other apps; Node RSS excludes FFmpeg child RAM.',
    };
    console.log(JSON.stringify(result));
    return result;
  } finally {
    clearInterval(timer);
    if (child && child.exitCode === null) child.kill();
    await Promise.all([pipelineWorker.close(), renderWorker?.close()]);
    await a.close(true);
  }
}
async function main() {
  if (process.argv[2] === '--child')
    return childWorker(JSON.parse(process.argv[3]));
  // Fail before generating fixtures or connecting when media tools are missing.
  await exec('ffmpeg', ['-version'], { windowsHide: true });
  await exec('ffprobe', ['-version'], { windowsHide: true });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blynta-media-load-'));
  const fixture = path.join(root, 'fixture.mp4');
  const results = [];
  try {
    await exec(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=640x360:rate=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=16000',
        '-t',
        '60',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        fixture,
      ],
      { windowsHide: true },
    );
    const cases = process.argv.includes('--matrix')
      ? [
          [1, 1],
          [1, 2],
          [2, 1],
          [2, 2],
          [3, 1],
          [3, 2],
        ]
      : [[2, 2]];
    for (const [pipelineConcurrency, renderConcurrency] of cases) {
      const id = randomUUID().replaceAll('-', '');
      const options = {
        root: path.join(root, id),
        prefix: `blynta-media-test-${id}`,
        database: `blynta_media_test_${id}`,
        redisPort: Number(process.env.MEDIA_TEST_REDIS_PORT ?? 6379),
        mongoPort: Number(process.env.MEDIA_TEST_MONGO_PORT ?? 27017),
        pipelineConcurrency,
        renderConcurrency,
        failOnce: process.argv.includes('--retry'),
        crash: process.argv.includes('--crash'),
      };
      results.push(await runCase(options, fixture));
    }
    const output = path.resolve('media-load-results.json');
    await fs.writeFile(
      output,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), results },
        null,
        2,
      ),
    );
    console.log(`Results: ${output}`);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith('blynta-media-load-'));
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(`Local media test unavailable/failed: ${error.message}`);
  process.exitCode = 1;
});
