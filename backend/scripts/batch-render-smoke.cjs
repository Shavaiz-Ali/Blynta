// Run after npm run build, with staging env supplied by your secret manager.
require('reflect-metadata');
const mongoose = require('mongoose');
const { ConfigService } = require('@nestjs/config');
const {
  BatchRenderService,
} = require('../dist/src/batch-render/batch-render.service');
const {
  BatchExecutionSchema,
} = require('../dist/src/batch-render/batch-execution.schema');
const { R2Service } = require('../dist/src/storage/r2.service');
const { resolveStylePreset } = require('../dist/src/media/style-presets');
const { mediaExecution } = require('../dist/src/jobs/cancellation-context');

async function main() {
  if (process.env.RENDER_EXECUTION_MODE !== 'aws_batch')
    throw new Error('Set aws_batch only in this staging smoke process');
  const sourceKey = process.argv[2];
  const identity = process.env.BATCH_SMOKE_ID;
  if (!identity || !sourceKey || !process.env.MONGO_URI)
    throw new Error(
      'Supply BATCH_SMOKE_ID, MONGO_URI, and a private R2 source key argument',
    );
  const config = new ConfigService();
  const r2 = new R2Service(config);
  await mongoose.connect(process.env.MONGO_URI);
  const model = mongoose.model('BatchExecution', BatchExecutionSchema);
  await model.init();
  const adapter = new BatchRenderService(config, r2, model);
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  process.once('SIGTERM', () => abort.abort());
  try {
    const result = await mediaExecution.run(
      { signal: abort.signal, children: new Set() },
      () =>
        adapter.execute(
          `smoke/${identity}`,
          async (prefix, deadline) => ({
            version: 1,
            kind: 'clip',
            sourceKey,
            start: 0,
            end: 5,
            segments: [
              { startTime: 0, endTime: 4, text: 'Blynta Batch smoke test' },
            ],
            style: resolveStylePreset('default').captionStyle,
            deadline,
            outputKey: `${prefix}/output.mp4`,
          }),
          async (phase, percent) =>
            console.log(JSON.stringify({ phase, percent })),
        ),
    );
    console.log(JSON.stringify(result));
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(() => {
  console.error(
    'Batch smoke failed. Inspect BatchExecution and CloudWatch; no clip was published.',
  );
  process.exitCode = 1;
});
