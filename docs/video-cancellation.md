# Video cancellation

`POST /jobs/:id/cancel` uses the existing JWT authentication and ownership check.
It persists `cancellationRequestedAt`, moves the parent to `cancelling`, and clears
retry intent. Repeated calls preserve the first request timestamp. Completed
parents with confirmed shutdown stay completed; failed parents can be cancelled
to disable further retries. A completed parent with an unacknowledged execution
can enter pending cancellation for safe recovery without losing its finished clips.
The API exposes `deletionAvailable` so the UI also protects completed/failed
parents whose workers are still cleaning up or require shutdown confirmation.

Pipeline and render workers atomically register execution tokens in Mongo before
starting. Queue dispatch registers tokens too, so a late retry cannot enqueue work
after cancellation has finalized or deletion has begun. All starts, manifests,
ordinary status writes, retries, and deletion claims use Mongo conditions that fence
against cancellation/deletion. A render that has already successfully uploaded can
still commit its completed clip while cancellation is pending.

Each execution checks Mongo every 500 ms. Its abort signal reaches the AI SDK,
Groq transcription, R2 transfers, and the subprocess registry. Subprocess groups
receive SIGTERM and then SIGKILL after five seconds; Windows uses taskkill with
the process-tree option. A worker waits for subprocess close and workspace cleanup
before removing its execution token. Intentional cancellation returns normally to
BullMQ, avoiding retries and failure notifications. Restarted or stalled attempts
see the durable marker and perform no processing.

The parent becomes `cancelled` only when no execution tokens or active BullMQ jobs
remain. Inactive queue records are removed with BullMQ's atomic lock protection;
an acquisition race keeps cancellation pending. Completed clips and existing failed
clips keep their states; unfinished clips become `cancelled`. Progress counts only
completed clip duration, and cancellation responses suppress ETAs. Owner polling,
the idempotent cancellation endpoint, and worker reconciliation can finalize shutdown.

Deletion remains blocked during `cancelling`. A durable deletion claim fences
against retry/start, then clears inactive queue records and removes job media and
Mongo records. It also removes deterministic object keys from uploads interrupted
before their Mongo commit. Shared source-video cache objects and media retained by
Studio assets follow the existing retention policy. Storage cleanup failures retain
the job and deletion intent so the user can retry deletion.

## Unreachable workers and crash recovery

An expired BullMQ lock does **not** prove an orphaned FFmpeg process has stopped.
Execution tokens deliberately have no timeout-based expiry. A hard crash can leave
a video pending until the owning host is inspected. After 30 seconds the API exposes
`cancellationPendingReason: worker_confirmation_required`; the UI explains the state
and offers **Check cancellation** in the menu. Safe polling and repeated cancellation
never discard shutdown evidence.

Operators can inspect one job without modifying it:

```powershell
cd backend
node --env-file=.env scripts/recover-cancellation.cjs JOB_ID
```

Tokens include the host, PID, and a unique execution identifier. For **each** lost
token, independently verify that the owning worker/API instance and all its FFmpeg,
yt-dlp, Whisper, and supervisor descendants are stopped. Check the actual host or
container; PID reuse, a disconnected host, an expired heartbeat, or a missing queue
lock alone is insufficient. Stop the instance and its process tree if necessary.
Allow BullMQ stalled work to settle; any rescheduled attempt will skip cancelled work.
Then acknowledge only the verified tokens:

```powershell
node --env-file=.env scripts/recover-cancellation.cjs JOB_ID --execution EXACT_TOKEN --workers-stopped --apply
```

Repeat `--execution` for multiple verified tokens. The script refuses to acknowledge
tokens while BullMQ has active work. It does not delete media, alter another job,
clear cancellation intent, or force-delete active queue records. A subsequent owner
status check or worker reconciliation finalizes cancellation when all tokens are gone.

Deploy the API and all pipeline/render workers together, draining old workers first.
Older worker versions do not register execution tokens or observe cancellation.
The default single render worker and horizontally scaled workers use the same Mongo
fences; no cancellation state depends on a process-local job map.

## Verification

`jobs-cancellation.spec.ts` covers queued removal, active-stage signaling, completed
clip preservation, idempotency, crashed-worker pending state, restart prevention,
ownership, retry races, deletion after acknowledgement, storage failures, and a real
subprocess through the shared FFmpeg command runner. Existing render/retry/controller
tests cover the surrounding behavior. Live FFmpeg/cloud-provider tests require the
deployment's binaries, MongoDB, Redis, and provider credentials.
