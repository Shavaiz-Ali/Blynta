// Offline safety tests: no database connections or real history mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ObjectId, BSON } = require('mongodb');
const source = fs.readFileSync(
  path.join(__dirname, 'cleanup-reviewed-activities.cjs'),
  'utf8',
);
const userId = new ObjectId();
const keep = {
  _id: new ObjectId(),
  userId,
  type: 'clip.download',
  title: 'Clip download requested',
  metadata: { clipId: 'clip' },
  createdAt: new Date(),
  updatedAt: new Date(),
};
const remove = { ...keep, _id: new ObjectId() };
async function run({
  apply = false,
  changed = false,
  separateAction = false,
  missingReview = false,
  overwriteBackup = false,
} = {}) {
  let backupWritten = false;
  let deletes = 0;
  const processMock = {
    argv: [
      'node',
      'cleanup',
      'manifest.json',
      ...(apply ? ['--apply', '--backup', 'backup.json'] : []),
    ],
    env: { MONGO_URI: 'mongodb://unused' },
  };
  const docs = new Map([
    [
      keep._id.toString(),
      {
        ...keep,
        ...(separateAction ? { metadata: { actionId: 'first' } } : {}),
      },
    ],
    [
      remove._id.toString(),
      {
        ...remove,
        ...(separateAction ? { metadata: { actionId: 'second' } } : {}),
      },
    ],
  ]);
  const collection = {
    findOne: async (filter) => docs.get(filter._id.toString()),
    deleteOne: async () => {
      assert.ok(backupWritten, 'Backup must precede deletion');
      deletes++;
      return { deletedCount: changed ? 0 : 1 };
    },
  };
  class Client {
    async connect() {}
    db() {
      return { collection: () => collection };
    }
    async close() {}
  }
  const manifest = [
    {
      keepId: keep._id.toString(),
      removeId: remove._id.toString(),
      reviewed: !missingReview,
      reason: 'Manually confirmed replay',
    },
  ];
  await vm.runInNewContext(source, {
    __dirname,
    process: processMock,
    console: { log: () => {}, error: () => {} },
    require: (id) => {
      if (id === 'mongodb') return { MongoClient: Client, ObjectId, BSON };
      if (id === 'dotenv') return { config: () => {} };
      if (id === 'node:fs')
        return {
          readFileSync: () => JSON.stringify(manifest),
          writeFileSync: (_path, data, options) => {
            assert.equal(options.flag, 'wx');
            if (overwriteBackup) throw new Error('Existing backup');
            assert.equal(BSON.EJSON.parse(data).length, 1);
            backupWritten = true;
          },
        };
      return require(id);
    },
  });
  return { deletes, backupWritten, failed: processMock.exitCode === 1 };
}
(async () => {
  assert.deepEqual(await run({}), {
    deletes: 0,
    backupWritten: false,
    failed: false,
  });
  assert.deepEqual(await run({ apply: true }), {
    deletes: 1,
    backupWritten: true,
    failed: false,
  });
  assert.deepEqual(await run({ apply: true, separateAction: true }), {
    deletes: 0,
    backupWritten: false,
    failed: true,
  });
  assert.deepEqual(await run({ apply: true, missingReview: true }), {
    deletes: 0,
    backupWritten: false,
    failed: true,
  });
  assert.deepEqual(await run({ apply: true, overwriteBackup: true }), {
    deletes: 0,
    backupWritten: false,
    failed: true,
  });
  assert.equal((await run({ apply: true, changed: true })).failed, true);
  console.log(
    'PASS: cleanup defaults to dry-run, requires review, preserves separate actions, backs up before deletion, refuses backup overwrite, and stops on concurrent changes.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
