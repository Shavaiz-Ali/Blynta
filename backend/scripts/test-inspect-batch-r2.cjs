// Offline inspector regressions. No AWS, R2 or secret-manager requests.
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const id = '18539cf4-51fc-4d3f-8df4-b4aa9f3cdd21';
const key = `job-sources/batch/${'a'.repeat(64)}/task.json`;
const routing = {
  R2_ENDPOINT: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
  R2_BUCKET_NAME: 'blynta',
  R2_SOURCE_BUCKET_NAME: 'blynta',
};
const credentials = {
  R2_ACCESS_KEY_ID: '1'.repeat(32),
  R2_SECRET_ACCESS_KEY: '2'.repeat(64),
};
const secretArn =
  'arn:aws:secretsmanager:ap-south-1:123456789012:secret:fixture-AbCdEf';
const definitionArn =
  'arn:aws:batch:ap-south-1:123456789012:job-definition/fixture:7';
const environment = Object.entries(routing).map(([name, value]) => ({
  name,
  value,
}));
const job = {
  jobDefinition: definitionArn,
  container: {
    image: 'fixture:v3',
    environment,
    command: ['node', 'renderer.main.js', key],
    exitCode: 1,
  },
};
const definition = {
  containerProperties: {
    environment: [{ name: 'R2_ACCESS_KEY_ID', value: 'must-not-print-this' }],
    secrets: Object.keys(credentials).map((name) => ({
      name,
      valueFrom: `${secretArn}:${name}::`,
    })),
  },
};
const batch = {
  send: async (command) =>
    command.constructor.name === 'DescribeJobsCommand'
      ? { jobs: [job] }
      : { jobDefinitions: [definition] },
};
const config = { get: (name) => ({ ...routing, ...credentials })[name] };
const originalExec = childProcess.execFileSync;
let secretReads = 0;
childProcess.execFileSync = (command, args) => {
  assert.equal(command, 'aws');
  assert.equal(args[args.indexOf('--secret-id') + 1], secretArn);
  secretReads++;
  return JSON.stringify({ SecretString: JSON.stringify(credentials) });
};
async function main() {
  const { inspect } = require('./inspect-batch-r2.cjs');
  const metadata = await inspect(id, batch, config);
  assert.equal(secretReads, 0);
  assert.equal(metadata.definition, definitionArn);
  assert.equal(metadata.manifestArgumentValid, true);
  assert.deepEqual(Object.values(metadata.routingMatchesEC2), [
    true,
    true,
    true,
  ]);
  const comparison = await inspect(id, batch, config, false, true);
  assert.equal(secretReads, 2);
  assert(
    comparison.secretMappings.every(
      (entry) =>
        entry.referencedValueMatchesThisEC2Process &&
        entry.referencedValueHasR2Format &&
        entry.selectsExpectedJsonField,
    ),
  );
  assert.equal(comparison.secretMappings[0].plaintextEntryPresent, true);
  const serialized = JSON.stringify(comparison);
  for (const value of [
    ...Object.values(credentials),
    'must-not-print-this',
    key,
    secretArn,
  ])
    assert(!serialized.includes(value));
  await assert.rejects(
    inspect(id, batch, { get: () => 'different-route' }, true),
    /route differs/,
  );
  await assert.rejects(inspect('invalid-id', batch, config), /Invalid job ID/);
  console.log(
    'Read-only Batch inspector: metadata, routing, private credential comparison and redaction passed (synthetic data only).',
  );
}
main()
  .catch(() => {
    console.error('Offline inspector regression failed; raw fixtures omitted.');
    process.exitCode = 1;
  })
  .finally(() => {
    childProcess.execFileSync = originalExec;
  });
