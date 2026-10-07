// Run after npm run build. Always uses a unique temporary DB and Redis prefix.
// --configured-mongo uses the configured Mongo server, never its application DB.
// Redis must be local; --configured-mongo also uses its configured local port.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { Queue, Worker } = require('bullmq');
const { Test } = require('@nestjs/testing');
const { AuthGuard } = require('@nestjs/passport');
const { ZodValidationPipe } = require('nestjs-zod');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const {
  ActivitySchema,
} = require('../dist/src/activities/schemas/activity.schema');
const {
  ActivitiesService,
} = require('../dist/src/activities/activities.service');
const {
  ActivitiesProcessor,
} = require('../dist/src/activities/activities.processor');
const { JobsController } = require('../dist/src/jobs/jobs.controller');
const { JobsService } = require('../dist/src/jobs/jobs.service');
const { UsersService } = require('../dist/src/users/users.service');
const { R2Service } = require('../dist/src/storage/r2.service');
const configured = process.argv.includes('--configured-mongo');
if (configured)
  require('dotenv').config({
    path: require('node:path').resolve(__dirname, '../.env'),
    quiet: true,
  });

// Execute the application's actual download mutation, with HTTP routed to Nest.
function frontendQueries(axiosClient) {
  const root = path.resolve(__dirname, '../../apps/app/features/jobs');
  function load(filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = (id) => {
      if (id === '@tanstack/react-query')
        return { useMutation: (options) => options };
      if (id === '@/config/axiosClient') return { axiosClient };
      if (id.startsWith('.'))
        return load(path.resolve(path.dirname(filename), `${id}.ts`));
      return original(id);
    };
    mod._compile(output, filename);
    return mod.exports;
  }
  return load(path.join(root, 'queries.ts'));
}

async function main() {
  const runId = randomUUID().replaceAll('-', '');
  const redisHost = configured
    ? process.env.REDIS_HOST || 'localhost'
    : '127.0.0.1';
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(redisHost),
    'Integration Redis must be localhost',
  );
  const mongoUri = configured
    ? process.env.MONGO_URI
    : 'mongodb://127.0.0.1:27017';
  assert.ok(mongoUri, 'Mongo URI required');
  const mongo = mongoose.createConnection(mongoUri, {
    dbName: `acttest_${runId.slice(0, 24)}`,
    serverSelectionTimeoutMS: 10000,
  });
  let queue, app;
  const workers = [];
  let connected = false;
  try {
    await mongo.asPromise();
    connected = true;
    const model = mongo.model('Activity', ActivitySchema);
    await model.init();
    const connection = {
      host: redisHost,
      port: configured ? Number(process.env.REDIS_PORT || 6379) : 6379,
      connectTimeout: 3000,
      retryStrategy: () => null,
    };
    queue = new Queue('activities', {
      connection,
      prefix: `activity-test-${runId}`,
    });
    await queue.waitUntilReady();
    const service = new ActivitiesService(model, queue);
    const processor = new ActivitiesProcessor(service);
    const attempts = new Map();
    let crashOnce = false;
    for (let i = 0; i < 2; i++) {
      const worker = new Worker(
        'activities',
        async (job) => {
          attempts.set(job.id, (attempts.get(job.id) || 0) + 1);
          await processor.process(job);
          if (crashOnce) {
            crashOnce = false;
            throw new Error('Injected failure after Mongo persistence');
          }
        },
        { connection, prefix: `activity-test-${runId}`, concurrency: 2 },
      );
      worker.on('error', () => {});
      workers.push(worker);
    }
    const userId = new mongoose.Types.ObjectId().toString();
    const jobId = new mongoose.Types.ObjectId().toString();
    const clipId = new mongoose.Types.ObjectId().toString();
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: ActivitiesService, useValue: service },
        {
          provide: JobsService,
          useValue: {
            getClipForDownload: async () => ({
              clip: {
                _id: new mongoose.Types.ObjectId(clipId),
                r2ObjectKey: 'test.mp4',
              },
            }),
          },
        },
        { provide: UsersService, useValue: {} },
        {
          provide: R2Service,
          useValue: {
            getSignedDownloadUrl: async () => 'https://example.test/signed',
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use((req, _res, next) => {
      req.user = { userId };
      next();
    });
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    const route = `/jobs/${jobId}/clips/${clipId}`;
    const http = request(app.getHttpServer());
    let downloadRequests = 0;
    const hooks = frontendQueries({
      post: async (url, body) => {
        downloadRequests++;
        const response = await http.post(url).send(body).expect(201);
        return { data: response.body };
      },
    });
    const downloadAction = hooks.useDownloadClip().mutationFn;
    const waitForCount = async (count) => {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const states = await queue.getJobCounts('active', 'waiting', 'delayed');
        if (
          (await model.countDocuments()) === count &&
          !states.active &&
          !states.waiting &&
          !states.delayed
        )
          return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(
        'Timed out waiting for expected activity count/queue completion',
      );
    };
    await http.get(`${route}/media-url`).expect(200);
    await http.get(`${route}/download`).expect(200);
    assert.equal(await model.countDocuments(), 0);
    const actionId = randomUUID();
    await downloadAction({ jobId, clipId, actionId });
    assert.equal(downloadRequests, 1);
    await waitForCount(1);
    assert.equal(await queue.getJobCountByTypes(), 1);
    const first = await model.findOne().lean();
    assert.equal(first.metadata.actionId, actionId);
    assert.equal(typeof first.metadata.requestId, 'string');
    // Duplicate transport request: same action, stable Bull job, one Mongo record.
    await downloadAction({ jobId, clipId, actionId });
    await waitForCount(1);
    assert.equal(await queue.getJobCountByTypes(), 1);
    // A new intentional action must create a second record even for the same clip.
    crashOnce = true;
    await downloadAction({ jobId, clipId, actionId: randomUUID() });
    await waitForCount(2);
    assert.equal(await queue.getJobCountByTypes(), 2);
    assert.ok(
      [...attempts.values()].includes(2),
      'Injected failure must cause a real BullMQ retry',
    );
    const jobs = await queue.getJobs(['completed']);
    const trace = [];
    for (const job of jobs) {
      const doc = await model.findOne({ dedupeKey: job.data.dedupeKey }).lean();
      assert.ok(doc);
      trace.push({
        ...doc.metadata,
        userId,
        eventId: doc.dedupeKey,
        activityJobId: job.id,
        attempts: attempts.get(job.id),
        activityId: doc._id.toString(),
      });
    }
    console.log(
      JSON.stringify(
        {
          passed: true,
          singleClick: { requests: 1, jobs: 1, records: 1 },
          replay: { records: 1 },
          newClickWithRetry: { recordsAdded: 1 },
          workers: 2,
          trace,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const worker of workers) await worker.close();
    if (app) await app.close();
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
    // Remove only our collection in the uniquely named test database. Some
    // application credentials can drop collections but cannot drop databases.
    try {
      if (connected) await mongo.dropCollection('activities');
    } finally {
      await mongo.close();
    }
  }
}
main().catch((error) => {
  console.error(
    `Local activity integration failed (${error.name}): ${error.message}`,
  );
  process.exitCode = 1;
});
