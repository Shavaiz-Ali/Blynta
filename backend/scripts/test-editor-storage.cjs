// Independent real Redis, AWS SDK streaming storage and production media
// orchestration verification. No Mongo or API persistence success is implied.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn, execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { createHash, randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { Queue, Worker, QueueEvents } = require('bullmq');
const { signedGet, freePort, eventually } = require('./test-editor-flow.cjs');
const load = (name) => require('../dist/src/' + name);
const { R2Service } = load('storage/r2.service');
const { EditPlanValidatorService } = load(
  'ai-editor/edit-plan-validator.service',
);
const { EditRenderService } = load('ai-editor/edit-render.service');
const { MediaInspectionService } = load(
  'media/services/media-inspection.service',
);
const { ProcessRegistryService } = load(
  'common/services/process-registry.service',
);
const { mediaExecution, drainMediaChildren } = load(
  'jobs/cancellation-context',
);
const { parseEdit, planSchema } = load('ai-editor/edit-plan.contract');
const exec = promisify(execFile);
const hash = (input) => createHash('sha256').update(input).digest('hex');
async function main() {
  for (const name of [
    'EDIT_FFMPEG_PATH',
    'EDIT_FFPROBE_PATH',
    'EDIT_TEST_REDIS',
  ])
    assert.ok(fs.existsSync(process.env[name] || ''), name + ' required');
  process.env.PATH = [
    path.dirname(process.env.EDIT_FFMPEG_PATH),
    path.dirname(process.env.EDIT_FFPROBE_PATH),
    process.env.PATH,
  ].join(path.delimiter);
  process.env.FFMPEG_THREADS = '1';
  process.env.MEDIA_HOST_CONCURRENCY = '1';
  const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "blynta-editor's-storage-"),
    ),
    objects = new Map();
  let server,
    redisProcess,
    queue,
    worker,
    events,
    sample,
    nativePeak = 0;
  let sampling = false,
    failureCount = 0;
  const prefix = 'editor-storage-' + randomUUID();
  const registry = new ProcessRegistryService();
  try {
    const redisPort = await freePort();
    redisProcess = spawn(
      process.env.EDIT_TEST_REDIS,
      [
        '--port',
        String(redisPort),
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        root,
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    redisProcess.on('error', (e) =>
      console.error('Redis test startup:', e.name),
    );
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://' + req.headers.host);
        if (
          !req.headers.authorization?.includes('Credential=editor-test/') &&
          !(req.method === 'GET' && signedGet(url, req.headers.host))
        ) {
          res.writeHead(403).end();
          return;
        }
        const key = decodeURIComponent(url.pathname),
          file = path.join(root, 'object-' + hash(key));
        if (req.method === 'PUT') {
          if (failureCount > 0 && key.includes('/edits/')) {
            failureCount--;
            req.resume();
            res
              .writeHead(503, { 'Content-Type': 'application/xml' })
              .end('<Error><Code>ServiceUnavailable</Code></Error>');
            return;
          }
          await pipeline(req, fs.createWriteStream(file));
          const h = createHash('sha256');
          for await (const chunk of fs.createReadStream(file)) h.update(chunk);
          const etag = '"' + h.digest('hex') + '"';
          objects.set(key, {
            file,
            etag,
            size: (await fsp.stat(file)).size,
            type: req.headers['content-type'],
          });
          res.writeHead(200, { ETag: etag }).end();
          return;
        }
        if (req.method === 'DELETE') {
          await fsp.rm(file, { force: true });
          objects.delete(key);
          res.writeHead(204).end();
          return;
        }
        const object = objects.get(key);
        if (!object) {
          res.writeHead(404).end();
          return;
        }
        if (
          req.headers['if-match'] &&
          req.headers['if-match'] !== object.etag
        ) {
          res.writeHead(412).end();
          return;
        }
        res.writeHead(200, {
          'Content-Length': object.size,
          'Content-Type': object.type,
          ETag: object.etag,
        });
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(file).pipe(res);
      } catch {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const config = new ConfigService({
      R2_ENDPOINT: 'http://127.0.0.1:' + server.address().port,
      R2_ACCESS_KEY_ID: 'editor-test',
      R2_SECRET_ACCESS_KEY: 'editor-test-secret',
      R2_BUCKET_NAME: 'public-test',
      R2_SOURCE_BUCKET_NAME: 'private-test',
      R2_PUBLIC_DOMAIN: 'https://public.invalid',
    });
    const r2 = new R2Service(config),
      inspection = new MediaInspectionService(registry);
    const source = path.join(root, 'source.mp4'),
      music = path.join(root, 'music.wav'),
      png = path.join(root, 'overlay.png');
    await exec(process.env.EDIT_FFMPEG_PATH, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=640x360:rate=30:duration=3',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100:duration=3',
      '-threads',
      '1',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      source,
    ]);
    await exec(process.env.EDIT_FFMPEG_PATH, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:sample_rate=32000:duration=2',
      music,
    ]);
    await exec(process.env.EDIT_FFMPEG_PATH, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=red@0.5:s=32x256,format=rgba',
      '-frames:v',
      '1',
      png,
    ]);
    const sourceKey = 'job-sources/test/source.mp4';
    await r2.uploadFile(source, sourceKey);
    const sourceInfo = await r2.objectInfo(sourceKey),
      originalHash = hash(await fsp.readFile(source));
    const records = [];
    for (const [assetId, file, mimeType, kind] of [
      ['music', music, 'audio/wav', 'audio'],
      ['image', png, 'image/png', 'image'],
    ]) {
      const storageKey = 'job-sources/studio-assets/test/' + assetId;
      await r2.uploadBuffer(await fsp.readFile(file), storageKey, mimeType);
      records.push({
        userId: 'owner',
        assetId,
        storageKey,
        mimeType,
        kind,
        status: 'ready',
        duration: kind === 'audio' ? 2 : 0,
        width: 32,
        height: 256,
        hasAudio: kind === 'audio',
      });
    }
    // Read-only asset repository adapter. The validator/renderer themselves are production code.
    const assets = {
      find: (query) => ({
        limit() {
          return this;
        },
        lean: async () =>
          records.filter(
            (r) =>
              r.assetId === query.assetId &&
              r.userId === query.userId &&
              r.status === query.status,
          ),
      }),
    };
    const validator = new EditPlanValidatorService(assets, r2),
      renderer = new EditRenderService(
        r2,
        inspection,
        registry,
        validator,
        config,
      );
    const plan = parseEdit(planSchema, {
      schemaVersion: 1,
      timestampSystem: 'output_seconds',
      video: {
        aspectRatio: '16:9',
        segments: [{ id: 'a', type: 'video', sourceStart: 0, sourceEnd: 3 }],
      },
      audio: {
        original: {},
        tracks: [
          {
            id: 'music',
            assetId: 'music',
            role: 'music_track',
            start: 0.2,
            sourceStart: 0,
            sourceEnd: 2,
            gain: 0.1,
            fadeIn: 0.1,
            fadeOut: 0.2,
            automation: [
              { time: 0.2, gain: 0.1 },
              { time: 1, gain: 0.3 },
            ],
          },
        ],
      },
      operations: [
        {
          id: 'zoom',
          type: 'zoom',
          start: 0,
          end: 1,
          params: { fromScale: 1, toScale: 1.3, focusX: 0.5, focusY: 0.5 },
        },
        {
          id: 'image',
          type: 'emoji_overlay',
          start: 0.2,
          end: 2,
          params: {
            assetId: 'image',
            emoji: 'test',
            x: 0.8,
            y: 0.2,
            width: 0.15,
            fadeIn: 0.1,
            fadeOut: 0.1,
          },
        },
        {
          id: 'text',
          type: 'text_overlay',
          start: 0,
          end: 3,
          params: {
            text: "100% 'quote' \\ café\nsecond line",
            fontSize: 28,
            color: '#ffffff',
            x: 0.5,
            y: 0.8,
          },
        },
      ],
    });
    const validated = await validator.validate('owner', plan, 3);
    const version = {
      userId: 'owner',
      sourceMedia: {
        storageKey: sourceKey,
        duration: 3,
        etag: sourceInfo.etag,
      },
      plan,
      assetEtags: Object.fromEntries(
        [...validated.media].map(([id, a]) => [id, a.etag]),
      ),
    };
    const connection = {
      host: '127.0.0.1',
      port: redisPort,
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
      retryStrategy: () => null,
    };
    queue = new Queue('editing-storage', { connection, prefix });
    events = new QueueEvents('editing-storage', { connection, prefix });
    console.log('Waiting for isolated Redis queue');
    await events.waitUntilReady();
    console.log('Isolated Redis ready');
    const measures = [];
    // Samples all FFmpeg processes on an otherwise idle local test host; this
    // measures native working set separately from this Node process.
    if (process.platform === 'win32')
      sample = setInterval(() => {
        if (sampling) return;
        sampling = true;
        void exec(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '(Get-Process ffmpeg -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum',
          ],
          { windowsHide: true },
        )
          .then(({ stdout }) => {
            nativePeak = Math.max(nativePeak, Number(stdout.trim()) || 0);
          })
          .finally(() => (sampling = false));
      }, 250);
    worker = new Worker(
      'editing-storage',
      async (job) => {
        const directory = await fsp.mkdtemp(path.join(root, 'render-'));
        const start = Date.now(),
          controller = new AbortController();
        try {
          const result = await mediaExecution.run(
            { signal: controller.signal, children: new Set() },
            async () => {
              try {
                return await renderer.render(version, directory, async (n) =>
                  job.updateProgress(n),
                );
              } finally {
                await drainMediaChildren();
              }
            },
          );
          const key =
            'job-sources/edits/test/' + job.id + '/' + randomUUID() + '.mp4';
          await r2.uploadFile(result.outputPath, key);
          measures.push({
            duration: result.duration,
            width: result.width,
            height: result.height,
            seconds: (Date.now() - start) / 1000,
            nodeRssMiB: Math.round(process.memoryUsage().rss / 1048576),
            outputBytes: (await fsp.stat(result.outputPath)).size,
          });
          return key;
        } finally {
          await fsp.rm(directory, { recursive: true, force: true });
        }
      },
      { connection, prefix, concurrency: 1 },
    );
    worker.on('failed', () =>
      console.log('Observed intentional Bull retry failure'),
    );
    worker.on('error', (e) =>
      console.error('Test Bull worker:', e.name, e.message),
    );
    const job = await queue.add('render', {}, { attempts: 2 });
    const key = await job.waitUntilFinished(events, 60000);
    const signed = await r2.getSignedDownloadUrl(key, 3600),
      response = await fetch(signed);
    assert.equal(response.status, 200);
    const output = path.join(root, 'downloaded.mp4');
    await pipeline(
      require('node:stream').Readable.fromWeb(response.body),
      fs.createWriteStream(output),
    );
    const probe = await inspection.inspect(output, true, 'mov');
    assert.equal(probe.width, 1280);
    assert.equal(probe.height, 720);
    assert.ok(Math.abs(probe.durationSeconds - 3) < 0.1);
    assert.ok(probe.hasAudio);
    assert.equal((await fetch(signed.split('?')[0])).status, 403);
    await assert.rejects(
      r2.downloadToLocal(sourceKey, path.join(root, 'oversized.mp4'), {
        maxBytes: 10,
      }),
    );
    await assert.rejects(
      r2.downloadToLocal(sourceKey, path.join(root, 'changed.mp4'), {
        etag: '"wrong"',
      }),
    );
    const corruptKey = 'job-sources/test/corrupt.mp4';
    await r2.uploadBuffer(
      Buffer.from('invalid media'),
      corruptKey,
      'video/mp4',
    );
    const corruptDirectory = path.join(root, 'corrupt');
    await fsp.mkdir(corruptDirectory);
    await assert.rejects(
      renderer.render(
        { ...version, sourceMedia: { storageKey: corruptKey, duration: 3 } },
        corruptDirectory,
        () => {},
      ),
      /corrupted|unsupported/,
    );
    const cancelledDirectory = path.join(root, 'cancelled');
    await fsp.mkdir(cancelledDirectory);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100);
    await assert.rejects(
      mediaExecution.run(
        { signal: controller.signal, children: new Set() },
        async () => {
          try {
            return await renderer.render(version, cancelledDirectory, () => {});
          } finally {
            await drainMediaChildren();
          }
        },
      ),
    );
    clearTimeout(timeout);
    failureCount = 1;
    const retry = await queue.add(
      'render',
      {},
      { attempts: 2, backoff: { type: 'fixed', delay: 100 } },
    );
    await retry.waitUntilFinished(events, 60000);
    assert.ok(retry.id !== job.id);
    assert.ok(
      (await queue.getJob(retry.id)).attemptsMade >= 2,
      'Bull must actually retry the failed upload',
    );
    assert.equal(
      hash(await fsp.readFile(objects.get('/private-test/' + sourceKey).file)),
      originalHash,
    );
    assert.equal(
      (await fsp.readdir(root)).filter((x) => x.startsWith('render-')).length,
      0,
    );
    if (!process.argv.includes('--quick')) {
      const benchmarkSource = path.join(root, 'benchmark.mp4');
      await exec(process.env.EDIT_FFMPEG_PATH, [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=1280x720:rate=30:duration=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=44100:duration=30',
        '-threads',
        '1',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        benchmarkSource,
      ]);
      const benchmarkKey = 'job-sources/test/benchmark.mp4';
      await r2.uploadFile(benchmarkSource, benchmarkKey);
      version.sourceMedia = {
        storageKey: benchmarkKey,
        duration: 30,
        etag: (await r2.objectInfo(benchmarkKey)).etag,
      };
      for (const resolution of ['720p', '1080p']) {
        version.plan = parseEdit(planSchema, {
          ...plan,
          video: {
            ...plan.video,
            resolution,
            segments: [
              { id: 'main', type: 'video', sourceStart: 0, sourceEnd: 30 },
            ],
          },
        });
        const benchmark = await queue.add('render', {}, { attempts: 1 });
        await benchmark.waitUntilFinished(events, 300000);
      }
    }
    await fsp.writeFile(
      path.join(
        __dirname,
        process.argv.includes('--ai-audit')
          ? '../ai-agent-storage-results.json'
          : process.argv.includes('--quick')
            ? '../editor-storage-quick-results.json'
            : '../editor-storage-results.json',
      ),
      JSON.stringify(
        {
          measurements: measures,
          nativePeakWorkingSetMiB: Math.round(nativePeak / 1048576),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          passed: [
            'real Redis/BullMQ → production validator and renderer → FFmpeg full decode verification → AWS SDK streaming private S3 upload → cryptographically verified signed GET',
            'bounded downloads and If-Match',
            'active cancellation/process cleanup',
            'upload outage and Bull retry',
            'original media unchanged and render temp cleanup',
          ],
          measurements: measures,
          nativePeakWorkingSetMiB: Math.round(nativePeak / 1048576),
          limitations:
            'No real MongoDB, API persistence, SSO session store, or live Cloudflare R2 verification. Asset repository is a read-only adapter.',
        },
        null,
        2,
      ),
    );
  } finally {
    if (sample) clearInterval(sample);
    await eventually(() => !sampling, 10000).catch(() => {});
    await registry.killAll(100);
    if (worker) await worker.close();
    if (events) await events.close();
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
    if (server) await new Promise((r) => server.close(r));
    if (redisProcess?.pid && redisProcess.exitCode === null) {
      if (process.platform === 'win32') {
        try {
          execFileSync(
            'taskkill',
            ['/PID', String(redisProcess.pid), '/T', '/F'],
            { windowsHide: true, stdio: 'ignore' },
          );
        } catch {}
      } else redisProcess.kill('SIGTERM');
    }
    await new Promise((r) => setTimeout(r, 300));
    await fsp.rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}
main().catch((e) => {
  console.error('Storage/media test failed:', e.name, e.message);
  process.exitCode = 1;
});
