// Read-only. Never removes history, creates indexes, or prints connection secrets.
const path = require('node:path');
const { MongoClient } = require('mongodb');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    readPreference: 'secondaryPreferred',
  });
  try {
    await client.connect();
    const collection = client.db().collection('activities');
    const indexes = await collection.listIndexes().toArray();
    const keys = await collection
      .aggregate(
        [
          { $match: { dedupeKey: { $type: 'string' } } },
          {
            $group: {
              _id: '$dedupeKey',
              count: { $sum: 1 },
              type: { $first: '$type' },
            },
          },
          { $match: { count: { $gt: 1 } } },
          {
            $group: {
              _id: '$type',
              groups: { $sum: 1 },
              excessRows: { $sum: { $subtract: ['$count', 1] } },
            },
          },
        ],
        { maxTimeMS: 30000, allowDiskUse: true },
      )
      .toArray();
    // Nearby identical rows are candidates, not proof: separate clicks can be legitimate.
    const nearby = await collection
      .aggregate(
        [
          {
            $set: {
              identity: {
                userId: '$userId',
                type: '$type',
                entityId: '$entityId',
                jobId: '$metadata.jobId',
                clipId: '$metadata.clipId',
                title: '$title',
                description: '$description',
              },
            },
          },
          {
            $setWindowFields: {
              partitionBy: '$identity',
              sortBy: { createdAt: 1 },
              output: {
                previousCreatedAt: { $shift: { output: '$createdAt', by: -1 } },
              },
            },
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$previousCreatedAt', null] },
                  {
                    $lte: [
                      { $subtract: ['$createdAt', '$previousCreatedAt'] },
                      60000,
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$type',
              nearbyIdenticalRows: { $sum: 1 },
              firstSeen: { $min: '$createdAt' },
              lastSeen: { $max: '$createdAt' },
            },
          },
          { $sort: { nearbyIdenticalRows: -1 } },
        ],
        { maxTimeMS: 30000, allowDiskUse: true },
      )
      .toArray();
    console.log(
      JSON.stringify(
        {
          readOnly: true,
          total: await collection.countDocuments({}, { maxTimeMS: 30000 }),
          uniqueEventIndexPresent: indexes.some(
            (index) =>
              index.name === 'activities_dedupe_key_unique' &&
              index.unique === true &&
              index.sparse === true,
          ),
          provenRepeatedEventKeys: keys,
          nearbyIdenticalCandidatesWithin60Seconds: nearby,
          note: 'Candidate counts cannot distinguish preview requests, retries, and intentional repeat clicks in legacy data without correlation IDs. No deletion is justified solely by timestamps.',
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error(
    `Read-only activity audit failed (${error.name}); no history changed.`,
  );
  process.exitCode = 1;
});
