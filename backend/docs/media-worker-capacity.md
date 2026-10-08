# Media capacity and safe deployment

The old canonical PM2 config launched two `blynta-worker` processes. Each could
consume one clip render, one pipeline job, and two Studio jobs. Per-process
`RENDER_CONCURRENCY=1` therefore allowed overlapping renders; pipeline audio
extraction, yt-dlp merges, and Studio FFmpeg could also overlap. The alternate
`ecosystem.comfig.js` started the same entrypoint under `worker-general`.

## Current 1 GB / 2 vCPU host

Use `ecosystem.config.js`. The legacy filename delegates to it. Build output is
`dist/src`, which both PM2 and npm production entrypoints now use.

| Setting | Value | Scope |
| --- | --- | --- |
| PM2 media instances | 1 | One process on this EC2 |
| `MEDIA_WORKER_ROLE` | all | Pipeline, clip renders, Studio in that process |
| `PIPELINE_CONCURRENCY` | 1 | Pipeline jobs per process |
| `RENDER_CONCURRENCY` | 1 | Clip jobs per process |
| `RENDER_GLOBAL_CONCURRENCY` | 1 | All clip-renders consumers sharing Redis queue/prefix |
| `STUDIO_CONCURRENCY` | 1 | Studio jobs per process |
| `MEDIA_HOST_CONCURRENCY` | 1 | All media commands on one host |
| `MEDIA_HOST_LOCK_DIR` | /tmp/blynta-media-slots | Shared stable host lock directory |
| `FFMPEG_THREADS` | 1 | Decoder/filter/encoder thread limits |
| `MEDIA_COMMAND_TIMEOUT_SECONDS` | 1800 | Linux command runtime deadline after acquiring a slot |

Concurrency/thread values accept integers 1–8 and default to 1. Linux runtime
deadlines accept 1–86400 seconds. PM2 explicitly sets the small-host values;
editing only `.env` does not override PM2's environment. No limits depend on
users; seven clips remain seven independent durable BullMQ jobs.

Before render consumption starts, Redis's `Queue.setGlobalConcurrency` applies
the queue-wide limit. Redis configuration failure prevents worker startup.
The existing ETA capacity service already respects that ceiling.

All `runCommandWithProgress` commands acquire a host slot: cutting, caption
burning, video/audio preparation, audio splitting, Studio previews/exports,
yt-dlp (including its FFmpeg postprocessing), and local whisper transcription.
Downloads conservatively occupy a slot for their full run. ffprobe metadata
queries do not encode video and retain their existing lightweight path.
The API does not register media processors. Mail, notifications, and activities
processors retain concurrency 5; YouTube publishing retains concurrency 1.

Linux requires `bash`, util-linux `flock`, coreutils `timeout`, FFmpeg, and the
existing media binaries. Kernel file locks coordinate separate workers and
queues without expiring a lease beneath a live encoder. The supervisor and
command inherit the lock, so a Node crash does not free an orphan's slot.
The command deadline bounds orphaned/hung operations. Windows development uses
named PowerShell kernel mutexes; Linux is the deployment target and provides
the orphan runtime deadline.

All media processes on a host must use the same slot count, OS identity, and
lock directory, including API processes invoking media services. Never remove
lock files while commands are running, vary paths between releases, or bypass
the common runner with direct FFmpeg spawns. Containers sharing a physical
host need a shared lock-directory mount; their private `/tmp` directories would
otherwise create separate limits. New output layouts/multiple-output FFmpeg
commands must set thread limits for each output explicitly.

## Deploy / restart without duplicate workers

After building, run from `backend` as the existing PM2 owner:

```bash
npm run build
flock -x /tmp/blynta-media-deploy.lock node scripts/restart-media-worker.cjs
pm2 restart ecosystem.config.js --only blynta-api --update-env
pm2 jlist
```

The helper deletes all existing canonical media instances, `worker-general`,
and legacy Blynta media entrypoints, then starts the one configured media
process, verifies its count/status and saves PM2's process list. The deployment
flock serializes concurrent deploys. Use that command when changing worker
configuration; avoid separately starting `dist/src/worker.js`, using ad-hoc
aliases, or resurrecting an older PM2 dump. On the first migration, inspect
`pm2 jlist` for custom pipeline/render/Studio aliases and remove those too.
Do not run a second PM2 daemon under another OS user or `PM2_HOME`.

Ordinary `pm2 restart blynta-worker` restarts the existing process. The helper
also repairs a pre-existing duplicate list, which ordinary restart cannot do.
Legacy standalone YouTube publishing should use its corrected npm entrypoint
if needed; the canonical small-host config does not add another media process.

Shutdown is handled by one signal handler, stops acquiring/renewing BullMQ
jobs with `close(true)`, rejects new child commands, terminates process groups,
and escalates after five seconds. Worker shutdown is bounded to 15 seconds;
PM2 allows 20 seconds and kills descendants. There is no unbounded wait for
a long render or remote AI request. BullMQ locks expire and stalled checking
recovers interrupted jobs (normal settings: 60-second locks, 30-second checks,
one allowed stall). Retry/backoff and failure reconciliation remain intact.

BullMQ is at-least-once. Existing stable clip identities and deterministic
queue IDs prevent new clip records on retries. Completed records are skipped;
an uploaded deterministic R2 object is recovered if Mongo publication was
interrupted. Per-attempt workspaces and atomic object uploads remain intact.
Source cleanup and parent completion/reconciliation retain their existing
behavior. Redis must persist queue data (configure AOF/RDB appropriately and
`maxmemory-policy noeviction`); restarting workers does not clear Redis.

## Scaling

One encoder can still exceed 1 GB on sufficiently large inputs. These limits
prevent concurrent encoders; they are not an FFmpeg memory quota. Measure peak
RSS and retain memory for Node, Redis, Mongo if local, OS, and SSH. Benchmark
representative resolution, duration, captions, and Studio projects before
increasing limits; add RAM or downscale inputs if a single operation is too big.

For two adequately sized render hosts, start with one render process and one
host slot on each, `RENDER_CONCURRENCY=1`, and a consistent
`RENDER_GLOBAL_CONCURRENCY=2` for all consumers of the same Redis queue/prefix.
Pipeline/Studio roles can run separately, sharing their own hosts' slot gates.
For a larger single host, raise host slots and local render concurrency together
after benchmarking. Increasing process count alone cannot exceed the Redis or
host ceiling. The current deployment helper deliberately enforces one process;
use an explicit capacity-reviewed ecosystem for a future multi-process host.
When changing host slot counts, stop all media consumers on that host first,
including any orphan commands, then restart with the consistent new settings.
Changing a Redis ceiling cannot preempt jobs that are already active.

## Verification

```bash
npm run build
npm test -- --runInBand jobs/render.processor.spec.ts jobs/render-capacity.service.spec.ts jobs/jobs-media.service.spec.ts jobs/clip-identity.spec.ts jobs/render-progress.spec.ts jobs/render-source.service.spec.ts jobs/render-eta.service.spec.ts studio/studio.renderer.spec.ts media/utils/host-command.spec.ts common/services/process-registry.service.spec.ts
node scripts/test-worker-deployment.cjs
MEDIA_TEST_REDIS_BINARY=/usr/bin/redis-server MEDIA_TEST_FFMPEG=/usr/bin/ffmpeg node scripts/test-media-concurrency.cjs
MEDIA_TEST_FFMPEG=/usr/bin/ffmpeg node scripts/test-media-shutdown.cjs
```

The integration harness starts an isolated Redis on loopback port 16389 with
persistence disabled and a unique queue prefix, and forks two real BullMQ
workers. It never reads `.env`, uses fixture operations rather than external
AI/R2/Mongo, and optionally runs actual FFmpeg inside every operation. It tests
seven clips for one user, fourteen for two users, commands from independent
stages, worker SIGKILL mid-operation and stalled recovery, full queue drainage
and progress, and two-slot scaling. The deployment test exercises the actual
helper against a PM2 CLI fixture; it does not modify a real PM2 daemon.

The existing `scripts/media-load-test.cjs` is a separate full Mongo/fixture-AI
load harness. This change does not claim a live EC2 deployment or production
Mongo/R2 end-to-end test.

Verified locally on 2026-10-08: backend build, 59 focused tests in 10 suites,
lint for changed TypeScript, and the PM2 deployment fixture all passed.
Actual Linux FFmpeg interruption released its host slot and allowed a new
command to complete in under five seconds. The queue test uses short generated
videos; it does not measure peak memory for production-sized 1080p inputs.

The real Redis/BullMQ/Linux FFmpeg integration run passed all assertions:

| Scenario | Observed result |
| --- | --- |
| One user, seven clips, two worker processes | 7/7 completed; peak operations 1 |
| Two users, fourteen clips, two worker processes | 14/14 completed; peak operations 1 |
| Independent caption/audio/preparation/merge/Studio operations | Peak operations 1 |
| Worker SIGKILL after actual FFmpeg progress | Stalled job recovered; progress 100; one successful attempt; peak operations 1 |
| Capacity raised to global 2 and host 2 | 4/4 completed; peak operations exactly 2 |
| Graceful interruption during actual FFmpeg | Shutdown and subsequent slot acquisition each under 5 seconds |
| PM2 duplicate aliases and two repeated restarts | CLI fixture retained exactly one canonical worker and left API intact |

References: [BullMQ global concurrency](https://docs.bullmq.io/guide/queues/global-concurrency)
and [shutdown/stalled recovery](https://docs.bullmq.io/guide/workers/graceful-shutdown).
