/* Actual FFmpeg shutdown test; no database or production environment needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  runCommandWithProgress,
} = require('../dist/src/media/utils/run-command-with-progress');
const {
  ProcessRegistryService,
} = require('../dist/src/common/services/process-registry.service');
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blynta-shutdown-test-'));
  process.env.MEDIA_HOST_LOCK_DIR = path.join(root, 'locks');
  process.env.MEDIA_HOST_CONCURRENCY = '1';
  const registry = new ProcessRegistryService();
  const binary = process.env.MEDIA_TEST_FFMPEG || 'ffmpeg';
  const args = (seconds, name) => [
    '-re',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=160x90:rate=10',
    '-t',
    String(seconds),
    '-c:v',
    'libx264',
    '-progress',
    'pipe:1',
    '-y',
    path.join(root, name),
  ];
  let shutdown, signalled;
  await assert.rejects(
    runCommandWithProgress(
      binary,
      args(15, 'interrupted.mp4'),
      (line) => {
        if (line.startsWith('out_time_us=') && !shutdown) {
          signalled = Date.now();
          shutdown = registry.killAll(100);
        }
      },
      registry,
    ),
  );
  assert(shutdown, 'shutdown occurred during actual FFmpeg progress');
  await shutdown;
  assert(Date.now() - signalled < 5000, 'shutdown must be bounded');
  assert.throws(() => registry.assertRunning(), /shutting down/);
  const start = Date.now();
  await runCommandWithProgress(
    binary,
    args(0.2, 'recovered.mp4'),
    () => {},
    new ProcessRegistryService(),
  );
  assert(
    Date.now() - start < 5000,
    'interrupted FFmpeg must release the host slot',
  );
  assert(fs.statSync(path.join(root, 'recovered.mp4')).size > 0);
  console.log(
    'PASS actual FFmpeg interrupted during progress, shutdown under 5s, next command acquired slot and completed',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
