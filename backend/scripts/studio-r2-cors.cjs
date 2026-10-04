// Inspect with `node scripts/studio-r2-cors.cjs <exact-origin> ...`.
// Add the application rule with --apply; existing rules are preserved.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const {
  S3Client,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = {
  ...dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env'))),
  ...process.env,
};
const origins = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (
  !origins.length ||
  origins.some((origin) => {
    const url = new URL(origin);
    return url.origin !== origin || !['https:', 'http:'].includes(url.protocol);
  })
)
  throw new Error('Supply exact application origins');
const client = new S3Client({
  endpoint: config.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 1,
});
(async () => {
  if (process.argv.includes('--probe')) {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: 'studio/cors-preflight-check',
        ContentType: 'video/mp4',
      }),
      { expiresIn: 300 },
    );
    for (const origin of origins) {
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      console.log(
        JSON.stringify({
          origin,
          status: response.status,
          allowOrigin: response.headers.get('access-control-allow-origin'),
          allowMethods: response.headers.get('access-control-allow-methods'),
        }),
      );
    }
    return;
  }
  let rules = [];
  try {
    rules =
      (
        await client.send(
          new GetBucketCorsCommand({ Bucket: config.R2_BUCKET_NAME }),
        )
      ).CORSRules || [];
  } catch (error) {
    if (
      error.name !== 'NoSuchCORSConfiguration' &&
      error.$metadata?.httpStatusCode !== 404
    )
      throw error;
  }
  console.log(
    JSON.stringify({
      bucket: config.R2_BUCKET_NAME,
      existingRules: rules,
      requiredOrigins: origins,
    }),
  );
  if (!process.argv.includes('--apply')) return;
  const id = 'blynta-studio-browser-media';
  const prior = rules.find((rule) => rule.ID === id);
  const rule = {
    ID: id,
    AllowedOrigins: [
      ...new Set([...(prior?.AllowedOrigins || []), ...origins]),
    ],
    AllowedMethods: ['PUT', 'GET', 'HEAD'],
    AllowedHeaders: ['Content-Type', 'Range'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
    MaxAgeSeconds: 3600,
  };
  await client.send(
    new PutBucketCorsCommand({
      Bucket: config.R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [...rules.filter((rule) => rule.ID !== id), rule],
      },
    }),
  );
  const applied = await client.send(
    new GetBucketCorsCommand({ Bucket: config.R2_BUCKET_NAME }),
  );
  console.log(JSON.stringify({ appliedRules: applied.CORSRules }));
})().catch((error) => {
  console.error(
    JSON.stringify({
      error: error.name,
      status: error.$metadata?.httpStatusCode,
      code: error.code,
    }),
  );
  process.exitCode = 1;
});
