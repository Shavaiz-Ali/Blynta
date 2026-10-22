// Read-only. Use an existing authorized AWS shell; never prints environment or secret values.
// node -r dotenv/config scripts/inspect-batch-r2.cjs JOB_UUID [--read-manifest] [--compare-credentials]
require('reflect-metadata');
const {
  BatchClient,
  DescribeJobsCommand,
  DescribeJobDefinitionsCommand,
} = require('@aws-sdk/client-batch');
const { ConfigService } = require('@nestjs/config');
const { execFileSync } = require('node:child_process');
const { r2TargetId } = require('../dist/src/storage/r2-http-handler');
const { R2Service } = require('../dist/src/storage/r2.service');

async function inspect(
  jobId,
  batch,
  config,
  readManifest = false,
  compareCredentials = false,
) {
  if (!/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error('Invalid job ID');
  const job = (await batch.send(new DescribeJobsCommand({ jobs: [jobId] })))
    .jobs?.[0];
  if (!job?.jobDefinition) throw new Error('Job not found');
  const definition = (
    await batch.send(
      new DescribeJobDefinitionsCommand({
        jobDefinitions: [job.jobDefinition],
      }),
    )
  ).jobDefinitions?.[0];
  if (!definition) throw new Error('Definition not found');
  const names = ['R2_ENDPOINT', 'R2_BUCKET_NAME', 'R2_SOURCE_BUCKET_NAME'];
  const routing = Object.fromEntries(
    [
      ...(definition.containerProperties?.environment ?? []),
      ...(job.container?.environment ?? []),
    ]
      .filter(({ name }) => names.includes(name))
      .map(({ name, value }) => [name, value]),
  );
  const manifest = job.container?.command?.find((value) =>
    /^job-sources\/batch\/[a-f0-9]{64}\/task\.json$/.test(value),
  );
  const routeMatches = Object.fromEntries(
    names.map((name) => [name, routing[name] === config.get(name)]),
  );
  const secretMappings = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'].map(
    (name) => {
      const mapping = definition.containerProperties?.secrets?.find(
        (secret) => secret.name === name,
      );
      return {
        name,
        configured: !!mapping,
        selectsExpectedJsonField: mapping?.valueFrom?.split(':')[7] === name,
        plaintextEntryPresent: [
          ...(definition.containerProperties?.environment ?? []),
          ...(job.container?.environment ?? []),
        ].some((entry) => entry.name === name),
      };
    },
  );
  if (compareCredentials) {
    // Explicit operator-only comparison. Values stay in memory, with no fingerprints.
    for (const status of secretMappings) {
      const reference = definition.containerProperties?.secrets?.find(
        (entry) => entry.name === status.name,
      )?.valueFrom;
      if (!reference?.startsWith('arn:aws:secretsmanager:')) continue;
      const parts = reference.split(':');
      const args = [
        'secretsmanager',
        'get-secret-value',
        '--secret-id',
        parts.slice(0, 7).join(':'),
        '--region',
        parts[3],
        '--output',
        'json',
        '--no-cli-pager',
      ];
      if (parts[8]) args.push('--version-stage', parts[8]);
      if (parts[9]) args.push('--version-id', parts[9]);
      const payload = JSON.parse(
        execFileSync('aws', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 15000,
          maxBuffer: 2 * 1024 * 1024,
          windowsHide: true,
        }),
      );
      const value = parts[7]
        ? JSON.parse(payload.SecretString)[parts[7]]
        : payload.SecretString;
      status.referencedValueMatchesThisEC2Process =
        typeof value === 'string' && value === config.get(status.name);
      status.referencedValueHasR2Format =
        typeof value === 'string' &&
        (status.name === 'R2_ACCESS_KEY_ID'
          ? /^[a-f0-9]{32}$/i
          : /^[a-f0-9]{64}$/i
        ).test(value);
    }
  }
  let targetId;
  try {
    const url = new URL(routing.R2_ENDPOINT);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      manifest
    ) {
      targetId = r2TargetId({
        protocol: url.protocol,
        hostname: url.hostname,
        port: Number(url.port || 443),
        path: `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(routing.R2_SOURCE_BUCKET_NAME || routing.R2_BUCKET_NAME)}/${manifest}`,
      });
    }
  } catch {
    /* Never print the invalid endpoint. */
  }
  const result = {
    jobId,
    definition: job.jobDefinition,
    image: job.container?.image,
    exitCode: job.container?.exitCode,
    manifestArgumentValid: !!manifest,
    secretMappings,
    routingMatchesEC2: routeMatches,
    requestTargetId: targetId,
    // A mutable image tag in DescribeJobs is not historical image-digest proof.
    deployedDigestVerified: false,
    credentialComparisonScope: compareCredentials
      ? 'Currently referenced secret version versus this process; not proof of historical task or running worker values'
      : 'Not performed; mappings only',
    manifestReadAttempted: false,
  };
  if (readManifest) {
    if (!manifest || !targetId || !Object.values(routeMatches).every(Boolean))
      throw new Error('Job route differs from EC2; refusing a misleading read');
    result.manifestReadAttempted = true;
    const r2 = new R2Service(config);
    try {
      const bytes = await r2.downloadToBuffer(manifest, 2 * 1024 * 1024);
      result.manifestReadSucceededWithEC2Credentials = true;
      result.manifestBytes = bytes.length;
    } finally {
      r2.client.destroy();
    }
  }
  return result;
}
module.exports = { inspect };
if (require.main === module) {
  const batch = new BatchClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    maxAttempts: 1,
  });
  inspect(
    process.argv[2] || '',
    batch,
    new ConfigService(),
    process.argv.includes('--read-manifest'),
    process.argv.includes('--compare-credentials'),
  )
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        'Read-only Batch/R2 inspection failed; verify AWS access, compiled build, and matching routing. No secret values or raw errors printed.',
      );
      process.exitCode = 1;
    })
    .finally(() => batch.destroy());
}
