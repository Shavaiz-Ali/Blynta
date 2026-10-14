# Production transcript failure investigation

Date: 2026-10-14 (Asia/Karachi). Local investigation baseline: `fdb50a8`.
Reported job: `6acf7b9d897c2433c4123719`.

## 1. Root cause and evidence limits

The exact throw is `PipelineCacheService.getOrCreate()` in
`backend/src/media/services/pipeline-cache.service.ts`: after `params.create()`
returns, a false validation result throws `Invalid transcript artifact`.
This particular message describes **newly generated normalized output**, not
an upstream provider transport exception. Invalid existing cached output is
instead a cache miss and triggers generation. The transcript is rejected before
publication to the artifact collection and before job transcript persistence.

The caller is `JobsProcessor.processClipVideoJob()`'s `obtainTranscript()`.
It supplies `transcriptIsValid()` from `media/pipeline-cache-identity.ts`.
The old predicate required a nonempty array, nonblank text, finite numeric
timestamps, nonnegative starts, `endTime > startTime`, and an end no more than
30 seconds beyond measured video duration.

**Confirmed reproducible regression:** the original
`TranscriptionService.parseGroqOutput()` returned a single segment with both
timestamps zero when Groq returned text without segment timestamps. That output
always fails the positive-duration predicate. The same old parser left numeric
strings unnormalized, and the Whisper parser invented zero timestamps for
unrecognized timing formats. The validator could also throw while inspecting
null segments instead of treating the artifact as invalid.

**Production limitation:** the supplied log contains neither provider output
shape nor the failed predicate, and the job ID alone cannot recover that data.
The precise predicate for this historical job is therefore unconfirmed. The
zero-duration fallback is proven by source and regression tests; it must not be
presented as an observed response from this specific job. Other possibilities
include empty/all-silence output, missing times, wrong numeric types or an
out-of-bounds interval. No production records or provider responses were read.

## 2. Local history comparison

- `e2b9c17` introduced versioned transcript caching, strict artifact validation,
  and `canShareSource()` before resume selection. Its parent already contained
  the Groq zero-duration fallback. Previously, the processor could persist that
  fallback without this cache validation gate.
- The old transcription parser persisted unchanged across later AI registry,
  Gemini and LangGraph work. In particular, `git diff 1bf217f 968b02a` has no
  changes to the transcription service or transcript identity module.
- ASR selects Groq Whisper or whisper.cpp via `TRANSCRIPTION_PROVIDER`.
  Gemini/database model routing serves highlight detection and the editing
  agent; it does not generate this transcript.
- All comparisons used local Git history; no remote GitHub API was used.

## 3. Flow and why retry did not recover

1. The processor validates source duration/billing authorization, hashes media,
   and retains durable video/audio independently of successful ASR.
2. Audio extraction uses FFmpeg mono 16 kHz PCM. Groq requests `verbose_json`
   with segment timestamps; whisper.cpp emits JSON via `-oj -of`.
3. The old provider parsers normalized some response shapes but did not validate
   their own normalized result. The artifact cache added the stricter gate.
4. Failed transcript validation prevents artifact and job transcript publication.
   Thus video/audio can exist while transcript/highlights remain absent.
5. Retry reuses media but repeats the same ASR/parser/validation mismatch.
   It is not repaired by repeatedly retrying a deterministic malformed fallback.
6. Process start resets status to `pending`. Only the fresh-download branch used
   to set `transcribing`; local/durable resume and shared-media-cache ASR paths
   omitted that update. Failure logging read this stale persisted status. The
   catch also reset the stage to `pending` on each non-render failure.
7. Existing BullMQ terminal failure handling, cancellation fences, distributed
   leases, source credit authorization and retry-in-place credit accounting are
   retained. No new retry loop or duplicate job is introduced.

The old whisper.cpp file reader could pick an existing JSON candidate, or any
JSON in the directory if none of its candidates existed. That allowed stale or
unrelated output to masquerade as a successful attempt. This is independently
fixed even though the production provider is not known.

## 4. Local fix prepared for review

- `media/transcript-validation.ts` owns safe structured validation and provider
  normalization. Errors contain code, reason and optional segment index only;
  no transcript text, audio or provider secret is emitted.
- Numeric decimal strings are normalized at the provider boundary, while
  persisted artifact validation still requires finite numeric timestamps.
  Invalid segments, negative/reversed/non-positive timestamps, descending
  chronology and out-of-bounds times are rejected; malformed nonempty segments
  cannot be replaced by full-text fallback. The original 30-second upper
  tolerance is retained. Overlapping intervals are allowed if starts remain
  chronological; valid timed segments with blank text are omitted as silence, and all-silence
  output remains an explicit failure.
- Groq text-only fallback uses the verified audio duration and logs coarse timing.
  It provides a full-audio interval, **not word/segment alignment**. If precise
  alignment is required for this source, this coarse result requires a real
  timestamped ASR result rather than invented detailed timing.
- whisper.cpp supports millisecond offsets, formatted timestamps, second-based
  start/end values, and native 10 ms `t0/t1` ticks. Timing units were checked
  against [the upstream CLI source](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp).
  Each call reads only its unique invocation-owned JSON file. Missing, partial
  or malformed JSON fails safely; that temporary output is cleaned up.
- Transcript identity advances from `timestamped-transcript-v1` to `v2`, which
  is included in the configuration fingerprint. Old incompatible signatures
  cause one ASR refresh, while valid compatible transcripts are reused. Video
  and audio identities are unchanged. No collection migration is required.
- Every `obtainTranscript()` path persists `transcribing` before audio/ASR work,
  validates audio duration and content presence, repairs invalid audio locally,
  and persists reusable paths before ASR. Generated transcripts are validated
  even when the optional artifact-cache service is absent.
- Job transcript/signature publish in one update after validation. Cache payloads
  remain checksum-verified and atomically published under existing leases. A
  failed job update can retry against the already validated cache artifact.
- Local source reuse requires readable media and, when a saved hash exists, a
  matching checksum. A corrupt local copy can be restored from the saved R2
  source. Source hashes cannot silently change during resume.
- Failure status preserves the actual stage; terminal `onFailed()` still marks
  the job failed, retaining its diagnostic error stage.

## 5. yt-dlp warning

`canShareSource()` called `fetchVideoMetadata(url, false)` before checking the
resume branch, specifically to prove anonymous/public access before sharing a
source cache across owners. The optional metadata request failed authentication,
logged a warning and returned no usable duration, so the source was treated as
private. This warning is separate from the transcript validation failure.

A job-owned local/durable resume no longer makes that request. It uses persisted
display metadata and ffprobe measurements, keeps unverified cache scope private
to the owner, and does not grant cross-owner shared access. Fresh source
processing retains the existing public-cache eligibility check. No cookies,
authentication bypass or new yt-dlp flags were added. Private-scope resumes may
miss a previous public transcript cache; security is retained over speculative
public reuse.

## 6. Regression verification

Focused coverage includes provider outputs, empty/all-silence transcripts,
numeric strings, malformed segments, invalid/reversed timing, safe diagnostics,
all supported Whisper timing formats, stale/partial invocation output, malformed
cache payloads with valid checksums, missing/invalid transcripts on retry,
valid transcript/media reuse, partial audio repair, checksum-invalid local video
restoration, interrupted transcript publication, no metadata probe on resume,
correct error stage, lease cleanup and cancellation.

Focused provider/cache/resume tests passed 58 tests. The final full backend run
passed **80 suites / 709 tests**, with **2 opt-in suites / 8 tests skipped**.
The final production backend build passed, including its contract-install and
compiled-route checks. ESLint passed for transcript validation, the transcription
service and the jobs processor. `git diff --check` passed. Full-suite coverage
includes existing render, credit accounting, source authorization, cancellation,
AI registry and editing-engine tests; focused counts overlap the full run.

One existing cache-budget test assumed exactly two probes even when legacy audio
was rejected and re-extracted. It now asserts the source probe, audio replacement
and verification of the replacement before ASR. The billing/duration checks are
unchanged. The synthetic cancellation fixture now supplies a verified duration,
since its text fixture file is not a real audio recording.

## 7. Safe deployment and recovery procedure (not executed)

1. Review this patch and obtain explicit approval for production deployment and
   worker restart. Do not clear job fields, delete local media/cache records,
   insert BullMQ jobs manually or add YouTube cookies.
2. Capture read-only state for the reported job: Mongo status/errorStage,
   saved source keys/hash, transcript signature/count, BullMQ state/attempts,
   configured ASR provider and measured media validity. Do not log transcript
   text or credentials. Preserve any existing evidence needed to distinguish
   the historical validation condition.
3. Package/build the backend using its locked dependency install and checked-in
   contracts. Stage this change against non-production media first. Deploy the
   backend/API and media-worker code together after approval; preserve all
   storage roots, encryption credentials, queue names and credit records.
4. Coordinate the approved worker restart using the existing deployment process
   and graceful in-flight handling. Do not run mixed versions of the media
   pipeline longer than necessary: old workers retain the old validation bug.
5. After approval, if this same job is terminally failed and eligible, retry it
   once through the existing owned `/jobs/:id/retry` endpoint or approved admin
   retry UI. The existing retry path preserves the job ID, valid media and
   original credit authorization. If it is active/waiting/delayed, do not also
   enqueue it; allow the existing state machine to proceed.
6. Observe the canary: local/durable media reuse, no yt-dlp metadata warning on
   resume, `transcribing` stage, validated transcript publication, highlight
   handoff and existing render fan-out. If validation still fails, inspect
   `transcript.validation_failed` / `pipeline_failed.validation` reason/index,
   not sensitive response content. An empty/silent recording may need a new
   user-selected source; schema changes cannot create speech.
7. Roll back worker/API code together if needed and retain all artifacts and
   credit records. Versioned transcript keys separate outputs safely; a rollback
   may refresh incompatible ASR rather than reuse the new normalization result.

The user authorized committing and pushing the verified local fix. No worker
restart, production retry/requeue, artifact deletion, database update or deployment
has been performed for this investigation. Those production actions still require approval.
