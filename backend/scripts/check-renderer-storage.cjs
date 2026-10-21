// Offline preflight against the compiled module that the renderer actually loads.
// Run inside the image: no R2 credentials, AWS access or network calls are needed.
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { ConfigService } = require('@nestjs/config');
const { UnrecoverableError } = require('bullmq');
const {
  assertBatchStorage,
  assertBatchTaskKeys,
} = require('../dist/src/batch-render/render-task');
const { R2Service } = require('../dist/src/storage/r2.service');

const storage = {
  R2_BUCKET_NAME: 'blynta',
  R2_SOURCE_BUCKET_NAME: 'blynta',
  R2_ENDPOINT: 'https://offline-preflight.r2.cloudflarestorage.com',
  R2_PUBLIC_DOMAIN: '',
};
// Deliberately empty overrides isolate this offline test from any host credentials.
assert.throws(
  () =>
    new R2Service(
      new ConfigService({
        ...storage,
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
      }),
    ),
  UnrecoverableError,
);
assert.throws(
  () =>
    new R2Service(
      new ConfigService({
        ...storage,
        R2_ACCESS_KEY_ID: 'offline-test',
        R2_SECRET_ACCESS_KEY: '',
      }),
    ),
  UnrecoverableError,
);
assert.doesNotThrow(() => assertBatchStorage(new ConfigService(storage)));
assert.doesNotThrow(() =>
  assertBatchStorage(
    new ConfigService({ ...storage, R2_SOURCE_BUCKET_NAME: 'private-sources' }),
  ),
);
for (const R2_ENDPOINT of [
  'http://offline.invalid',
  'https://',
  'invalid',
  'https://user:password@offline.invalid',
]) {
  assert.throws(
    () => assertBatchStorage(new ConfigService({ ...storage, R2_ENDPOINT })),
    UnrecoverableError,
  );
}
assert.throws(
  () =>
    assertBatchStorage(
      new ConfigService({
        ...storage,
        R2_PUBLIC_DOMAIN: 'https://public.invalid',
      }),
    ),
  UnrecoverableError,
);

const prefix = `job-sources/batch/${'a'.repeat(64)}`;
const task = {
  kind: 'clip',
  outputKey: `${prefix}/output.mp4`,
  sourceKey: 'source-videos/existing/video.mp4',
};
assert.doesNotThrow(() => assertBatchTaskKeys(task, prefix));
assert.doesNotThrow(() =>
  assertBatchTaskKeys(
    { ...task, sourceKey: 'job-sources/existing/video.mp4' },
    prefix,
  ),
);
for (const sourceKey of [
  ...['task.json', 'progress.json', 'result.json', 'output.mp4'].map(
    (name) => `${prefix}/${name}`,
  ),
  'source-videos/../escape.mp4',
]) {
  assert.throws(
    () => assertBatchTaskKeys({ ...task, sourceKey }, prefix),
    UnrecoverableError,
  );
}
async function checkSigning() {
  for (const source of ['blynta', 'private-sources']) {
    const r2 = new R2Service(
      new ConfigService({
        ...storage,
        R2_SOURCE_BUCKET_NAME: source,
        R2_ACCESS_KEY_ID: '1'.repeat(32),
        R2_SECRET_ACCESS_KEY: '2'.repeat(64),
      }),
    );
    // This script deliberately exercises the compiled SDK signer with an offline transport.
    const client = r2.client;
    let requests = 0;
    client.config.requestHandler = {
      handle: async (request) => {
        requests++;
        assert.equal(request.hostname, new URL(storage.R2_ENDPOINT).hostname);
        assert(request.path.startsWith(`/${source}/`));
        assert(request.headers.authorization.startsWith('AWS4-HMAC-SHA256 '));
        assert(request.headers.authorization.includes('/auto/s3/aws4_request'));
        return {
          response: {
            statusCode: 200,
            headers: {},
            body: Readable.from([Buffer.from('{}')]),
          },
        };
      },
    };
    try {
      await r2.downloadToBuffer(`${prefix}/task.json`);
      await r2.objectInfo('source-videos/existing/video.mp4');
      await r2.uploadBuffer(
        Buffer.from('{}'),
        `${prefix}/progress.json`,
        'application/json',
      );
      const signed = new URL(
        await r2.getSignedDownloadUrl('source-videos/existing/video.mp4'),
      );
      assert.equal(signed.hostname, new URL(storage.R2_ENDPOINT).hostname);
      assert(signed.pathname.startsWith(`/${source}/`));
      assert.equal(
        signed.searchParams.get('X-Amz-Algorithm'),
        'AWS4-HMAC-SHA256',
      );
      assert.equal(requests, 3);
    } finally {
      client.destroy();
    }
  }
  console.log(
    JSON.stringify({
      event: 'renderer_storage_preflight_passed',
      singlePrivateBucket: true,
      separateBuckets: true,
      httpsEnforced: true,
      privateStorageEnforced: true,
      sourceKeysPreserved: true,
      collisionsRejected: true,
      missingCredentialsRejected: true,
      sigV4Verified: true,
      accountEndpointPreserved: true,
    }),
  );
}
checkSigning().catch(() => {
  // Assertion errors could include signed headers: never print the raw failure.
  console.error(
    'Renderer compiled R2 signing preflight failed; credentials and requests omitted',
  );
  process.exitCode = 1;
});
