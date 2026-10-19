# Phase A: rendering architecture and scope

The backend is a separate npm/NestJS project, excluded from the root pnpm workspace.
It builds vendored `@blynta/types` contracts and emits `dist/src`. No existing
Dockerfile or CodeBuild buildspec was found. Turbo builds the frontend packages.

`JobsProcessor` downloads/prepares source media, transcribes, selects highlights,
uploads a durable private `job-sources/` R2 object and enqueues independent clips.
`RenderProcessor` owns clip state, BullMQ progress/ETA, usage samples, retry and
completion. `RenderSourceService` shares local source downloads with reference
counting. `ClipCuttingService` seeks, trims, crops to 9:16, scales and encodes audio;
`CaptionBurningService` creates ASS captions and uses libass and Fontconfig with
language glyph checks. Style presets and highlight styles determine captions.
`JobsService.runMediaExecution` provides Mongo execution leases and cancellation;
the existing completion/reconciliation services own billing and parent completion.

`EditRenderProcessor` has independent generation/execution leases, admission,
cancellation, retries, upload intent and atomic publication. `EditRenderService`
validates ownership, immutable source/asset ETags, dimensions, timeline, memory and
size budgets. `buildRenderSpec` handles trims, speed, freeze, crop, zoom, transitions,
text/image overlays, captions, audio mixing and timing. FFprobe plus a full decode
verify output before upload. These checks and publication remain in place.

`R2Service` selects private source vs output buckets, streams bounded downloads,
supports signed URLs and checks object metadata. FFmpeg processes already use
cancellation context, a process registry and host thread/concurrency limits.
Legacy Studio has a separate renderer/processor and is outside this change.

## Proposed boundary (implemented in phases B–D)

Only deterministic rendering is remote: a clip cut/caption task, or execution of
an already validated edited-video filter graph. Acquisition/transcription/AI,
authorization, billing and durable publication remain in the backend. Existing
FFmpeg services/utilities run in a one-shot Node entry point without Mongo/Redis.
R2 carries private task manifests, staged editing inputs, progress, result markers
and attempt-isolated output. Clip sources use signed R2 HTTP range reads with
input seeking rather than a full source download per clip; local source caching
is unchanged. Edited inputs are already short source clips, staged once per
durable execution. Signed source URLs are generated inside the task.

Mongo records claim submission with a unique execution key before calling Batch.
SubmitJob has no idempotency token: ambiguous/crashed submissions fail closed and
require operator reconciliation, never blind resubmission. Batch retries are
bounded; Bull retries attach to the same execution. A result is accepted only
after SUCCEEDED, matching AWS job ID and output HEAD/size verification. Existing
processors still guard cancellation and own the final database commit.

`RENDER_EXECUTION_MODE` defaults to `local`. The new path does not change Studio
or frontend behavior. A periodic reconciler terminates overdue remote work even
when its Bull worker has disappeared. Cancellation is inherited from the existing
execution context and propagated to Batch; timeout covers queue wait as well as
runtime. AWS resource changes and production enablement are manual operations.
