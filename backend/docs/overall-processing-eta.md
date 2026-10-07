# Backend-owned overall processing ETA

## 1. Files changed

New implementation:
- src/jobs/render-eta.ts — pure phase/workload estimator and slot projection.
- src/jobs/render-capacity.service.ts — live worker capacity abstraction and cached queue metrics.
- src/jobs/render-eta.service.ts — parent ETA calculation and shared Redis smoothing.
- src/jobs/render-eta-redis.ts — BullMQ Redis-adapter script registration.

Updated integration:
- src/jobs/render.processor.ts — capacity registration; measured cutting, captioning, and setup/upload timings.
- src/jobs/render-progress.ts — extends existing BullMQ clip progress with cuttingSeconds and hasCaptions.
- src/jobs/schemas/job.schema.ts — optional durable successful-attempt renderTiming on each clip.
- src/jobs/jobs.service.ts — passes existing clip/queue progress to the estimator; appends ETA to render snapshot.
- src/jobs/jobs.controller.ts — exposes root estimatedRemainingSeconds in the existing job response.
- src/jobs/jobs.module.ts and jobs-worker.module.ts — provider wiring.

Tests:
- src/jobs/render-eta.spec.ts
- src/jobs/render-eta.service.spec.ts
- src/jobs/render-capacity.service.spec.ts
- src/jobs/jobs-eta.controller.spec.ts
- src/jobs/render.processor.spec.ts
- src/jobs/jobs-media.service.spec.ts

Documentation: docs/overall-processing-eta.md. Paths above are relative to backend. No frontend files or queue execution architecture were changed.

## 2–3. Calculation and response contract

JobsService.getRenderSnapshot continues reading the same per-clip BullMQ progress. RenderEtaService calculates an overall estimate from those observations; JobsController.shapeJobResponse adds estimatedRemainingSeconds: number | null at the response root, exactly where frontend commit ee47812 reads it. The render snapshot also contains the field. Values are integer seconds; no human formatting or frontend calculation is needed.

Before an estimable manifest: null. During rendering: estimated seconds. Every required clip ready: 0. Failed/cancelled parent or failed required clip: null. Unknown states and incomplete/retry-delayed manifests also return null. The existing enum has no cancellation value; the estimator explicitly handles a future cancelled status without introducing a new processing status.

Terminal completion works without Redis history. ETA infrastructure failures return null rather than failing the progress response. Existing progress percentages, clip fields, polling, retry behavior and rendering order are preserved.

## 4. Active clip calculation

Current FFmpeg speed gives remaining stage work = (clip duration - processed media seconds) / speed. A reported etaSeconds is a fallback if usable speed is absent. A live sample requires at least five processed media seconds and must be no more than fifteen seconds old. Invalid/future timestamps, impossible progress and non-finite/extreme estimates are rejected.

The existing etaSeconds describes the current FFmpeg stage only. For a cutting clip with captions still ahead, the estimator adds measured caption cost for the whole clip. For captioning, it uses the remaining caption stage. For uploading, it uses the setup/upload allowance. This distinguishes stage ETA from time until the complete output is ready.

## 5. Queued clip estimates

RenderProcessor records successful attempt cuttingSeconds, captioningSeconds, overheadSeconds and totalSeconds on the existing clip. Queue wait is excluded. These optional Mongo fields require no migration and survive API/server restarts. Recovery of an already-uploaded output does not fabricate a performance sample.

Phase costs are normalized to seconds of processing per media second. Median timings from completed clips of this parent take precedence. Otherwise use stable active FFmpeg samples; a captioning clip also supplies its measured preceding cuttingSeconds. Queued duration is multiplied by the observed cutting cost and, when captions are required, caption cost. This parent uses the same source/style, so local samples are more relevant than arbitrary global averages.

Setup/upload overhead uses completed parent measurements when available; otherwise it reserves thirty seconds per clip as a provisional allowance. That is an estimate, not measured upload progress. No default FFmpeg speed is invented. If a required phase has no measured cost, ETA is null until observations exist. The allowance may under- or over-estimate slow transfers and unusually large source downloads; it is documented rather than presented as exact timing.

## 6. Concurrency

Each active clip occupies one slot timeline with its remaining work. Idle registered slots begin at zero. Queued clips, in existing manifest/priority order, are assigned to the shortest timeline. The parent ETA is the maximum timeline, not their sum and not a simple division of total work that could ignore a long active clip.

Effective capacity comes from live worker registrations in RenderCapacityService. Every render worker advertises its actual Worker.concurrency and availability to a queue-scoped Redis sorted set. Slots are summed across processes and limited by BullMQ's global queue concurrency, if configured. Pipeline-only/API processes do not advertise render slots.

Heartbeat interval: ten seconds. Expiry: thirty seconds using Redis time, avoiding host clock skew. Shutdown removes registration; changes in concurrency or local pause replace the member without double-counting. Queue metrics/capacity are cached for five seconds per API instance, and concurrent reads share an in-flight request.

## 7. Smoothing

Atomic Redis state per parent is shared across API replicas. Fresh estimates use a time-weighted exponential moving average with a fifteen-second time constant. A repeated observation signature returns the existing value, even if polled again; queued synthetic timestamps do not count as new progress. There is no timer decrementing stale ETA. Terminal completion bypasses smoothing and returns zero; unreliable/terminal estimates clear smoothing state. State expires after two minutes.

## 8. Insufficient information and scheduling limits

ETA stays null for absent capacity, unknown stage performance, stale progress, active source preparation without progress, paused queues/workers, retry delays, missing child queue state, failed required clips, and estimates exceeding thirty days. It also stays null when queue counts show active or queued work belonging to other parents: external task durations and scheduling are not available without expensive global job inspection. This is intentionally conservative; unrelated jobs continue processing normally.

The calculation does not scan all BullMQ jobs or aggregate Mongo collections on each poll. It uses already-loaded parent clips and existing per-clip queries, a small worker-registration index, and constant-cost queue counts/global concurrency/pause reads. The estimator is linear in parent metadata plus a small slot projection. The queue's cached counts can temporarily disagree with the parent's fresh states, so ETA can disappear for up to five seconds during transitions. Worker failure detection can lag by heartbeat expiry plus cache time (up to roughly thirty-five seconds).

## 9. Horizontal scaling

All upgraded render processes register independently; heterogeneous local concurrency and ten or more workers require no frontend/API changes. Replace RenderCapacityService.snapshot with another metrics provider later if autoscaling needs additional scheduling information. This implementation never assumes RENDER_CONCURRENCY is the total across the deployment.

All render workers must deploy this code for complete registrations. Legacy workers do not advertise their slots; absent/inconsistent capacity causes conservative null values. Modeling external parent workload, priority/rate-limit schedules and transfer performance more precisely is future work behind the backend abstraction.

## 10. Tests and verification

Backend typecheck and Nest build passed. Targeted lint passed. Seven targeted suites passed with forty-two tests, including:
- One active clip and concurrent active clips.
- Active/queued work across multiple slots, different durations and idle slots.
- Completed parent samples influencing queued estimates.
- Additional caption work following cutting.
- Missing speeds/capacity, stale timestamps, failed/cancelled/complete states.
- Very slow speeds without NaN/Infinity/negative output.
- Shared smoothing, identical polling observations, parent isolation and Redis failure.
- Multiple heterogeneous workers, global concurrency ceiling, cache/coalescing, shutdown and pause.
- Durable timing capture and JobsService progress handoff.
- Root numeric ETA response consumed by the existing frontend.

The full backend run before the final handoff-test addition had 36 suites pass and 2 fail (220 tests passed, 2 failed). Failures are in untouched app.controller.spec.ts (missing DatabaseConnection test provider) and notifications.service.spec.ts (mark-as-read test result lacks status). Those unrelated tests were not changed.

There was no local Redis listener on 127.0.0.1:6379. Capacity/smoothing tests use mocked BullMQ Redis adapters, so live Redis Lua execution and multi-process worker operation were not verified in this environment. A deployed Redis/worker smoke test remains appropriate before relying on operational ETA behavior. No live production job was queried or modified.

## 11. Seven-clip fixture and example response

Fixture: two active captioning clips, each fifty seconds long, with 19/17 processed seconds and respective remaining stage ETAs 1147/1351 seconds. Five fifty-second clips are queued. Measured cutting time is fifty seconds per clip, and live caption speeds are derived from those remaining observations. Two live render slots are available; no competing parent or retry delay exists.

Median caption cost is about 38.97 processing seconds per media second. Each queued full clip is therefore about 2028 seconds including cutting and provisional overhead. Slot timelines start at 1177 and 1381 seconds; five queued clips distribute three/two between them. Overall raw ETA is 7263 seconds (about 2 hours 1 minute). Summing the same workloads would give about 12701 seconds. The two-slot estimate is consequently neither the largest active stage ETA nor the sum of every clip.

Illustrative API response derived from that fixture, not a live production response:

```json
{
  "status": "cutting_clips",
  "progressPercent": 19,
  "estimatedRemainingSeconds": 7263,
  "render": {
    "ready": 0,
    "failed": 0,
    "total": 7,
    "progressPercent": 19,
    "estimatedRemainingSeconds": 7263,
    "clips": [
      { "clipId": "clip-01", "status": "captioning", "progress": 38, "etaSeconds": 1147 },
      { "clipId": "clip-02", "status": "captioning", "progress": 34, "etaSeconds": 1351 },
      { "clipId": "clip-03", "status": "queued", "progress": 0 },
      { "clipId": "clip-04", "status": "queued", "progress": 0 },
      { "clipId": "clip-05", "status": "queued", "progress": 0 },
      { "clipId": "clip-06", "status": "queued", "progress": 0 },
      { "clipId": "clip-07", "status": "queued", "progress": 0 }
    ]
  }
}
```
