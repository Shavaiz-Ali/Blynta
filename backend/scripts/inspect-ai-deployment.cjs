// Run on EC2. Read-only: no restarts, environment dumps, DB access, or credential checks.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { homedir } = require('node:os');
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
  } catch {
    return undefined;
  }
}
function buildInfo(root) {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(root, 'dist/build-info.json'), 'utf8'),
    );
    return {
      revision: /^[a-f0-9]{40}$/.test(value.revision)
        ? value.revision
        : 'unknown',
      artifactHash: /^[a-f0-9]{64}$/.test(value.artifactHash)
        ? value.artifactHash
        : 'unknown',
      sourceDirty: value.sourceDirty === true,
      builtAt: !Number.isNaN(Date.parse(value.builtAt))
        ? value.builtAt
        : undefined,
    };
  } catch {
    return { revision: 'unknown' };
  }
}
let processes = [];
try {
  const pm2Pid = Number(
    fs
      .readFileSync(
        path.join(
          process.env.PM2_HOME || path.join(homedir(), '.pm2'),
          'pm2.pid',
        ),
        'utf8',
      )
      .trim(),
  );
  if (!Number.isInteger(pm2Pid) || pm2Pid <= 0)
    throw new Error('PM2 daemon is not running');
  process.kill(pm2Pid, 0); // Probe only; do not start a PM2 daemon during an audit.
  processes = JSON.parse(run('pm2', ['jlist']) || '[]');
} catch {
  /* unavailable */
}
const apis = processes
  .filter((process) =>
    /(?:^|[/\\])main\.js$/.test(process.pm2_env?.pm_exec_path || ''),
  )
  .map((process) => {
    const env = process.pm2_env;
    const cwd = env.pm_cwd;
    const revision = run('git', ['rev-parse', 'HEAD'], { cwd })?.trim();
    const controller = path.join(
      cwd,
      'dist/src/ai-registry/registry.controllers.js',
    );
    let controllerHash = 'missing';
    try {
      controllerHash = createHash('sha256')
        .update(fs.readFileSync(controller))
        .digest('hex');
    } catch {
      /* older/missing artifact */
    }
    const diskBuild = buildInfo(cwd);
    return {
      name: process.name,
      pid: process.pid,
      status: env.status,
      script: env.pm_exec_path,
      cwd,
      execMode: env.exec_mode,
      configuredInstances: env.instances,
      startedAt: Number.isFinite(env.pm_uptime)
        ? new Date(env.pm_uptime).toISOString()
        : undefined,
      checkoutRevision:
        revision && /^[a-f0-9]{40}$/.test(revision) ? revision : 'unknown',
      onDiskBuild: diskBuild,
      controllerHash,
      warning:
        'Checkout and on-disk artifacts do not prove what an unrestarted process loaded. Compare the running /health build identity.',
    };
  });
const nginx = run('nginx', ['-T']) || run('sudo', ['-n', 'nginx', '-T']);
const proxy = nginx
  ?.split('\n')
  .filter((line) =>
    /^\s*(?:server_name|listen|proxy_pass|upstream)\b/.test(line),
  )
  .map((line) =>
    line
      .split('#')[0]
      .trim()
      .replace(/(https?:\/\/)[^\s/]+:[^\s/@]+@/gi, '$1[REDACTED]@')
      .replace(/\?[^;\s]+/g, '?[REDACTED]'),
  );
console.log(
  JSON.stringify(
    {
      apis,
      nginx: proxy || 'unavailable (requires permission to read configuration)',
      note: 'No API secrets, PM2 environment variables, response headers, or full nginx configuration are printed. Multiple API entries require checking each listener/upstream.',
    },
    null,
    2,
  ),
);
