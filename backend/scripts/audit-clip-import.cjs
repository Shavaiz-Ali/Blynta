const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const config = {
  ...dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env'))),
  ...process.env,
};
const [jobId, clipId] = process.argv.slice(2);
if (![jobId, clipId].every((id) => /^[a-f\d]{24}$/i.test(id || '')))
  throw new Error('Supply job and clip ObjectIds');
(async () => {
  await mongoose.connect(config.MONGO_URI || config.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  });
  const job = await mongoose.connection.db
    .collection('jobs')
    .findOne(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { projection: { clips: 1, userId: 1, status: 1 } },
    );
  const clips = job?.clips || [];
  const { JobSchema } = require('../dist/src/jobs/schemas/job.schema');
  const JobModel = mongoose.models.Job || mongoose.model('Job', JobSchema);
  const modelJob = job
    ? await JobModel.findOne({ _id: jobId, userId: String(job.userId) }).exec()
    : null;
  const idOnlyJob = await JobModel.findById(jobId).exec();
  const filter = job
    ? JobModel.findOne({ _id: jobId, userId: String(job.userId) }).cast()
    : {};
  const clip = clips.find((clip) => String(clip._id) === clipId);
  const key =
    clip?.r2ObjectKey ||
    (clip?.outputUrl && !clip.outputUrl.includes('://')
      ? clip.outputUrl
      : undefined);
  console.log(
    JSON.stringify({
      jobId,
      clipId,
      jobFound: !!job,
      ownerId: String(job?.userId || ''),
      ownerBsonType: job?.userId?._bsontype || typeof job?.userId,
      objectIdOwnerLookupMatches: !!(
        job &&
        (await mongoose.connection.db.collection('jobs').findOne(
          {
            _id: job._id,
            userId: new mongoose.Types.ObjectId(String(job.userId)),
          },
          { projection: { _id: 1 } },
        ))
      ),
      clipFound: !!clip,
      mongooseCollection: JobModel.collection.name,
      schemaOwnerType: JobSchema.path('userId').instance,
      castOwnerType: filter.userId?._bsontype || typeof filter.userId,
      castJobIdType: filter._id?._bsontype || typeof filter._id,
      mongooseIdOnlyMatches: !!idOnlyJob,
      mongooseOwnerLookupMatches: !!modelJob,
      mongooseClipLookupMatches: !!modelJob?.clips.find(
        (clip) => String(clip._id).toLowerCase() === clipId,
      ),
      currentClipIds: clips.map((clip) => String(clip._id)),
      clipStatus: clip?.status,
      key,
      legacyOutputType: clip?.outputUrl?.includes('://')
        ? 'url'
        : 'key-or-absent',
    }),
  );
  if (key) {
    const client = new S3Client({
      endpoint: config.R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
      maxAttempts: 1,
    });
    try {
      const info = await client.send(
        new HeadObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: key }),
      );
      console.log(
        JSON.stringify({
          objectFound: true,
          size: info.ContentLength,
          contentType: info.ContentType,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          objectFound: false,
          error: error.name,
          status: error.$metadata?.httpStatusCode,
          code: error.code,
        }),
      );
    }
  }
})()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.name, code: error.code }));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
