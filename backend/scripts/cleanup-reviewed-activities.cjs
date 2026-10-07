// Optional one-time cleanup. Dry-run by default. Never infer deletion from time proximity.
// Manifest: [{ keepId: '<ObjectId>', removeId: '<ObjectId>', reviewed: true, reason: '...' }]
// node scripts/cleanup-reviewed-activities.cjs manifest.json
// node scripts/cleanup-reviewed-activities.cjs manifest.json --apply --backup backup.json
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, ObjectId, BSON } = require('mongodb');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

function comparable(doc) {
  const metadata = { ...(doc.metadata || {}) };
  delete metadata.requestId;
  delete metadata.actionId;
  return BSON.EJSON.stringify({
    userId: doc.userId,
    type: doc.type,
    category: doc.category,
    title: doc.title,
    description: doc.description,
    entityType: doc.entityType,
    entityId: doc.entityId,
    actorType: doc.actorType,
    actorId: doc.actorId,
    activityUrl: doc.activityUrl,
    isSystem: doc.isSystem,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    status: doc.status,
    severity: doc.severity,
    metadata,
  });
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath || manifestPath.startsWith('--'))
    throw new Error('Reviewed manifest path required');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest) || !manifest.length)
    throw new Error('Manifest must be a nonempty array');
  const removals = new Set();
  const keepers = new Set();
  for (const item of manifest) {
    if (
      !/^[a-f\d]{24}$/i.test(item.keepId) ||
      !/^[a-f\d]{24}$/i.test(item.removeId) ||
      item.keepId.toLowerCase() === item.removeId.toLowerCase() ||
      item.reviewed !== true ||
      typeof item.reason !== 'string' ||
      !item.reason.trim()
    )
      throw new Error(
        'Each pair needs valid distinct IDs and an explicit reviewed reason',
      );
    const id = item.removeId.toLowerCase();
    if (removals.has(id)) throw new Error('Duplicate removal ID');
    removals.add(id);
    keepers.add(item.keepId.toLowerCase());
  }
  if ([...removals].some((id) => keepers.has(id)))
    throw new Error('A keeper cannot also be removed');
  const apply = process.argv.includes('--apply');
  const backupIndex = process.argv.indexOf('--backup');
  const backup = backupIndex >= 0 ? process.argv[backupIndex + 1] : undefined;
  if (apply && (!backup || backup.startsWith('--')))
    throw new Error('Apply requires an unused backup file path');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI required');
  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const collection = client.db().collection('activities');
    const approved = [];
    for (const item of manifest) {
      const [keep, remove] = await Promise.all([
        collection.findOne({ _id: new ObjectId(item.keepId) }),
        collection.findOne({ _id: new ObjectId(item.removeId) }),
      ]);
      if (!keep || !remove || comparable(keep) !== comparable(remove))
        throw new Error(
          'Missing or materially different records; cleanup refused',
        );
      if (
        keep.dedupeKey &&
        remove.dedupeKey &&
        keep.dedupeKey !== remove.dedupeKey
      )
        throw new Error('Distinct event keys must be preserved');
      if (
        keep.metadata?.actionId &&
        remove.metadata?.actionId &&
        keep.metadata.actionId !== remove.metadata.actionId
      )
        throw new Error('Distinct user actions must be preserved');
      approved.push({ keep, remove, reason: item.reason });
    }
    if (!apply) {
      console.log(
        JSON.stringify({
          dryRun: true,
          reviewedPairs: approved.length,
          removed: 0,
        }),
      );
      return;
    }
    // Exclusive create refuses to overwrite an existing backup. Extended JSON preserves IDs/dates.
    fs.writeFileSync(backup, BSON.EJSON.stringify(approved, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    let removed = 0;
    for (const pair of approved) {
      if (!(await collection.findOne({ _id: pair.keep._id })))
        throw new Error('Keeper disappeared; stopped');
      const result = await collection.deleteOne({
        _id: pair.remove._id,
        createdAt: pair.remove.createdAt,
        updatedAt: pair.remove.updatedAt,
      });
      if (result.deletedCount !== 1)
        throw new Error('Record changed since review; stopped');
      removed++;
    }
    console.log(
      JSON.stringify({ dryRun: false, removed, backupWritten: true }),
    );
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error(
    `Reviewed cleanup stopped (${error.name}). Consult the backup if --apply was used.`,
  );
  process.exitCode = 1;
});
