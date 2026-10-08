# Media processing refactor report

Code and mocked lifecycle checks are implemented. Live Mongo/Redis/FFmpeg integration, worker-kill recovery, output-quality verification, and the performance matrix could not run in this workspace. See the evidence and run commands below; no throughput improvement is claimed without measurements.

## 1–3. Existing architecture and exact bottlenecks

The pre-change investigation is in [media-processing-audit.md](media-processing-audit.md). Submission already created one independent `clip-video` BullMQ job per Mongo Job. The dedicated worker already had **hardcoded concurrency 2**. There was no single-video mutex; worker slots remained occupied through download, audio extraction, transcription, highlights, and every clip's rendering. Thus the claimed universal one-video limit was not supported by the code, but pipeline occupancy was unnecessarily long.

The exact clip bottleneck was `JobsProcessor`'s awaited loop over cut → caption → upload, followed by whole-array clip writes. That loop is removed. Queueing clips now releases the video worker slot while render workers handle those clips independently.

## 4. Files changed by this refactor

Paths are relative to the repository root. Concurrent frontend edits outside the job contract belong to other work and are excluded from this list.

| Area | Files |
| --- | --- |
| Pipeline, queue config, API, lifecycle | `backend/src/jobs/jobs.constants.ts`, `jobs.processor.ts`, `jobs.service.ts`, `jobs.controller.ts`, `jobs.module.ts`, `jobs-worker.module.ts`, `jobs-reconciliation.service.ts` |
| New rendering/lifecycle services | `backend/src/jobs/render.processor.ts`, `render-source.service.ts`, `render-progress.ts`, `jobs-completion.service.ts` |
| Schemas | `backend/src/jobs/schemas/job.schema.ts`, `source-video.schema.ts` |
| Media reuse and inspection | `backend/src/media/media.module.ts`, new `media-render.module.ts`, `services/media-inspection.service.ts`, `services/source-video.service.ts`, `services/clip-cutting.service.ts`, `services/caption-burning.service.ts`, `utils/ffmpeg-progress.ts`, `utils/run-command-with-progress.ts` |
| Existing Studio probe reuse | `backend/src/studio/studio.processor.ts` |
| Completion email dedupe | `backend/src/mail/mail.service.ts` |
| Worker startup and environment | `backend/src/worker.ts`, `backend/package.json`, `backend/.env.example` |
| Minimal frontend contract | `apps/app/features/jobs/types.ts` |
| Tests | `backend/src/jobs/jobs.constants.spec.ts`, `jobs-media.service.spec.ts`, `render.processor.spec.ts`, `render-progress.spec.ts`, `render-source.service.spec.ts`; `backend/src/media/services/media-inspection.service.spec.ts`; `backend/src/media/utils/ffmpeg-progress.spec.ts` |
| Local fixture harness and documentation | `backend/scripts/media-load-test.cjs`, `backend/docs/media-processing-audit.md`, this report |

## 5–8. Queues, job types, and concurrency

* Reused pipeline queue: `clip-jobs`, job type `clip-video`, payload `{ jobId }`, ID `pipeline-<jobId>`.
* New render queue: `clip-renders`, job type `render-clip`, payload `{ jobId, clipId }`, ID `render-<jobId>-<clipId>`.
* `PIPELINE_CONCURRENCY` and `RENDER_CONCURRENCY` are independent integers from 1 through 8. Both default to **1**, deliberately conservative. Invalid values fail worker startup. Workers start consuming only after their configured capacity is set.
* `MEDIA_WORKER_ROLE=all|pipeline|render|studio` selects consumers. `all` preserves the existing general worker plus Studio. Render-only workers import media rendering services without constructing Groq/LLM clients.
* No processes are spawned according to queue size. Limits are **per worker process**. Total CPU demand also includes pipeline audio extraction/transcription, existing Studio concurrency, and any other manually started worker processes. FFmpeg's existing encoder threading is preserved.

BullMQ's concurrency behavior and retained job IDs are described in the official [concurrency documentation](https://docs.bullmq.io/guide/workers/concurrency) and [job ID documentation](https://docs.bullmq.io/guide/jobs/job-ids). IDs use hyphens because colons are not supported in custom BullMQ IDs.

## 9–10. Metadata and workload

The existing bounded JSON probe used by Studio is now `MediaInspectionService`. It normalizes duration, dimensions, rational FPS, video codec, bitrate, file size, audio codec/sample rate, and audio/video presence. Raw ffprobe data stays inside the inspection service. Attached cover art is excluded from video detection.

Metadata is stored in `Job.mediaMetadata` and shared `SourceVideo.mediaMetadata`; existing `videoDuration` remains compatible. Probe/source persistence occurs before transcription, and subsequent stages reuse those results. Existing audio-duration probing for Groq's separate audio file remains unchanged.

`estimateVideoWorkload` is a relative 10-minute 1080p30 score using duration × pixels × FPS × codec factor × required crop/caption operations. It emits small/medium/large classification. Bitrate/file size remain available metrics rather than being used as the sole compute proxy. The score never changes worker capacity or launches workers.

## 11. FFmpeg progress

Cutting and captioning retain their two separate passes. Combining them could change the existing double-encode output, so that optimization was deferred. The original cut/crop/scale/x264/AAC/faststart arguments, ASS generation/styles, and caption audio-copy behavior are preserved.

Both services now use the existing registered subprocess runner with `-progress pipe:1 -nostats`. The parser processes complete key/value blocks, calculates seconds from `out_time_us / 1_000_000`, clamps percentage to 0–100, and exposes frame/FPS/speed. ETA is remaining media seconds / speed only after at least one processed second and a finite positive speed sample.

Each render worker serializes/throttles BullMQ progress writes to approximately **750ms**, forcing stage/terminal updates. FFmpeg progress does not write Mongo. Mongo stores durable clip transitions and results. Existing pipeline/Groq transcription progress behavior is retained; new render progress never uses simulated timers.

The authorized existing job detail/list endpoints add `render` with `ready`, `failed`, `total`, `progressPercent`, and per-clip progress, processed time, duration, speed, and ETA where available. Terminal history does not require Redis progress reads. Parent progress weights each clip by duration and uses separate cut/caption work weights, with upload/ready transitions. The existing parent status `cutting_clips` remains the rendering phase so existing polling continues to work.

## 12–13. Parent lifecycle, retries, and idempotency

1. Persist normalized source metadata and an R2 source key.
2. Persist transcript/highlights using existing services/resume behavior.
3. Atomically persist the complete clip manifest with stable existing clip IDs.
4. Enqueue each unfinished clip independently. Partial enqueue failure is recoverable from that manifest.
5. Finish the Bull pipeline execution, releasing its slot; the **Mongo parent stays `cutting_clips`**.
6. Update each clip through a positional Mongo update rather than replacing sibling records.
7. Finalize only when every required clip is completed or terminally failed. The final Mongo update includes a conditional all-terminal check.

All required clips ready → parent `completed`. Any failed clip → parent `failed`, with an explicit failed count; ready clips remain downloadable. This deliberately tightens the old any-success-is-complete behavior to satisfy the requested partial-failure semantics. Clip `status` remains compatible with `JobStatus`; `processingState` adds queued/cutting/captioning/uploading/ready/failed detail.

Jobs have three BullMQ attempts with exponential backoff starting at 2 seconds. Processors rethrow errors instead of swallowing them. A failed render retries only that clip. The manual retry endpoint claims a failed parent atomically, resets only failed clip states, and retries existing child jobs without charging or re-running the pipeline. Durable pipeline/render retry markers let reconciliation repair interruption during enqueue/retry.

Stable queue IDs prevent duplicate queued jobs. Queue records remain retained to preserve those identities. Stable object keys prevent duplicate R2 objects. A retry HEAD-checks its final clip key and restores Mongo readiness if an atomic R2 PUT succeeded before a crash; it does not encode or upload again. Successfully persisted clips skip rendering entirely.

Worker lock/stall behavior remains 60-second locks, 30-second checks, and one permitted stall. Failed events and five-minute reconciliation persist exhausted/stalled failures. Reconciliation consults actual queue state instead of treating 30 minutes without Mongo progress as proof of failure. Conditional failure updates cannot overwrite a clip that became ready after a reconciliation snapshot.

## 14. Storage and cleanup

YouTube sources reuse the existing shared `source-videos/<externalId>/video.mp4` key. Other sources use `job-sources/<jobId>/video.mp4`. Render workers can reconstruct from these durable references on another host. Transcript/highlights/styles are read from Mongo rather than embedded in Redis jobs.

Pipeline directories remain job-specific. Every render attempt gets a unique `renders/<jobId>-<clipId>-<random>/` directory. A per-process source cache coalesces concurrent downloads into isolated `render-sources/<jobId>-<pid>-<random>/` directories. Reference counts prevent a finishing clip from deleting another active clip's source. Cache misses always retrieve R2 media; cache state is not required for recovery.

Pipeline temp files are removed after durable fan-out. Render attempt files are removed in finally. Terminal source leases are removed when unused; idle cache entries expire after ten minutes. A nightly sweep removes seven-day-old abandoned render/source workspaces only for terminal/missing parents with no active Bull job, using contained directories and excluding symlinks. Failed pipeline resume directories retain their existing seven-day cleanup policy.

Shared SourceVideo R2 cache is never deleted by job deletion. Owned non-YouTube job source keys are deleted with the job. Sources otherwise remain available for retries; a broader source/object retention policy is still needed for long-lived job history.

## 15–16. Credits, notifications, cancellation, and environment

Credits stay at the submission boundary, using the existing atomic conditional user decrement. Workers, automatic retries, fan-out, and manual resume never deduct credits. Pricing is unchanged. HTTP re-submission is still a new job, not an idempotent request keyed by an API client token.

Completion uses existing notification/activity database dedupe keys. Completion/failure emails get stable retained Bull IDs. `completionPublished` is set after enqueueing all completion effects; reconciliation can replay interrupted publication safely. Ready uploads are not rendered again when publication fails. Partial-failure notifications explicitly say that ready clips remain available. SMTP/provider delivery still has the existing at-least-once delivery limitation; queue enqueue deduplication is not a provider-level exactly-once guarantee.

There was no user cancellation API to migrate. Job/clip deletion rejects active parents, preventing deletion of outputs required by running children. No auth/SSO architecture change or frontend redesign was introduced by this refactor.

Environment settings:

```dotenv
PIPELINE_CONCURRENCY=1
RENDER_CONCURRENCY=1
MEDIA_WORKER_ROLE=all
RECONCILE_IN_WORKER=true
STORAGE_ROOT=/var/blynta/storage
```

The first three settings are new. Existing reconciliation/storage settings are documented in `.env.example`; reconciliation defaults to enabled in the worker. On Windows, set STORAGE_ROOT to a writable local path. To exercise overlapping work, explicitly set both concurrency values to 2. No production capacity selection is implied.

## 17. Local verification evidence

* Focused media/jobs checks: **41 tests passed in 10 suites**. Media commands/R2/queue models are mocked for processor unit tests; filesystem cache tests use actual isolated temporary files.
* Backend TypeScript check and Nest build passed.
* App TypeScript check passed after the minimal job contract changes.
* Changed backend TypeScript files pass ESLint. Repository-wide lint reports **737 errors and 92 warnings in unchanged areas**.
* Full backend suite: **184 passed, 2 failed (186 total; 30 passing suites, 2 failing suites)**. The two unchanged failures are: `app.controller.spec.ts` lacks the `DatabaseConnection` provider mock; `notifications.service.spec.ts` expects a returned read status that its mock does not provide. These files/services were not edited by this refactor.
* Harness syntax check passed. Live harness startup failed with `spawn EPERM` for the media-tool preflight. FFmpeg/FFprobe were not found on PATH, and localhost Redis 6379 / MongoDB 27017 were not reachable. No real media performance or worker-kill result is claimed.

| Requested test | Evidence / remaining live check |
| --- | --- |
| A: multiple videos | Configurable pipeline slots implemented; three-video real-queue fixture assertion awaits prerequisites. |
| B: six independent clips | Mock queue fan-out/deduplication tests pass; fixture asserts 18 jobs across three parents. |
| C: render cap of two | Worker startup/config tests pass; fixture measures simultaneous render slots and checks the bound. |
| D: cross-video renders | The production render processor handles clips from two videos concurrently with mocked media; ordinal priority and fixture scheduling assertion cover eligibility. Live FFmpeg overlap remains unrun. |
| E: real progress | Microseconds/speed/ETA parser tests pass; live fixture checks actual FFmpeg processed-time events. |
| F: one-clip retry | Forced cut failure unit test retries only that clip and skips completed siblings; `--retry` tests real Bull backoff. |
| G: duplicates | Manifest/queue IDs, sibling update isolation, ready-output replay, R2-before-Mongo recovery, and publication replay tests pass. Fixture checks charge/mail/object/job identities against live Mongo/Redis. |
| H: worker crash | Exhausted-worker failure handling and durable recovery unit tests pass. `--crash` kills a test render process and asserts Bull stall reclaim; not run here. |
| I: parent completion | All-terminal checks, partial failure, weighted progress, and stale-failure guard tests pass. |
| J: cleanup | Actual filesystem lease tests verify shared source survival, isolated videos, eviction, and failed download recovery. |

## 18. Local load/performance mechanism

From `backend`, with localhost Mongo/Redis and FFmpeg/FFprobe on PATH:

```powershell
npm run test:media:local
npm run test:media:local -- --retry
npm run test:media:local -- --crash
npm run test:media:local -- --matrix
```

The harness generates a 60-second fixture, submits three videos with six clips each, and uses the actual processors, Job schema/JobsService, Mongo, BullMQ and FFmpeg. AI responses are fixtures, R2 is a disk-backed adapter, and user/notification/activity services are in-memory adapters; it verifies credit-deduction call counts rather than real user balances. Mail jobs use a real isolated Bull queue without sending email. It incurs no AI/email/R2 network traffic. Each run uses a unique test-only Mongo database and Redis prefix and cleans only those resources. It ignores production `.env` connection settings and connects to localhost; `MEDIA_TEST_REDIS_PORT` / `MEDIA_TEST_MONGO_PORT` can select local test ports.

The matrix covers pipeline concurrency 1, 2, 3 crossed with render concurrency 1, 2. It records pipeline/render throughput, queue wait, FFmpeg speed samples, system CPU percentage, system used RAM, Node RSS, observed concurrency, render order, and real progress event counts to `backend/media-load-results.json`. System CPU/RAM include other apps; Node RSS excludes FFmpeg child memory. External ingestion/transcription/AI performance and R2 network costs require a separate realistic environment run.

**Performance observations:** no matrix measurements are available here. Default capacities remain 1/1. The structural improvement is shorter pipeline slot occupancy and independent child eligibility, not a measured throughput claim.

## 19. Remaining limitations / migration

* Ordinal priorities permit a later video's first clips to precede an earlier video's later waiting clips. Scheduling is non-preemptive, not strict user-level fairness; sustained arrivals can delay higher ordinals. Add quotas/group scheduling later if measurements justify it.
* Limits are per process, not global across all workers. Studio has its existing separate capacity. Budget total processes/concurrency together.
* Retained queue/email IDs protect deduplication but consume Redis history. Add coordinated retention/tombstone cleanup after deciding job/source retention semantics.
* Completion recovery runs every five minutes and assumes Mongo/Redis are available again. Clip retries restart an interrupted encode; they do not resume partial FFmpeg output.
* Actual FFmpeg output/caption quality, live concurrency/retry/crash recovery, external ingestion, and performance remain unverified in this environment.
* Drain/stop old general workers before starting this version. Mixing the old whole-array/sequential writer with new render workers on the same parent is unsafe. Existing numeric jobs can be drained; new processing preserves existing clip IDs and ready object keys.

## 20. Later production worker scaling

Provision shared Redis/BullMQ, Mongo and R2 access; supply independent local temp storage and media binaries. Start additional instances with `MEDIA_WORKER_ROLE=pipeline` or `render` and a bounded per-instance concurrency. Jobs contain durable IDs and media references, so they can be consumed on another host without a shared disk or pipeline redesign.

Production infrastructure still needs resource budgets, worker health/graceful shutdown, queue-wait/throughput metrics, source/history retention, and infrastructure-level scaling policy. AWS/ECS/Kubernetes/Docker orchestration and autoscaling were not implemented.


## October 9: Caption and highlight fixes

### Incident evidence and verification limits

Read-only inspection of job `6ac7d47f0203cb83c6e452d1` found a completed 3237.661-second source, 817 readable English transcript segments, one persisted highlight (90–138 seconds) and one completed captioned clip. An independently decoded frame from its downloaded MP4 contains square boxes. The defect is burned into the video and occurs downstream of transcription; no player change is needed. The original ASS file and EC2 FFmpeg/font logs are not retained in accessible records. The precise missing font or Fontconfig configuration on that worker has not been verified.

The local Ubuntu 24.04 worker equivalent has FFmpeg 6.1.1 with libass, Fontconfig, FriBidi and HarfBuzz. Its initial font set lacks Hindi and some Urdu glyphs. Missing-font rendering was reproduced; supplied official Noto fonts plus explicit script-font selection render correctly. Merely supplying a fonts directory is insufficient for reliable fallback to an otherwise unregistered script font, so Hindi/Arabic runs select their matching Noto family explicitly. Latin typography, color, outline and positioning retain the selected style. Script text size is normalized to a comparable visible height. Font binaries are QA-only and are not committed.

For the representative production job, the count is already one at persisted highlight detection, before fan-out. It is a legacy job with no V2 authorization, so V2 output-budget filtering cannot explain this incident. Historical raw LLM responses and intermediate counts are unavailable; whether the provider returned one candidate, earlier filtering removed others, or a low-count cache was reused cannot be proven. Existing code accepted and cached a single result without a count-recovery pass.

Separately, a confirmed V2 integration defect defaulted the frontend output budget to 60 seconds. Long-video clips are 45–60 seconds, so the render manifest generally retained only one whole highlight. The existing credit ceiling is correct and remains enforced; the default authorization was insufficient for the intended generation target.

### Implementation

- `CaptionBurningService`: canonical UTF-8 ASS, safe literal text, horizontal margins and smart wrapping; explicit Noto script runs; cached Linux Fontconfig glyph coverage checks; optional `CAPTION_FONTS_DIR`; bounded font-selection diagnostics; missing-glyph renders fail before upload even when FFmpeg exits zero. Both preliminary “glyph not found, selecting another font” and terminal fallback failures are distinguished, so successful fallback is accepted. ASS paths follow the output filename rather than overwriting the input path.
- `highlight-policy.ts`: backend-owned Free target 6/max 6, paid target 6–9/max 9. No additional authoritative count restriction was found in the existing backend plan entitlements. Budgets cover up to 60 seconds per target clip, bounded by source length.
- `JobsController.estimate()` / `JobsService.createJob()`: reject insufficient requested output budgets explicitly; preflight caps short-source estimates to source length; admission stores the backend clip target. No silent single-clip alternative is introduced. Users lacking credits see the existing insufficient-credit/upgrade route.
- `JobsProcessor`: passes measured source duration and persisted plan target to detection; plan/version-specific highlight cache keys avoid replaying old low-count caches. Long-source results below six are not accepted as reusable default caches. Existing persisted job highlights/manifests remain resumable.
- `HighlightDetectionService`: keeps the existing provider/JSON-recovery paths, validates timestamps/source coverage/duration, rejects overlapping moments, applies plan limits after validation and performs at most one additional uncovered-excerpt recovery pass for eligible long sources. This pass uses existing metered provider calls and existing bounded SDK/provider retries. It never fills quotas with synthetic clips or timestamps. Short sources or genuine low-count results return the valid subset.
- `JobsService.prepareRenderManifest()`: preserves whole-clip budget enforcement and stable IDs; records target/accepted/shortfall summary. Diagnostics distinguish returned/parsed/filtered/deduplicated/persisted/rendered counts without full transcript logging. Terminal job completion still waits for all children.
- Main submission uses six/nine-minute default output budgets and confirms the authoritative returned budget. My Clips displays a shortfall explanation. Player UI is unchanged. Ledger formula, cumulative settlement, retry operations and Paddle prices remain unchanged.

At exactly 50 minutes, Free authorization for six minutes of output is 10 + 6 = 16 credits; paid authorization for nine minutes is 10 + 9 = 19. These are reservation ceilings, not final charges. Six 45-second delivered clips charge 10 + ceil(270/60) = 15. A single 45-second delivered clip still charges 11, and unused authorization is released. Existing Free monthly allocation remains five credits; a large-source six-clip authorization may require carried-over/referral credits or an upgrade. The implementation reports insufficient funds rather than reducing output silently.

### Required Linux deployment checks (not executed on production)

Run as the operator on the actual EC2 worker after draining rendering. Install supported packages on Ubuntu/Debian:

```sh
sudo apt-get update
sudo apt-get install -y ffmpeg fontconfig fonts-noto-core fonts-dejavu-core fonts-liberation
fc-cache -f
ffmpeg -version
ffmpeg -hide_banner -filters | grep subtitles
fc-list : family | sort -u
fc-match Montserrat
fc-match 'Noto Sans Arabic:charset=06c1 06d2'
fc-match 'Noto Sans Devanagari:charset=0939 0940'
```

Check these commands under the same OS account and Fontconfig environment as PM2; a developer Windows font or root-only font is not sufficient. Inspect `FONTCONFIG_FILE`/`FONTCONFIG_PATH` locally for stale overrides. Verify libass has HarfBuzz complex shaping and FriBidi bidi support in render logs. Generic fallback styles work with the installed fonts; install licensed Montserrat/Impact/Georgia files separately if exact Latin font identity is required. Do not copy proprietary Windows fonts blindly.

Optionally set `CAPTION_FONTS_DIR` to an absolute readable folder of reviewed `.ttf`/`.otf` fonts. Files used for glyph preflight are directly inside that folder. Script families must be named `Noto Sans Arabic` and `Noto Sans Devanagari`. Restart the compatible media worker after changing fonts/configuration because coverage is cached. No font install, production restart, retroactive charge or historical job regeneration was performed by this task.

Build and run on a dedicated Linux staging/test worker:

```sh
npm run build
MEDIA_CAPTION_QA_DIR=/tmp/blynta-caption-qa node test/caption-render-smoke.cjs
```

The smoke test generates actual MP4s and extracted PNG frames for English, Hindi, Urdu, both mixed-script cases, long English/Hindi/Urdu, special punctuation and all ten existing preset/editor style configurations (19 cases). It rejects terminal glyph failures and checks visible caption pixels remain within safe vertical-frame bounds. Review the PNGs and play the MP4s as well: pixel bounds alone do not prove shaping or textual correctness. Noto font sources and script coverage: [official Noto usage guide](https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md).

Deploy API and media worker from the same reviewed build and update the main frontend; follow the billing rollout guide for V2 activation. Verify a new staging job on Free and paid plans, then one canary account: log counts, clip IDs, delivered durations, reservation/charge/release entries and shortfall message. Do not reset existing manifests or reprocess historical user jobs automatically. Recovery adds internal provider usage, while customer credits still depend only on eligible delivery within the original authorization.

### Test results and remaining limitations

- Focused caption/highlight/fan-out/render/recovery/billing suite: **125 passed, zero failed, three skipped**.
- Full backend suite: **372 passed, two existing unrelated health/notification failures, three skipped MongoDB tests**.
- Backend production build and main app typecheck pass. Caption/policy/prompt lint passes; frontend lint has only an existing image-element warning. Broad legacy service lint retains existing enum/unsafe-any issues and is not reported as clean.
- Billing UI regression tests: **four passed**.
- Actual Linux caption smoke: **19 MP4s** rendered; extracted frames visually inspected for script shaping and representative styling, with safe-bound checks across all cases. This is local Ubuntu verification, not EC2 verification.
- Mocked tests cover Free/paid limits, bounded count recovery, retained valid shortfall, invalid/overlapping/silent ranges, six/nine persisted and queued clips, duplicate fan-out, worker failures/retries, recovery and unchanged accounting. These do not prove live provider quality or live BullMQ/replica-set behavior.

Remaining gates: actual EC2 font/config/build inspection (including `LLM_PROVIDER` and `LLM_MODEL_NAME`, without printing API keys), provider-enabled staging end-to-end processing and the previously documented dedicated MongoDB tests. A generation target is not a guarantee that six genuine moments exist; valid shortfalls remain explicit. Existing animation metadata/behavior is retained; this change does not add new karaoke/word-pop timing.
