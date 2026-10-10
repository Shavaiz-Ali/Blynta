// Real Nest HTTP, MongoDB, Redis/BullMQ, AWS SDK, and FFmpeg. Object storage is
// a local streaming S3 protocol stand-in, never described as live Cloudflare R2.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash, createHmac, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const { Queue, Worker } = require('bullmq');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { getModelToken } = require('@nestjs/mongoose');
const { getQueueToken } = require('@nestjs/bullmq');
const request = require('supertest');
const load = (name) => require('../dist/src/' + name);
const { EditPlansController } = load('ai-editor/edit-plans.controller');
const { EditPlansService, EDIT_QUEUE } = load('ai-editor/edit-plans.service');
const { EditPlanValidatorService } = load(
  'ai-editor/edit-plan-validator.service',
);
const { EditAdmissionService } = load('ai-editor/edit-admission.service');
const { EditRenderService } = load('ai-editor/edit-render.service');
const { EditRenderProcessor } = load('ai-editor/edit-render.processor');
const { EditRateLimitGuard } = load('ai-editor/edit-rate-limit.guard');
const schemas = load('ai-editor/edit.schemas');
const { StudioAssetSchema } = load('studio/studio.schemas');
const { JobSchema } = load('jobs/schemas/job.schema');
const { JwtStrategy } = load('auth/jwt.strategy');
const { UsersService } = load('users/users.service');
const { SsoService } = load('auth/sso.service');
const { REDIS_CLIENT } = load('redis/redis.module');
const { R2Service } = load('storage/r2.service');
const { MediaInspectionService } = load(
  'media/services/media-inspection.service',
);
const { ProcessRegistryService } = load(
  'common/services/process-registry.service',
);
const { AllExceptionsFilter } = load('common/filters/all-exceptions.filter');
const { parseEdit, planSchema } = load('ai-editor/edit-plan.contract');
const exec = promisify(execFile);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function freePort() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
async function eventually(check, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error('Integration condition timed out');
}
function signedGet(url, host) {
  const sig = url.searchParams.get('X-Amz-Signature');
  if (!sig || Number(url.searchParams.get('X-Amz-Expires')) > 3600)
    return false;
  const credential = url.searchParams.get('X-Amz-Credential');
  if (!credential) return false;
  const [key, date, region, service, terminal] = credential.split('/');
  if (key !== 'editor-test' || service !== 's3' || terminal !== 'aws4_request')
    return false;
  const encode = (s) =>
    encodeURIComponent(s).replace(
      /[!'()*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
  const query = [...url.searchParams]
    .filter(([k]) => k !== 'X-Amz-Signature')
    .map(([k, v]) => [encode(k), encode(v)])
    .sort((a, b) =>
      a[0] < b[0]
        ? -1
        : a[0] > b[0]
          ? 1
          : a[1] < b[1]
            ? -1
            : a[1] > b[1]
              ? 1
              : 0,
    )
    .map(([k, v]) => k + '=' + v)
    .join('&');
  const canonical = [
    'GET',
    url.pathname,
    query,
    'host:' + host + '\n',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = [date, region, service, terminal].join('/');
  const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
  const signing = hmac(
    hmac(hmac(hmac('AWS4editor-test-secret', date), region), service),
    terminal,
  );
  const expected = createHmac('sha256', signing)
    .update(
      [
        'AWS4-HMAC-SHA256',
        url.searchParams.get('X-Amz-Date'),
        scope,
        hash(canonical),
      ].join('\n'),
    )
    .digest('hex');
  return sig === expected;
}

async function main() {
  for (const name of [
    'EDIT_FFMPEG_PATH',
    'EDIT_FFPROBE_PATH',
    'EDIT_TEST_REDIS',
    ...(!process.env.EDIT_TEST_MONGO_URI ? ['EDIT_TEST_MONGOD'] : []),
  ])
    assert.ok(
      process.env[name] && fs.existsSync(process.env[name]),
      name + ' must point to an actual test binary',
    );
  process.env.PATH = [
    path.dirname(process.env.EDIT_FFMPEG_PATH),
    path.dirname(process.env.EDIT_FFPROBE_PATH),
    process.env.PATH,
  ].join(path.delimiter);
  process.env.FFMPEG_THREADS = '1';
  process.env.MEDIA_HOST_CONCURRENCY = '1';
  const root = await fsp.mkdtemp(
    path.join(os.tmpdir(), "blynta-editor's-test-"),
  );
  const children = [],
    results = [],
    objects = new Map();
  let mongo, queue, worker, app, redis, server;
  let failUploads = 0;
  const runId = randomUUID().replaceAll('-', '');
  try {
    const mongoPort = await freePort(),
      redisPort = await freePort();
    const dbpath = path.join(root, 'mongo');
    await fsp.mkdir(dbpath);
    const start = (binary, args) => {
      const child = spawn(binary, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let diagnostic = '';
      child.stderr.on(
        'data',
        (c) => (diagnostic = (diagnostic + c).slice(-2000)),
      );
      child.on('error', (e) =>
        console.error('Test infrastructure spawn failed:', e.message),
      );
      child.on('exit', (code) => {
        if (code) console.error('Test infrastructure exit:', code, diagnostic);
      });
      children.push(child);
      return child;
    };
    if (!process.env.EDIT_TEST_MONGO_URI)
      start(process.env.EDIT_TEST_MONGOD, [
        '--dbpath',
        dbpath,
        '--port',
        String(mongoPort),
        '--bind_ip',
        '127.0.0.1',
        '--wiredTigerCacheSizeGB',
        '0.25',
        '--logpath',
        path.join(root, 'mongo.log'),
      ]);
    start(process.env.EDIT_TEST_REDIS, [
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
    ]);
    await delay(1500);
    mongo = await mongoose
      .createConnection(
        process.env.EDIT_TEST_MONGO_URI || 'mongodb://127.0.0.1:' + mongoPort,
        { dbName: 'editor_test_' + runId, serverSelectionTimeoutMS: 20000 },
      )
      .asPromise();
    const models = {
      EditPlan: mongo.model('EditPlan', schemas.EditPlanSchema),
      EditVersion: mongo.model('EditVersion', schemas.EditVersionSchema),
      EditAdmission: mongo.model('EditAdmission', schemas.EditAdmissionSchema),
      StudioAsset: mongo.model('StudioAsset', StudioAssetSchema),
      Job: mongo.model('Job', JobSchema),
      TestUser: mongo.model(
        'TestUser',
        new mongoose.Schema({ isActive: Boolean, email: String, role: String }),
      ),
    };
    await Promise.all(Object.values(models).map((m) => m.init()));
    const connection = {
      host: '127.0.0.1',
      port: redisPort,
      maxRetriesPerRequest: null,
    };
    redis = new Redis(connection);
    queue = new Queue(EDIT_QUEUE, {
      connection,
      prefix: 'editor-test-' + runId,
    });
    await queue.waitUntilReady();
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://' + req.headers.host);
        const signed = req.method === 'GET' && signedGet(url, req.headers.host);
        if (
          !req.headers.authorization?.includes('Credential=editor-test/') &&
          !signed
        ) {
          res.writeHead(403).end();
          return;
        }
        const key = decodeURIComponent(url.pathname),
          file = path.join(root, 'object-' + hash(key));
        if (req.method === 'PUT') {
          if (key.includes('/edits/') && failUploads-- > 0) {
            req.resume();
            res
              .writeHead(503, { 'Content-Type': 'application/xml' })
              .end('<Error><Code>ServiceUnavailable</Code></Error>');
            return;
          }
          await pipeline(req, fs.createWriteStream(file));
          const etag = '"' + hash(await fsp.readFile(file)) + '"';
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
      } catch (e) {
        console.error('S3 stand-in:', e.message);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const config = new ConfigService({
      JWT_SECRET: 'isolated-editor-test-secret',
      R2_ENDPOINT: 'http://127.0.0.1:' + server.address().port,
      R2_ACCESS_KEY_ID: 'editor-test',
      R2_SECRET_ACCESS_KEY: 'editor-test-secret',
      R2_BUCKET_NAME: 'public-test',
      R2_SOURCE_BUCKET_NAME: 'private-test',
      R2_PUBLIC_DOMAIN: 'https://public.invalid',
      EDIT_RENDER_TIMEOUT_SECONDS: 120,
    });
    const providers = [
      EditPlansService,
      EditAdmissionService,
      EditPlanValidatorService,
      EditRenderService,
      EditRateLimitGuard,
      JwtStrategy,
      R2Service,
      MediaInspectionService,
      ProcessRegistryService,
      { provide: ConfigService, useValue: config },
      { provide: getQueueToken(EDIT_QUEUE), useValue: queue },
      { provide: REDIS_CLIENT, useValue: redis },
      ...Object.entries(models).map(([name, model]) => ({
        provide: getModelToken(name),
        useValue: model,
      })),
      {
        provide: UsersService,
        useValue: { findById: (id) => models.TestUser.findById(id) },
      },
      // JWT signature/expiration and active-user checks are real; SSO sessions are a test adapter.
      {
        provide: SsoService,
        useValue: { validateSessionHash: async () => 'consumer' },
      },
    ];
    const module = await Test.createTestingModule({
      controllers: [EditPlansController],
      providers,
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    const owner = await models.TestUser.create({
      isActive: true,
      email: 'editor@test.invalid',
      role: 'user',
    });
    const other = await models.TestUser.create({
      isActive: true,
      email: 'other@test.invalid',
      role: 'user',
    });
    const jwt = new JwtService({ secret: config.get('JWT_SECRET') });
    const auth = (id) =>
      'Bearer ' +
      jwt.sign(
        {
          sub: String(id),
          sid: 'test-session',
          email: 'editor@test.invalid',
          role: 'user',
        },
        { expiresIn: '5m' },
      );
    const ownerAuth = auth(owner._id),
      otherAuth = auth(other._id);
    const call = (method, url, body, authorization = ownerAuth) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', authorization)
        .send(body);
    await call(
      'get',
      '/ai-editor/plans/' + new mongoose.Types.ObjectId(),
      undefined,
      'Bearer invalid',
    ).expect(401);
    const r2 = app.get(R2Service),
      inspection = app.get(MediaInspectionService);
    const source = path.join(root, 'source.mp4'),
      music = path.join(root, 'music.wav'),
      image = path.join(root, 'image.png');
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
      image,
    ]);
    const sourceKey = 'job-sources/test/source.mp4';
    await r2.uploadFile(source, sourceKey);
    for (const [assetId, file, mimeType, kind] of [
      ['music', music, 'audio/wav', 'audio'],
      ['image', image, 'image/png', 'image'],
    ]) {
      const key = 'job-sources/studio-assets/test/' + assetId;
      await r2.uploadBuffer(await fsp.readFile(file), key, mimeType);
      await models.StudioAsset.create({
        userId: String(owner._id),
        projectId: 'test',
        assetId,
        storageKey: key,
        mimeType,
        kind,
        status: 'ready',
        duration: kind === 'audio' ? 2 : 0,
        width: 32,
        height: 256,
        hasAudio: kind === 'audio',
      });
    }
    const clipId = new mongoose.Types.ObjectId();
    const job = await models.Job.create({
      userId: owner._id,
      sourceUrl: 'https://test.invalid',
      sourcePlatform: 'upload',
      status: 'completed',
      clips: [
        {
          _id: clipId,
          startTime: 0,
          endTime: 3,
          status: 'completed',
          r2ObjectKey: sourceKey,
        },
      ],
    });
    const originalHash = hash(await fsp.readFile(source)),
      originalJob = JSON.stringify(await models.Job.findById(job._id).lean());
    const plan = parseEdit(planSchema, {
      schemaVersion: 1,
      timestampSystem: 'output_seconds',
      video: {
        aspectRatio: '16:9',
        segments: [{ id: 'main', type: 'video', sourceStart: 0, sourceEnd: 3 }],
      },
      audio: {
        original: {},
        tracks: [
          {
            id: 'music',
            role: 'music_track',
            assetId: 'music',
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
            mutes: [],
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
            text: "Text: 100% 'quote' \\ Unicode café\nsecond line",
            font: 'sans',
            fontSize: 28,
            color: '#ffffff',
            x: 0.5,
            y: 0.8,
          },
        },
      ],
    });
    const created = (
      await call('post', '/ai-editor/plans', {
        jobId: String(job._id),
        clipId: String(clipId),
        plan,
      }).expect(201)
    ).body;
    assert.equal(created.revision, 1);
    assert.equal(created.sourceMedia, undefined);
    const planId = created._id;
    for (const [method, suffix] of [
      ['get', ''],
      ['put', ''],
      ['post', '/preview'],
      ['post', '/validate'],
      ['get', '/versions'],
    ])
      await call(
        method,
        '/ai-editor/plans/' + planId + suffix,
        method === 'put' ? { revision: 1, plan } : undefined,
        otherAuth,
      ).expect(404);
    await call('post', '/ai-editor/plans/' + planId + '/validate').expect(201);
    const previews = await Promise.all([
      call('post', '/ai-editor/plans/' + planId + '/preview'),
      call('post', '/ai-editor/plans/' + planId + '/preview'),
    ]);
    assert.equal(previews[0].status, 201);
    assert.equal(previews[0].body._id, previews[1].body._id);
    const versionId = previews[0].body._id;
    assert.equal(await models.EditVersion.countDocuments(), 1);
    const admission = app.get(EditAdmissionService);
    const admissions = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        admission.acquire(String(other._id), 'test-' + i),
      ),
    );
    assert.equal(admissions.filter((x) => x.status === 'fulfilled').length, 5);
    results.push('atomic admission: 5 of 8 concurrent requests admitted');
    const processor = new EditRenderProcessor(
      models.EditVersion,
      models.EditPlan,
      app.get(EditRenderService),
      r2,
      config,
      queue,
      admission,
    );
    const measure = [];
    worker = new Worker(
      EDIT_QUEUE,
      async (job, token) => {
        const start = Date.now();
        try {
          return await processor.process(job, token);
        } finally {
          measure.push({
            versionId: job.data.versionId,
            attempt: job.attemptsMade,
            seconds: (Date.now() - start) / 1000,
            nodeRssMiB: Math.round(process.memoryUsage().rss / 1048576),
          });
        }
      },
      { connection, prefix: queue.opts.prefix, concurrency: 1 },
    );
    worker.on('error', (e) => console.error('Bull worker:', e.message));
    await eventually(
      async () =>
        (await models.EditVersion.findById(versionId)).status === 'completed',
    );
    const completed = (
      await call('get', '/ai-editor/versions/' + versionId).expect(200)
    ).body;
    assert.equal(completed.executionToken, undefined);
    assert.equal(completed.outputKey, undefined);
    assert.ok(completed.outputUrl.includes('private-test/'));
    assert.ok(completed.outputUrl.includes('X-Amz-Signature='));
    const downloaded = await fetch(completed.outputUrl);
    assert.equal(downloaded.status, 200);
    const output = path.join(root, 'downloaded.mp4');
    await fsp.writeFile(output, Buffer.from(await downloaded.arrayBuffer()));
    const metadata = await inspection.inspect(output, true, 'mov');
    assert.equal(metadata.width, 1280);
    assert.ok(Math.abs(metadata.durationSeconds - 3) < 0.1);
    assert.equal((await fetch(completed.outputUrl.split('?')[0])).status, 403);
    await call(
      'get',
      '/ai-editor/versions/' + versionId,
      undefined,
      otherAuth,
    ).expect(404);
    await call(
      'post',
      '/ai-editor/versions/' + versionId + '/retry',
      undefined,
      otherAuth,
    ).expect(404);
    results.push(
      'full API → Mongo → Bull → renderer → real FFmpeg → streaming S3 → Mongo → verified signed GET',
    );
    const updates = await Promise.all([
      call('put', '/ai-editor/plans/' + planId, { revision: 1, plan }),
      call('put', '/ai-editor/plans/' + planId, { revision: 1, plan }),
    ]);
    assert.deepEqual(updates.map((x) => x.status).sort(), [200, 409]);
    const next = (
      await call('post', '/ai-editor/plans/' + planId + '/preview').expect(201)
    ).body;
    // A deliberate upload outage exhausts SDK and queue retries, then manual retry
    // must reuse the snapshot with a new dispatch generation and private object.
    failUploads = 100;
    await eventually(
      async () =>
        (await models.EditVersion.findById(next._id)).status === 'failed',
      120000,
    );
    failUploads = 0;
    const retried = (
      await call('post', '/ai-editor/versions/' + next._id + '/retry').expect(
        201,
      )
    ).body;
    assert.equal(retried._id, next._id);
    assert.equal(retried.revision, 2);
    await eventually(
      async () =>
        (await models.EditVersion.findById(next._id)).status === 'completed',
    );
    const history = (
      await call('get', '/ai-editor/plans/' + planId + '/versions').expect(200)
    ).body;
    assert.equal(history.items.length, 2);
    assert.equal(await models.EditVersion.countDocuments(), 2);
    const version2 = await models.EditVersion.findById(next._id).lean();
    assert.equal(version2.generation, 1);
    assert.equal(version2.plan.operations[0].params.toScale, 1.3);
    await processor.reconcile();
    assert.equal(
      JSON.stringify(await models.Job.findById(job._id).lean()),
      originalJob,
    );
    assert.equal(
      hash(await fsp.readFile(objects.get('/private-test/' + sourceKey).file)),
      originalHash,
    );
    assert.equal(
      [...objects.keys()].filter((k) => k.includes('/edits/')).length,
      2,
    );
    assert.equal(
      (await models.EditAdmission.findById(String(owner._id))).active.length,
      0,
    );
    results.push(
      'second revision, optimistic conflict, failed-version retry, history integrity, no duplicate outputs, original unchanged',
    );
    console.log(
      JSON.stringify(
        {
          passed: results,
          renderMeasurements: measure,
          infrastructure:
            'isolated real MongoDB + Redis-compatible Memurai; local S3 stand-in; actual FFmpeg; real JWT with test SSO adapter',
        },
        null,
        2,
      ),
    );
  } finally {
    if (worker) await worker.close();
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
    if (app) await app.close();
    if (redis) await redis.quit();
    if (mongo) {
      await mongo.dropDatabase();
      await mongo.close();
    }
    if (server) await new Promise((r) => server.close(r));
    for (const child of children)
      if (child.pid && child.exitCode === null) {
        if (process.platform === 'win32') {
          try {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
              windowsHide: true,
              stdio: 'ignore',
            });
          } catch {}
        } else child.kill('SIGTERM');
      }
    await delay(500);
    await fsp.rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}
module.exports = { signedGet, freePort, eventually };
if (require.main === module)
  main().catch((e) => {
    console.error('Editor flow failed:', e.name);
    process.exitCode = 1;
  });
