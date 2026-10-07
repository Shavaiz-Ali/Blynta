# Media processing audit (2026-10-07)

## Existing behavior, verified before implementation

* `JobsService.createJob` deducts one credit with an atomic conditional user update, saves a Mongo Job, and enqueues `clip-video` on `clip-jobs`. API submission already creates independent video jobs. Queue submissions have no explicit retry/backoff or stable Bull ID.
* Only the dedicated `worker.ts` / `JobsWorkerModule` registers `JobsProcessor`; the HTTP `JobsModule` only registers producers. PM2/process count can therefore affect effective capacity. The processor already has hardcoded concurrency **2**, not 1. No pipeline-wide mutex was found. Slow ingestion/transcription and sequential rendering occupy both slots, making other videos wait. There is no evidence that BullMQ itself limits videos to one.
* `JobsProcessor` downloads with yt-dlp, extracts mono 16kHz WAV, transcribes (Groq or whisper.cpp), detects highlights with the existing AI service and presets, then loops over clips awaiting cut, caption burn, and R2 upload. This exact loop is the clip bottleneck. It replaces the entire growing Mongo clips array after each clip, which would lose updates if naively parallelized.
* Cutting uses fluent-ffmpeg: center 9:16 crop, 1080x1920 Lanczos scale, x264 fast CRF23, AAC128, faststart. Captioning writes ASS and performs a second encode with audio copy. Combining these commands would change encoding behavior; preserve the two stages for this migration.
* `JobStatus` is used for both parent and embedded clips. `cutting_clips` is an active frontend polling status. Stable clip IDs are preserved by `clipIdentity` on retry. Studio, sharing, publishing, and downloads rely on embedded clip IDs and `r2ObjectKey`.
* Pipeline download/transcription progress is throttled to Mongo every 2s and resets per stage. Groq has existing simulated transcription progress. Neither cut nor caption reports FFmpeg progress. Studio already has a bounded JSON ffprobe implementation; transcription separately probes audio duration.
* YouTube SourceVideo cache stores source video/audio/transcript/highlights in Mongo and R2. Non-YouTube processing has no durable source reference. Local resume trusts paths only after existence checks. Local paths are `STORAGE_ROOT/jobs/<jobId>`. Completed parents delete that directory; failed directories persist for retry and expire after seven days.
* Errors inside the clip loop become failed clip records; any successful clip makes the parent completed. Outer pipeline exceptions are swallowed, so BullMQ cannot retry. Retry API enqueues the same Mongo job without charging again, but does not deduplicate queue jobs.
* Notifications and activities already have dedupe keys and database duplicate protection. Completion/failure emails lack stable queue IDs. Completion runs inline at the end of the video pipeline.
* Reconciliation marks Mongo jobs failed after 30 minutes without Mongo updates without consulting BullMQ, which can misclassify a healthy long render.
* There is no user cancellation endpoint/model. Job deletion rejects active parents; single-clip deletion does not. Do not invent a cancellation product flow. Guard deletion during rendering.
* Redis configuration uses existing host/port BullMQ connection. R2 already supports upload/download/HEAD. ProcessRegistry tracks subprocesses and kills them at worker shutdown. No new infrastructure is needed.

## Smallest migration

1. Reuse `clip-jobs` / `clip-video`; validate configurable pipeline concurrency.
2. Extract Studio's JSON probe into a normalized shared media inspection service, persist metadata on Job/SourceVideo, add a small workload estimator.
3. Persist the complete clip manifest before enqueueing independent `{jobId, clipId}` render jobs on `clip-renders`. Store a durable source key; retain local pipeline resume files until fan-out succeeds. Render attempts use unique directories and obtain source from R2.
4. Keep cut and caption services/output settings; use their existing subprocess runner with machine-readable FFmpeg progress. Store throttled progress in BullMQ, expose per-clip snapshots and duration-weighted parent render progress through existing authorized endpoints.
5. Update only the targeted embedded clip atomically. Finalize only after all required clips are terminal. Partial failure is explicit FAILED while ready clips remain downloadable; retry only failed clips. Reuse deduplicated notifications/activities and add email deduplication.
6. Reconcile queue state, incomplete fan-out, stalled terminal failures, and completion publication. Bound worker concurrency; allow pipeline/render process roles without orchestrating processes.

## Fairness and scope

Use clip ordinal as Bull priority so another video's early clips can precede a large video's later waiting clips. This is non-preemptive and not strict user fairness; steady new submissions can delay later ordinals. No custom scheduler, autoscaling, container orchestration, auth migration, or frontend redesign.
