import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { runRenderer } from './renderer';
import { UnrecoverableError } from 'bullmq';
import {
  MediaCommandError,
  safeMediaStderr,
} from '../media/utils/media-command-error';

async function main() {
  if (process.argv[2] === '--self-test') {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    const filters = execFileSync('ffmpeg', ['-filters'], { encoding: 'utf8' });
    for (const filter of ['subtitles', 'drawtext', 'overlay', 'amix'])
      if (!filters.includes(filter))
        throw new Error(`Missing FFmpeg filter: ${filter}`);
    execFileSync('fc-match', ['Noto Sans Arabic'], { stdio: 'ignore' });
    console.log('Renderer image preflight passed');
    return;
  }
  await runRenderer(process.argv[2] || '', process.env.AWS_BATCH_JOB_ID || '');
}
void main().catch((error: unknown) => {
  // Media diagnostics may contain signed URLs. Never print raw errors or manifests.
  console.error(
    'Renderer task failed; inspect Batch status and validate media/configuration',
  );
  console.error(
    JSON.stringify({
      exceptionType: error instanceof Error ? error.name : 'UnknownError',
      message:
        error instanceof Error ? safeMediaStderr(error.message) : undefined,
      stderr:
        error instanceof MediaCommandError
          ? safeMediaStderr(error.stderr)
          : undefined,
    }),
  );
  // Exit 2 is reserved for deterministic configuration/input failures; Batch must not retry it.
  process.exitCode = error instanceof UnrecoverableError ? 2 : 1;
});
