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
const { r2FailureDetails } = require('../dist/src/storage/r2-diagnostics');

async function inspect(
  jobId,
  batch,
  config,
  readManifest = false,
  compareCredentials = false,
  options = {},
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
    status: job.status,
    statusReason: r2FailureDetails({ message: job.statusReason }).message,
    containerReason: r2FailureDetails({ message: job.container?.reason }).message,
    logStreamName: job.container?.logStreamName,
    attempts: job.attempts?.map(attempt => ({ exitCode: attempt.container?.exitCode,
      reason: r2FailureDetails({ message: attempt.container?.reason }).message,
      statusReason: r2FailureDetails({ message: attempt.statusReason }).message,
      logStreamName: attempt.container?.logStreamName })),
    logConfiguration: definition.containerProperties?.logConfiguration,
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
      if (options.readArtifacts) {
        const task = JSON.parse(bytes.toString());
        const prefix = manifest.slice(0, -'/task.json'.length);
        const expectedKey = `${prefix}/output.mp4`;
        result.outputKeyMatchesManifest = task.outputKey === expectedKey;
        result.artifactChecks = [];
        const keys = [
          ...(task.kind === 'clip' && typeof task.sourceKey === 'string' ? [[task.sourceKey, 'source', true]] : []),
          [manifest, 'manifest', true], [expectedKey, 'batch_output', job.status === 'SUCCEEDED'],
          [`${prefix}/result.json`, 'result', job.status === 'SUCCEEDED'],
          [`${prefix}/progress.json`, 'progress', false], [`${prefix}/failure.json`, 'failure', false],
        ];
        for (const [objectKey, artifactType, expectedToExist] of keys) {
          const check = { event: 'r2.object_check', batchJobId: jobId,
            jobId: task.owner?.jobId ?? /^job-sources\/([a-f0-9]{24})\//.exec(task.sourceKey || '')?.[1],
            clipId: task.owner?.clipId, artifactType, objectKey, expectedToExist,
            bucket: /^(job-sources|source-videos)\//.test(objectKey) ? routing.R2_SOURCE_BUCKET_NAME || routing.R2_BUCKET_NAME : routing.R2_BUCKET_NAME };
          try { const info = await r2.objectInfo(objectKey); Object.assign(check, {statusCode:200,size:info.size}); }
          catch (error) { Object.assign(check,{statusCode:error.$metadata?.httpStatusCode,exceptionType:r2FailureDetails(error).exceptionType}); }
          result.artifactChecks.push(check);
        }
      }
    } finally {
      r2.client.destroy();
    }
  }
  if (options.readLogs) {
    const group = definition.containerProperties?.logConfiguration?.options?.['awslogs-group'];
    const stream = job.container?.logStreamName || job.attempts?.at(-1)?.container?.logStreamName;
    if (group && stream) {
      try {
        const response = JSON.parse(execFileSync('aws', ['logs','get-log-events','--log-group-name',group,
          '--log-stream-name',stream,'--limit','80','--region',job.jobDefinition.split(':')[3],
          '--output','json','--no-cli-pager'], {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,
          maxBuffer:2*1024*1024,windowsHide:true}));
        result.rendererLogErrors = (response.events || []).map(event => event.message)
          .filter(message => /fail|error|exception|cannot|invalid|font|ENOENT|notfound/i.test(message)).slice(-20)
          .map(message => r2FailureDetails({message}).message);
      } catch { result.rendererLogRead = 'unavailable; verify logs:GetLogEvents permission and AWS CLI'; }
    } else result.rendererLogRead = 'no log stream; inspect container startup failure reason';
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
    process.argv.includes('--read-manifest') || process.argv.includes('--read-artifacts'),
    process.argv.includes('--compare-credentials'),
    { readArtifacts: process.argv.includes('--read-artifacts'), readLogs: process.argv.includes('--read-logs') },
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
