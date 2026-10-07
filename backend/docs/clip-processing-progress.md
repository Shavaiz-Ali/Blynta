# Per-clip lifecycle progress

## 1. Why the bar reset

RenderProcessor published raw FFmpeg stage progress as `progress`. The card used that field, so a fresh caption FFmpeg process reset the bar. A separate `renderProgress` field already weighted parent progress, but used different 45/50/5 ranges and was not the card's value.

## 2. Real stage mappings

Cutting/reframing: 0–30%. Caption burning: 30–90%. Upload/finalize: 90–100%. Ready: 100%. Upload has no byte progress callback, so it stays at 90% until output upload and durable completion succeed. Clips with no transcript skip captioning and move directly from cutting to finalizing; no synthetic caption operation is added.

## 3. Backend fields

`stageProgress` is the current FFmpeg operation's percentage. `progress` is the monotonic overall clip percentage. `renderProgress` remains a compatibility alias for that same overall percentage. `status` identifies the stage. `processedSeconds`, `durationSeconds`, speed and FFmpeg metrics remain stage-specific. Legacy BullMQ samples without `stageProgress` are translated at the API boundary using their raw stage percentage.

## 4. Monotonic enforcement

The worker clamps valid percentages, maps the stage, and takes the maximum of that result and the previous overall value before publishing. Lower progress observations within the same operation are discarded, including their stale media/ETA data. Cutting callbacks are ignored after entering captioning, and caption callbacks after finalizing. Redis publication remains serialized and drained, so earlier asynchronous writes cannot land after later writes from that processing attempt.

## 5. Parent overall progress

The parent uses the duration-weighted average of these same overall per-clip values. It no longer combines different card/parent semantics. Caption stage transitions and retry waits retain completed work. Existing terminal failure accounting is preserved: failed work is counted as finished separately from ready work, and failure UI is not presented as success.

## 6. ETA

Existing per-clip ETA describes only the current FFmpeg stage. Samples now declare `etaScope: "stage"`, and cards explicitly say “remaining in this stage.” Invalid, negative or non-finite stage ETA is omitted. Starting another stage or waiting for retry removes the previous operation's ETA/media time. The backend-owned parent completion ETA remains independent and continues using real media-time/speed observations, not the weighted percentage. No countdown or guessed per-clip completion ETA was introduced.

## 7. Frontend

Cards use the overall `progress`, including the finalizing bar. The duplicate standalone stage label is suppressed when the progress bar already shows it. Typography, card styling, grid and responsive design are preserved. Types include optional stage progress and ETA scope. The Next.js client-component guide required by apps/app/AGENTS.md was read before editing.

## 8. Files changed for this fix

- backend/src/jobs/render-progress.ts
- backend/src/jobs/render.processor.ts
- backend/src/jobs/jobs.service.ts
- backend/src/jobs/render-progress.spec.ts
- backend/src/jobs/render.processor.spec.ts
- backend/src/jobs/jobs-media.service.spec.ts
- apps/app/features/jobs/components/ClipProcessingCard.tsx
- apps/app/features/jobs/types.ts
- apps/app/scripts/test-loading-processing.cjs
- backend/docs/clip-processing-progress.md

Existing overall-ETA work and unrelated workspace edits were retained.

## 9. Retry behavior and validation

BullMQ retries reuse the same child job and retain its stored overall watermark. The current operation's stage percentage can restart, while overall progress holds until the new work catches up. Queued/delayed retries retain this watermark but discard stale ETA/media time. A genuinely new render with new clip/job IDs starts at zero. There is no explicit full-reset API in the existing resume-in-place retry flow; a future full-reset operation must clear progress deliberately.

Backend typecheck, Nest build and targeted lint passed. Five focused backend suites passed with 50 tests; the additional queued-retry regression was verified separately. Tests cover every requested stage mapping, cutting-to-caption transition, stale observation rejection, parent monotonicity, preserved raw stage/media data, ready completion and invalid ETA. Frontend render checks pass for a 36% overall/10% stage example, a single stage label, stage-specific ETA wording, unchanged media time and a 90% finalizing bar.

No live Redis/FFmpeg deployment smoke test was performed. The guards cover callbacks and ordered publications within the worker attempt; this change does not introduce distributed locking beyond BullMQ's existing worker ownership.
