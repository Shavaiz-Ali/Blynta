/* Run under the documented host deployment flock to serialize deployments. */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const backend = path.resolve(__dirname, '..');
function pm2(...args) {
  return execFileSync('pm2', args, { cwd: backend, encoding: 'utf8' });
}
function mediaProcesses() {
  return JSON.parse(pm2('jlist')).filter((entry) => {
    const script = String(entry.pm2_env.pm_exec_path).replaceAll('\\', '/');
    return (
      ['blynta-worker', 'worker-general'].includes(entry.name) ||
      /\/Blynta\/backend\/dist\/(?:src\/)?worker\.js$/i.test(script)
    );
  });
}
// startOrRestart alone does not remove old instance IDs or legacy aliases.
for (const entry of mediaProcesses()) pm2('delete', String(entry.pm_id));
pm2(
  'start',
  path.join(backend, 'ecosystem.config.js'),
  '--only',
  'blynta-worker',
);
const workers = mediaProcesses();
if (
  workers.length !== 1 ||
  workers[0].name !== 'blynta-worker' ||
  workers[0].pm2_env.status !== 'online'
) {
  throw new Error(
    'Expected exactly one online blynta-worker; inspect pm2 jlist',
  );
}
pm2('save');
console.log('Verified and saved exactly one blynta-worker process.');
