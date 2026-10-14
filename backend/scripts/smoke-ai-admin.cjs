// Read-only authenticated smoke check. Supply an existing admin token through
// AI_SMOKE_ADMIN_TOKEN in the process environment, never command-line arguments.
const assert = require('node:assert/strict');

async function smoke() {
  const base = new URL(process.env.AI_SMOKE_BASE_URL || '');
  assert.ok(
    base.protocol === 'https:' ||
      (base.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(base.hostname)),
    'Use HTTPS or a local test server',
  );
  assert.ok(
    !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      base.pathname === '/',
    'Specify only the backend origin',
  );
  const token = process.env.AI_SMOKE_ADMIN_TOKEN;
  assert.ok(
    token,
    'AI_SMOKE_ADMIN_TOKEN is required; use an existing administrator session',
  );
  const expected = process.env.AI_SMOKE_EXPECTED_REVISION;
  if (expected)
    assert.match(
      expected,
      /^[a-f0-9]{40}$/,
      'Use a complete expected commit SHA',
    );
  const builds = [];
  for (let i = 0; i < 3; i++) {
    const health = await fetch(new URL('/health', base), {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(health.status, 200, 'Health request failed');
    const body = await health.json();
    const build = body.data?.build;
    const revision =
      typeof build?.revision === 'string' &&
      /^[a-f0-9]{40}$/.test(build.revision)
        ? build.revision
        : 'unknown';
    const artifactHash =
      typeof build?.artifactHash === 'string' &&
      /^[a-f0-9]{64}$/.test(build.artifactHash)
        ? build.artifactHash
        : 'unknown';
    if (expected) {
      assert.equal(
        revision,
        expected,
        'Running revision does not match the expected commit',
      );
      assert.equal(
        build?.sourceDirty,
        false,
        'Deployed build contains uncommitted changes',
      );
    }
    builds.push(artifactHash);
  }
  assert.equal(
    new Set(builds).size,
    1,
    'Different build artifacts are serving health requests',
  );
  const unauthenticated = await fetch(new URL('/admin/ai/adapters', base), {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(
    unauthenticated.status,
    401,
    'Unauthenticated adapters must return 401, not 404',
  );
  const response = await fetch(new URL('/admin/ai/adapters', base), {
    headers: { authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, 'Authenticated adapters route failed');
  const body = await response.json();
  assert.equal(body.success, true, 'Unexpected API envelope');
  assert.ok(
    body.data?.items?.some(
      (item) => item.adapter === 'google' && item.implemented === true,
    ),
    'Google adapter is missing',
  );
  console.log(
    JSON.stringify({
      message: 'Authenticated AI adapters smoke check passed',
      revision: expected || 'not asserted',
      artifactHash: builds[0],
    }),
  );
}
smoke().catch((error) => {
  // Never print error objects, response bodies, headers, or the token.
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : 'AI admin smoke check failed; check connectivity and test configuration.',
  );
  process.exitCode = 1;
});
