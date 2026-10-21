import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { runRenderer } from './renderer';
import { UnrecoverableError } from 'bullmq';
import { r2FailureDetails } from '../storage/r2-diagnostics';
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
  const safeDiagnostic = (text: string) =>
    safeMediaStderr(
      [process.env.R2_SECRET_ACCESS_KEY, process.env.R2_ACCESS_KEY_ID]
        .filter((value): value is string => !!value)
        .sort((a, b) => b.length - a.length)
        .reduce(
          (message, credential) =>
            message.split(credential).join('[CREDENTIAL]'),
          text,
        ),
    );
  // Media diagnostics may contain signed URLs. Never print raw errors or manifests.
  console.error(
    'Renderer task failed; inspect Batch status and validate media/configuration',
  );
  console.error(
    JSON.stringify({
      ...r2FailureDetails(error),
      stderr:
        error instanceof MediaCommandError
          ? safeDiagnostic(error.stderr)
          : undefined,
    }),
  );
  // Exit 2 is reserved for deterministic configuration/input failures; Batch must not retry it.
  process.exitCode = error instanceof UnrecoverableError ? 2 : 1;
});
