# Non-positive transcription segment duration

Investigation: 2026-10-23 (Asia/Karachi). Reported job: `6adb3cc324b6dd9b87533cf7`.

## Findings and evidence limits

The current Groq path requests `verbose_json` with segment timestamps. The
normalizer reads `segment.start` and `segment.end` directly as seconds; numbers
are not rounded, sorted, rescaled or offset. Decimal strings pass through
`Number`. There is no audio chunking or offset arithmetic in this path. The
previous normalizer immediately applied `endTime > startTime` to each segment,
before considering neighbors. A single point interval therefore rejected the
entire successfully returned transcript. BullMQ then treated the validation
error as retryable and called the provider again. The SDK also independently
retried transport errors, allowing up to nine transport attempts across three
queue attempts.

This is a reproduced code-level failure mechanism, not an observed production
provider response. The supplied production logs identify a non-positive duration
but contain neither the start/end pair nor the raw response. They do not
distinguish equal timestamps from reversed timestamps. No raw response or source
video for this job was initially available in the inspected workspace. A subsequent
read-only database preflight located the failed job with duration 4860.881 seconds,
a durable source, no readable local media and zero saved transcript segments.
The historical provider response was not retained. It is consequently
not possible to certify that Groq emitted a particular timestamp pair for this
job's historical attempts. The isolated live replay below reproduced four
zero-duration intervals directly in the raw Groq response for the checksum-matched
source, confirming this provider-output condition and the parser's missing recovery
as the failure mechanism on this recording. For numeric provider timestamps, this parser cannot introduce a zero
duration through rounding; for decimal strings, raw diagnostics retain the
original precision so conversion can be compared. Compression-induced ASR
quality problems cannot be established without the recording and response.

## Flow audit

1. `JobsProcessor` obtains a local, durable R2 or downloaded source, verifies its
   metadata/content and retains its source identity. R2 configuration is unchanged.
2. `VideoDownloadService.extractAudio` produces mono 16 kHz PCM with FFmpeg.
   The processor verifies extracted duration against video duration before ASR.
3. `prepareAudioForUpload` retains the existing size-triggered MP3 compression:
   48 kbps, then 24 kbps if necessary. These commands do not rewrite timestamps
   in the provider response. No compression algorithm or upload limit was changed.
4. Groq receives the complete upload. For the reported 4860.881 seconds,
   48 kbps explains roughly 27.8 MiB and the existing 24 kbps fallback should
   approximately halve that size. File size is distinct from alignment quality.
   Groq documents size-based chunking guidance, rather than establishing that
   this recording's duration caused these defects:
   <https://console.groq.com/docs/speech-to-text>.
   There is insufficient evidence to justify adding audio chunking, overlaps or
   deduplication in this focused fix. The highlight service's transcript windows
   are separate from ASR audio chunking.
5. Provider timestamps are parsed, conservatively reconciled, and strictly
   validated before returning from transcription. The processor validates again
   against video duration before cache publication.
6. `PipelineCacheService` validates both reads and writes under its existing
   lease and checksum rules. Job transcript/signature publication happens after
   validation. Highlights receive the same `startTime/endTime/text` schema.
7. Caption ASS generation, clip selection and Studio continue using that schema.
   No downstream schema, billing calculation or media identity changed.

## Normalization policy

- Retain positive intervals and their precision, provider order and existing
  overlaps. Do not round, sort, deduplicate spoken text, swap reversed endpoints
  or add a fixed duration. Existing whitespace/Unicode text normalization remains.
- Reject missing, non-finite or nonsensical timestamps. Reject material negative
  values and reversed intervals, descending starts and generated intervals beyond
  measured audio duration. The persisted-artifact validator retains its existing
  30-second ASR tolerance for compatibility; newly normalized segmented output
  obeys the actual audio bounds. The existing text-only full-duration fallback
  remains explicitly coarse timing, rather than detailed alignment.
- Correct only machine precision boundary noise within `1e-9` seconds: a tiny
  negative start can become zero; a tiny end overshoot can become audio duration.
  Higher-precision positive durations are preserved as supplied.
- A zero-length interval, or reversed interval within `1e-9` seconds, is repairable
  only if its start touches an immediately adjacent valid speech interval. Prefer
  appending its text to the preceding timed speech ending at that point; otherwise
  prepend it to the next timed speech starting at that point. Keep the neighbor's
  original interval unchanged. This retains words at segment granularity but
  does not claim recovered word-level alignment. No new overlap is introduced.
- An isolated point in a silence gap, or a point without a safe timed speech
  neighbor, fails. Valid blank segments retain the existing silence policy.
- Fail with `excessive_timestamp_repairs` if more than
  `min(20, max(1, floor(inputSegmentCount * 0.05)))` distinct segments need repairs.
  The one-segment minimum permits a single boundary repair in a short transcript;
  it does not make a transcript consisting only of untimed speech recoverable.
- Run `assertTranscript` on the final result. Repairs do not weaken the validator.

## Diagnostics and retry ownership

`transcript.segment.invalid` records job ID, provider, original segment index,
parsed start/end/duration, adjacent timestamps, measured duration, raw provider
start/end and reason. Numeric strings retain their original precision; missing,
malformed and non-finite values have safe labels. Arbitrary strings, transcript
text, provider error response bodies and credentials are excluded. Valid segments
do not generate per-segment logs. `transcript.normalized` records repair types,
distinct repaired segment count and input/output segment counts.

`TranscriptValidationError` now extends BullMQ's `UnrecoverableError`, retaining
its existing code, details and message. Unrepairable artifacts terminate automatic
queue retries; explicit user retry through the existing job endpoint remains
available. Recoverable defects are fixed in memory during the original call.

The Groq SDK explicitly owns the transport retry budget (`maxRetries: 2`). Its
installed implementation handles connection failures, 408/409, 429 and 5xx,
provider retry hints and `Retry-After`/`retry-after-ms`. Once it returns an API
error, the service emits a safe status-only diagnostic and throws an
`UnrecoverableError`, preventing a second BullMQ transport retry budget. Other
infrastructure failures retain existing queue exponential backoff. Cancellation
still takes priority. This means transient provider failures exhausted after
three requests become terminal for that execution, rather than starting another
three-request queue attempt.

Full raw responses are not persisted: the existing artifact cache is for
validated, reusable artifacts and has no private short-lived raw-response store.
Introducing sensitive unvalidated payloads there would violate its contract.
Timestamp-only diagnostics provide comparison evidence without changing that
storage/privacy model. A DB/cache failure before any successful validated cache
publication can still require a new ASR call; this patch does not claim exactly-once
provider execution across worker crashes or arbitrary storage failures.

The existing deterministic queue IDs, credit operation/reservation, explicit retry
claim, final settlement and reconciliation policy remain intact. Terminal failures
still use `JobsProcessor.onFailed` and the existing completion/reconciliation path.
No new job, credit reservation or charge path is introduced.

## Files changed

- `backend/src/media/transcript-validation.ts`: repairs, safe diagnostics and
  terminal validation errors.
- `backend/src/media/services/transcription.service.ts`: job-aware diagnostics,
  explicit SDK retry ownership and safe exhausted-provider error classification.
- `backend/src/jobs/jobs.processor.ts`: passes job ID into transcription.
- `backend/src/media/transcript-normalization.spec.ts`: synthetic 81-minute
  regressions at indices 101/345/466; precision, boundary, duplicate, missing,
  non-finite, negative, ordering, text retention, corruption and actual installed
  BullMQ retry-decision coverage.
- `backend/src/media/fixtures/groq-zero-duration-timestamps.json`: four observed
  raw timestamp neighborhoods, with no spoken content; tests supply synthetic text.
- `backend/src/media/services/transcription-response.spec.ts`: actual SDK with
  mocked HTTP transport verifies retry limits and one-call normalization, with
  no live API requests.
- `backend/src/jobs/jobs-pipeline-cache.processor.spec.ts`: terminal invalid
  artifacts, normalized transcript/cache/highlight/render-manifest handoff and
  unchanged charges on resume.
- `backend/src/media/services/caption-burning.service.spec.ts`: repaired text
  stays in the original ASS timing interval.
- This report.

## Deployment and production verification

Verification results:

- `npx tsc --noEmit`: passed (repeated after final edits).
- `npm run build`: passed, including contract prebuild and build metadata.
- Full backend Jest run with localhost socket access: **103 suites passed,
  1,035 tests passed; 3 suites / 16 tests skipped**. The first restricted run
  exposed localhost `EACCES` in HTTP suites; these passed with the required access.
- Focused parser/cache/processor run: **6 suites / 85 tests passed**. Final focused
  normalization/SDK/caption run after test cleanup: **3 suites / 38 tests passed**.
  Counts overlap with the full suite.
- The subsequent fixture run containing the four observed provider defects:
  **1 suite / 24 tests passed**, including four new observed-timing cases.
- Changed production files and the new normalization spec pass ESLint. A broader
  lint invocation also found pre-existing unsafe mock typing in existing specs;
  this fix does not claim a clean repository-wide lint run.
- `git diff --check`: passed.

SDK tests use its actual HTTP request/retry implementation with a mocked fetch,
and check three API calls for exhausted 429/503/connection errors, one for a 401,
and one for a repairable or invalid successful response. The SDK's local `data:`
upload-capability probe is excluded from API call counts. The BullMQ test calls
the installed library's retry decision directly. Processor integration tests use
the real orchestration/cache/credit logic with fixture infrastructure; they are
not live Redis/Mongo/R2/Groq tests. Caption coverage verifies ASS generation;
it does not certify burned-caption alignment against the reported recording.

### Isolated replay of the reported production source

Using existing configuration and read-only job metadata, the replay downloaded
the saved R2 source: **118,773,403 bytes**, matching its stored SHA-256 checksum.
FFprobe measured **4860.881 seconds** for video and **4860.8735 seconds** for the
extracted audio. The existing compression path reproduced both reported size
messages: 148.3 MiB WAV, 27.8 MiB at 48 kbps, then the 24 kbps fallback. Compression
was not changed and no audio chunking was required for this successful run.

One transcription service invocation returned **1495 raw Groq segments**, including
four exact zero-length timestamp pairs. Their raw indices/points were:

| Index | Raw start = raw end (seconds) | Safe merge |
| --- | --- | --- |
| 102 | 462.31998 | Next speech begins at the same point |
| 415 | 1535.7584 | Previous speech ends at the same point |
| 481 | 1789.7983 | Previous speech ends at the same point |
| 929 | 3139.2368 | Previous speech ends at the same point |

The normalizer reported exactly **four `merge_zero_duration` repairs**, resulting
in **1491 validated segments**. The concatenated normalized text exactly matched
the raw segment text after the existing whitespace/Unicode normalization.
The last transcript end was **4850.575 seconds**, within both media durations.
An explicit before/after interval comparison confirmed that all **1491 positive
provider intervals were unchanged**, with zero invalid output intervals.
The saved local validated artifact passed a JSON roundtrip and strict validation.
Raw timestamp-only evidence and the private validated artifacts are retained
under ignored `.test-results/transcript-duration-replay-20261023/`; no transcript
text or secrets were printed or added to source control. The service invocation
count is not an independently measured HTTP-attempt count inside SDK retries.

The four actual timestamp neighborhoods are also covered by dedicated regression
tests with synthetic text, so the demonstrated fix is not based solely on invented
timestamp examples. A separate isolated highlight call consumes the validated
transcript using the job's existing settings. **That call succeeded and returned
six highlights, all with finite, positive intervals inside the source duration.**
This verifies the live source → extraction → compression → Groq → normalization
→ highlight-detection path. It does not constitute deployment or a completed
production render job; the production job and its credit records were not written.

Build and deploy the backend/API and media worker together using the existing
deployment process. No dependency install change, database migration, R2 setting,
cache deletion or schema migration is required. Valid cached/resumed artifacts
retain compatibility and do not require paid regeneration.

For the reported job, inspect its current queue state first. If terminally failed,
retry the existing job once using the existing retry endpoint/UI; preserve its
credit operation, source paths and object keys. If already active, waiting or
delayed, let the existing execution proceed without adding another queue item.
Observe the timestamp diagnostic and repair summary, validated cache/job
publication, highlight detection and render fanout. An isolated or materially
corrupt interval must fail with its specific structured reason, not loop through
paid requests. Production success requires that real run and timing review; the
synthetic/local regressions alone cannot establish it.

No deployment, worker restart or production job retry was performed. An isolated
replay uses the existing job's saved source and transcription configuration,
without writing production job, queue or billing state; its result is recorded
separately below.
