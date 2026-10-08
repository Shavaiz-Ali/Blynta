const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const backend = path.resolve(__dirname, '..');
const config = require('../ecosystem.config');
assert.strictEqual(require('../ecosystem.comfig'), config);
const media = config.apps.filter((app) => app.script.endsWith('/worker.js'));
assert.equal(media.length, 1);
assert.equal(media[0].instances, 1);
assert.equal(media[0].exec_mode, 'fork');
assert.equal(media[0].env.RENDER_GLOBAL_CONCURRENCY, '1');
assert.equal(media[0].env.MEDIA_HOST_CONCURRENCY, '1');
for (const app of config.apps)
  assert(fs.existsSync(path.join(backend, app.script)), app.script);
let list = [
  {
    name: 'blynta-worker',
    pm_id: 2,
    pm2_env: { pm_exec_path: '/home/ec2-user/Blynta/backend/dist/worker.js' },
  },
  {
    name: 'blynta-worker',
    pm_id: 3,
    pm2_env: { pm_exec_path: '/home/ec2-user/Blynta/backend/dist/worker.js' },
  },
  {
    name: 'worker-general',
    pm_id: 4,
    pm2_env: { pm_exec_path: '/home/ec2-user/Blynta/backend/dist/worker.js' },
  },
  {
    name: 'blynta-api',
    pm_id: 1,
    pm2_env: { pm_exec_path: '/home/ec2-user/Blynta/backend/dist/main.js' },
  },
];
let saves = 0;
const source = fs.readFileSync(
  path.join(__dirname, 'restart-media-worker.cjs'),
  'utf8',
);
function restart() {
  vm.runInNewContext(source, {
    __dirname,
    console: { log() {} },
    require(name) {
      if (name !== 'node:child_process') return require(name);
      return {
        execFileSync(command, args) {
          assert.equal(command, 'pm2');
          if (args[0] === 'jlist') return JSON.stringify(list);
          if (args[0] === 'delete')
            list = list.filter((p) => p.pm_id !== Number(args[1]));
          if (args[0] === 'start')
            list.push({
              name: 'blynta-worker',
              pm_id: 5,
              pm2_env: {
                pm_exec_path:
                  '/home/ec2-user/Blynta/backend/dist/src/worker.js',
                status: 'online',
              },
            });
          if (args[0] === 'save') saves++;
          return '';
        },
      };
    },
  });
  assert.deepEqual(list.map((p) => p.name).sort(), [
    'blynta-api',
    'blynta-worker',
  ]);
}
restart();
restart();
assert.equal(saves, 2);
console.log(
  'PASS canonical PM2 config, compiled entrypoints, duplicate/legacy cleanup and repeated restart (PM2 CLI fixture)',
);
