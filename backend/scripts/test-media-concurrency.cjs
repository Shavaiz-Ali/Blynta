/* Isolated real Redis/BullMQ + subprocess test. Never reads .env or production data.
 * MEDIA_TEST_REDIS_BINARY=/path/to/redis-server (or memurai.exe on Windows).
 * MEDIA_TEST_FFMPEG=/path/to/ffmpeg optionally exercises actual FFmpeg too.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (process.argv[2] === 'operation') {
    const [log, id, duration] = process.argv.slice(3);
    const mark = (event) =>
      fs.appendFileSync(
        log,
        JSON.stringify({ event, id, at: Date.now() }) + '\n',
      );
    mark('start');
    if (process.env.MEDIA_TEST_FFMPEG) {
      const encoder = spawn(process.env.MEDIA_TEST_FFMPEG, [
        '-threads',
        '1',
        '-re',
        '-filter_threads',
        '1',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=160x90:rate=10',
        '-t',
        String(Math.max(0.1, Number(duration) / 1000)),
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-progress',
        'pipe:1',
        '-y',
        path.join(path.dirname(log), id + '.mp4'),
      ]);
      let error = '';
      encoder.stderr.on('data', (chunk) => {
        error += chunk;
      });
      // Crash tests wait until FFmpeg itself publishes its first progress sample.
      encoder.stdout.once('data', () => console.log('started'));
      await new Promise((resolve, reject) => {
        encoder.once('error', reject);
        encoder.once('close', (code) =>
          code === 0 ? resolve() : reject(new Error(error)),
        );
      });
    } else {
      console.log('started');
      await delay(Number(duration));
    }
    mark('end');
    return;
  }
  const { Queue, Worker } = require('bullmq');
  const Redis = require('ioredis');
  const compiled = path.resolve(__dirname, '../dist/src');
  const { runCommandWithProgress } = require(
    path.join(compiled, 'media/utils/run-command-with-progress'),
  );
  const { ProcessRegistryService } = require(
    path.join(compiled, 'common/services/process-registry.service'),
  );
  if (process.argv[2] === 'worker') {
    const settings = JSON.parse(process.argv[3]);
    const registry = new ProcessRegistryService();
    const worker = new Worker(
      'clip-renders',
      async (job) => {
        await runCommandWithProgress(
          process.execPath,
          [
            __filename,
            'operation',
            settings.log,
            job.id,
            String(job.data.duration),
          ],
          (line) => {
            if (line === 'started')
              process.send?.({ event: 'started', id: job.id });
          },
          registry,
        );
        await job.updateProgress(100);
      },
      {
        connection: settings.connection,
        prefix: settings.prefix,
        concurrency: 2,
        lockDuration: 1000,
        stalledInterval: 1000,
        maxStalledCount: 1,
      },
    );
    worker.on('error', (error) =>
      process.send?.({ event: 'error', message: error.message }),
    );
    worker.on('stalled', (id) => process.send?.({ event: 'stalled', id }));
    worker.on('failed', (job, error) =>
      process.send?.({ event: 'failed', id: job?.id, message: error.message }),
    );
    process.send?.({ event: 'ready' });
    process.on('message', async () => {
      registry.beginShutdown();
      await worker.close(true);
      await registry.killAll(100);
      process.exit(0);
    });
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blynta-capacity-test-'));
  const connection = {
    host: '127.0.0.1',
    port: 16389,
    maxRetriesPerRequest: null,
  };
  const prefix = 'media-test-' + randomUUID();
  const log = path.join(root, 'operations.jsonl');
  fs.writeFileSync(log, '');
  process.env.MEDIA_HOST_LOCK_DIR = path.join(root, 'locks');
  const server = spawn(
    process.env.MEDIA_TEST_REDIS_BINARY || 'redis-server',
    [
      '--bind',
      '127.0.0.1',
      '--port',
      String(connection.port),
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      root,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let serverError;
  let serverOutput = '';
  server.on('error', (e) => {
    serverError = e;
  });
  const children = new Set();
  const redis = new Redis({ ...connection, retryStrategy: () => 100 });
  redis.on('error', () => {});
  let queue;
  async function until(check, timeout = 90000) {
    const deadline = Date.now() + timeout;
    while (!(await check())) {
      if (serverError) throw serverError;
      if (server.exitCode !== null)
        throw new Error(
          'Fixture Redis exited: ' + server.exitCode + serverOutput,
        );
      if (Date.now() > deadline) {
        const interrupted = await queue?.getJob('interrupted');
        throw new Error(
          'Test timeout: ' +
            JSON.stringify(
              interrupted && {
                state: await interrupted.getState(),
                failedReason: interrupted.failedReason,
                attemptsMade: interrupted.attemptsMade,
                stalledCounter: interrupted.stalledCounter,
                operations: fs.readFileSync(log, 'utf8'),
              },
            ),
        );
      }
      await delay(100);
    }
  }
  function worker() {
    const child = fork(
      __filename,
      ['worker', JSON.stringify({ connection, prefix, log })],
      { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] },
    );
    children.add(child);
    child.on('exit', () => children.delete(child));
    child.on('message', (message) => {
      if (message.event === 'error') console.error(message.message);
      if (message.event === 'stalled' || message.event === 'failed')
        console.log(JSON.stringify(message));
    });
    return child;
  }
  function peak() {
    let active = 0,
      maximum = 0;
    for (const event of fs
      .readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(JSON.parse)) {
      active += event.event === 'start' ? 1 : -1;
      assert(active >= 0);
      maximum = Math.max(maximum, active);
    }
    assert.equal(active, 0, 'all subprocesses exited');
    return maximum;
  }
  const reset = () => fs.writeFileSync(log, '');
  try {
    await until(() => redis.status === 'ready', 10000);
    // Refuse to continue unless the fixture server really started (not an existing port).
    await delay(200);
    assert.equal(server.exitCode, null, 'fixture Redis failed to bind');
    queue = new Queue('clip-renders', { connection, prefix });
    queue.on('error', () => {});
    await queue.setGlobalConcurrency(1);
    const first = worker(),
      second = worker();
    for (const users of [1, 2]) {
      reset();
      const ids = [];
      for (let user = 0; user < users; user++)
        for (let clip = 0; clip < 7; clip++) {
          const id = `u${users}-${user}-clip-${clip}`;
          ids.push(id);
          await queue.add(
            'render-clip',
            { user, duration: 100 },
            { jobId: id, attempts: 3 },
          );
        }
      await until(async () =>
        (
          await Promise.all(
            ids.map(async (id) => (await queue.getJob(id)).getState()),
          )
        ).every((s) => s === 'completed'),
      );
      assert.equal(peak(), 1);
      console.log(
        `PASS ${users} user(s), ${ids.length} clips, peak operations=1, all completed`,
      );
    }
    // Separate queues / bypass paths still compete for the exact same host slots.
    reset();
    await Promise.all(
      ['caption', 'audio', 'preparation', 'yt-dlp-merge', 'studio'].map((id) =>
        runCommandWithProgress(
          process.execPath,
          [__filename, 'operation', log, id, '100'],
          () => {},
        ),
      ),
    );
    assert.equal(peak(), 1);
    console.log('PASS cross-stage host gate: peak operations=1');

    reset();
    let victim;
    const id = 'interrupted';
    const started = (child) => (message) => {
      if (message.event === 'started' && message.id === id && !victim) {
        victim = child;
        child.kill('SIGKILL');
      }
    };
    first.on('message', started(first));
    second.on('message', started(second));
    await queue.add(
      'render-clip',
      { duration: 2500 },
      { jobId: id, attempts: 3 },
    );
    await until(
      async () => (await (await queue.getJob(id)).getState()) === 'completed',
    );
    assert(victim, 'worker was killed during processing');
    assert.equal(peak(), 1, 'orphaned process continues holding its slot');
    const recovered = await queue.getJob(id);
    assert.equal(
      recovered.attemptsMade,
      1,
      'stall recovery did not consume a failed attempt',
    );
    assert.equal(recovered.progress, 100);
    console.log(
      'PASS process crash: stalled job recovered, progress=100, peak operations=1',
    );
    worker();

    reset();
    process.env.MEDIA_HOST_CONCURRENCY = '2';
    // Existing workers retain their host capacity: stop before changing the host policy.
    for (const child of children) child.send('stop');
    await until(() => children.size === 0);
    await queue.setGlobalConcurrency(2);
    worker();
    worker();
    const scaled = [];
    for (let n = 0; n < 4; n++) {
      const id = 'scaled-' + n;
      scaled.push(id);
      await queue.add('render-clip', { duration: 1500 }, { jobId: id });
    }
    await until(async () =>
      (
        await Promise.all(
          scaled.map(async (id) => (await queue.getJob(id)).getState()),
        )
      ).every((s) => s === 'completed'),
    );
    assert.equal(peak(), 2);
    console.log('PASS controlled scaling: global=2, host=2, peak operations=2');
    console.log(
      process.env.MEDIA_TEST_FFMPEG
        ? 'Actual FFmpeg enabled'
        : 'Subprocess fixtures used; FFmpeg binary not configured',
    );
  } finally {
    for (const child of children) child.send('stop');
    await until(() => children.size === 0, 10000).catch(() => {
      for (const child of children) child.kill();
    });
    if (queue && redis.status === 'ready') {
      await queue.obliterate({ force: true }).catch(() => {});
    }
    await queue?.close();
    redis.disconnect();
    server.kill();
    // Leave fixtures for diagnostics on failures; the OS temp directory owns them.
    console.log('Fixture directory: ' + root);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
