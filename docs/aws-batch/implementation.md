# First-phase implementation delivery

Rendering remains **local by default**. No AWS resources, IAM attachments, images,
job-definition revisions or production flags were changed. Legacy Studio and
frontend files were not modified.

Read [architecture.md](architecture.md) for the existing pipeline and remote
boundary. Read [runbook.md](runbook.md) for environment variables, IAM, CodeBuild,
Batch smoke tests, ambiguous-submission recovery, retention and rollback.

## Created files

- `buildspec.yml`
- `backend/Dockerfile.renderer`
- `backend/Dockerfile.renderer.dockerignore`
- `backend/renderer-fonts/99-blynta.conf`
- `backend/renderer-fonts/Anton.ttf`
- `backend/renderer-fonts/Anton-OFL.txt`
- `backend/renderer-fonts/Montserrat.ttf`
- `backend/renderer-fonts/Montserrat-OFL.txt`
- `backend/renderer-fonts/README.md`
- `backend/scripts/batch-render-smoke.cjs`
- `backend/src/batch-render/batch-execution.schema.ts`
- `backend/src/batch-render/batch-render.module.ts`
- `backend/src/batch-render/batch-render.service.ts`
- `backend/src/batch-render/batch-render.service.spec.ts`
- `backend/src/batch-render/render-task.ts`
- `backend/src/batch-render/renderer.ts`
- `backend/src/batch-render/renderer.main.ts`
- `backend/src/batch-render/renderer.spec.ts`
- `backend/src/batch-render/renderer.integration.spec.ts`
- `backend/src/batch-render/edit-batch.spec.ts`
- `docs/aws-batch/architecture.md`
- `docs/aws-batch/backend-role-policy.json`
- `docs/aws-batch/job-definition.template.json`
- `docs/aws-batch/runbook.md`
- `docs/aws-batch/implementation.md`

## Modified files

- `backend/.env.example`: disabled-by-default rendering settings.
- `backend/package.json`: pinned SDK v3 Batch dependency and renderer build command.
- `backend/package-lock.json`: Batch client only; existing dependency pins retained.
- `backend/src/ai-editor/ai-editor.module.ts`: adapter module registration.
- `backend/src/ai-editor/edit-render.service.ts`: stage validated inputs and compiled
  graph, offload encoding, keep existing local path and post-render verification.
- `backend/src/common/configuration.ts`: validate execution mode.
- `backend/src/jobs/jobs-worker.module.ts`: adapter module registration.
- `backend/src/jobs/jobs.service.ts`: opt-in cancellation/retry-generation fence for
  remote clip publication; existing callers retain their behavior.
- `backend/src/jobs/jobs-cancellation.spec.ts`: publication race regression.
- `backend/src/jobs/render.processor.ts`: optional remote clip execution; retain
  local source cache, usage, timing, progress and completion workflow.
- `backend/src/jobs/render.processor.spec.ts`: remote success/failure regressions.
- `backend/src/media/services/clip-cutting.service.ts`: hide signed source URLs in logs.
- `backend/src/storage/r2.service.ts`: optional bounded buffer reads for manifests.
- `backend/src/storage/r2.service.spec.ts`: buffer-budget regression.

## Validation on 2026-10-19

- `npm run build`: passed (normal backend prebuild/build/postbuild).
- `npm run build:renderer`: passed, including contract checks and full Nest compile.
  This deliberately skips the API's Git-dependent postbuild stamp, because the
  image context excludes `.git`.
- `tsc --noEmit --pretty false`: passed, including test types.
- Targeted ESLint: passed for `src/batch-render`, `render.processor.ts`,
  `edit-render.service.ts`, `clip-cutting.service.ts` and `r2.service.ts`.
- Final Jest run: **15 suites, 146 tests passed, zero skips**. This includes 11
  opt-in tests using real local FFmpeg/FFprobe: nine existing editing media tests
  and two one-shot clip tests (with/without captions). No real AWS/R2 calls are
  made by unit tests; the one-shot integration uses a local R2 transport fixture.
- Parsed root CodeBuild YAML, job-definition JSON and IAM policy JSON; verified
  Batch dependency consistency between package and lock files.
- `git diff --check`: passed.

Reproduce the full validation test set in backend with FFmpeg/FFprobe on PATH.
For PowerShell:

```powershell
$env:EDIT_FFMPEG_PATH = (Get-Command ffmpeg).Source
$env:EDIT_FFPROBE_PATH = (Get-Command ffprobe).Source
node node_modules/jest/bin/jest.js --runInBand --silent batch-render render.processor.spec render-source.service.spec render-progress.spec edit-services.spec r2.service.spec configuration.spec jobs-cancellation.spec media-cancellation.spec clip-retry.spec jobs-reconciliation.service.spec ffmpeg-edit-renderer.integration.spec
```

In Linux/Bash set the two environment variables to `command -v ffmpeg` and
`command -v ffprobe`, then run the same Node command. Unit runs without these
variables intentionally skip media integration tests.

## Remaining deployment checks

Docker is not installed on the implementation host, so the AMD64 Linux image,
Debian packages/fonts, image preflight and ECR push have not been executed here.
Run the supplied CodeBuild workflow before using the new definition revision.
Real AWS Batch, Cloudflare R2 range reads, task networking, IAM attachments,
Secrets Manager injection and runtime limits require the staging smoke test.
No live EC2 IAM role was inspected or changed; an administrator must apply/verify
the documented policy on the actual media-worker instance role.

The Windows media tests exercised the real caption engine using local system
font fallback. Exact Linux font/glyph appearance requires the container smoke
test. Montserrat and Noto are included; Impact and Georgia use explicit Anton
and Liberation Serif substitutes unless licensed proprietary files are supplied.

Remote outputs are downloaded back for existing publication/verification; this
keeps the established data and billing workflow, at the cost of one extra short
output transfer. Edited source clips/assets are validated locally and staged once
per durable execution; clip tasks use R2 seeking rather than full long-video
downloads. Batch progress is sampled through private R2 objects every two seconds
and forwarded on the backend polling cadence. This phase does not add remote
FFmpeg CPU cost accounting or a new frontend status surface.

Ambiguous SubmitJob responses require operator reconciliation, by design, because
ordinary Batch SubmitJob has no idempotency token. They never trigger automatic
duplicate submission. Keep a reconciler running when rolling back until all
outstanding remote jobs have stopped.
