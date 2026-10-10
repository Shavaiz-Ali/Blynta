# AI editing engine — Phase 1

## Architecture and implementation plan

The existing generation pipeline is unchanged. The new `src/ai-editor` domain starts from an owned, completed generated clip, resolves its existing R2 key through Studio's `clipMediaCandidates`, and saves editing decisions as data. It reuses Studio's validated asset records and signed-upload workflow, `R2Service`, `MediaInspectionService`, the media process registry, cancellation context, host FFmpeg gate, JWT authentication, MongoDB, Redis and BullMQ.

Implementation sequence: strict versioned contract → timeline validation/compilation → video/audio/overlay filter construction → authenticated persistence/version APIs → asynchronous preview worker → recovery/cleanup → contract, service and real media tests. There is no new frontend or conversational director in this phase.

`EditPlan` stores owner, source clip/media reference, authoritative source duration, output duration, schema version, revision, status and timestamps. Each preview creates an immutable `EditVersion` snapshot. Updating a plan requires its current revision; existing versions and original clip records are never modified. A unique MongoDB index on `(planId, revision, profile)` and deterministic Bull job identities and isolated private attempt objects make repeated render requests idempotent. Keep the index enabled when deploying.

Responsibilities are split across the contract, timeline compiler, asset validator, pure filter compiler, persistence API service, render orchestrator and worker. `EditingDirector` is the Phase 2 interface: future directors return untrusted proposed data, which must pass the same validation and owner checks. They cannot submit FFmpeg filters or commands.

## Timestamp contract

All effect windows, captions, audio-track offsets, mutes and gain keyframes use **output seconds**, with half-open intervals `[start, end)`. Only video segment source ranges, selected freeze frames, and external audio source trims use **source seconds**. External audio source timestamps refer to that asset, while video source timestamps refer to the already-generated clip (zero is its first frame).

Segments appear in array order. Durations and crossfade overlaps are rounded to the output frame grid; the compiled duration is authoritative. A freeze is a typed segment containing `sourceTime`, `duration`, and mandatory `audio: "silence"`. It inserts duration and silence into the original audio; external music/effects keep their output schedules. The following video segment starts after that freeze. Select freeze points at least one output-frame interval before source end. Crossfade on a video segment overlaps it with the previous video segment and shortens both the video and original-audio timeline by the same amount. Freeze transitions and overlapping incoming/outgoing crossfade windows are rejected.

`compileTimeline` returns explicit segment output bounds. `sourceToOutput` maps source points through trims and insertions and returns multiple candidates for repeated ranges, so a future director must choose explicitly. Changing segment durations requires resubmitting output effects at their desired compiled positions; absolute output timestamps are never silently shifted or interpreted as source timestamps. Operations at output second 7 always apply at output second 7. Do not use a source video's full-job transcript timing without mapping it to the generated clip first.

## Supported edits

| Representation                                                         | Supported behavior                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `zoom` operation                                                       | Static, zoom-in, zoom-out, normalized focus, linear or cosine easing, scale 1–3; one output frame per `zoompan` input frame       |
| Global crop / `crop` operation                                         | Center crop to requested aspect; normalized source crop or timed reframing; normalized region bounds validated                    |
| `freeze_frame` segment                                                 | Selected frame repeated for a frame-aligned duration; silent original audio during freeze                                         |
| `transition` operation                                                 | Fade-in at output start, fade-out at output end                                                                                   |
| Segment `crossfade`                                                    | Video `xfade` with matching original-audio `acrossfade`; uniform dimensions, frame rate, format, time base                        |
| `image_overlay` / `emoji_overlay`                                      | Owned, validated static PNG; normalized position and width, opacity, alpha fades                                                  |
| `text_overlay` operation                                               | Approved font selector, bounded size, hex color, optional outline/shadow; UTF-8 text files with expansion disabled                |
| Original audio and `music_track`, `sound_effect`, `voiceover` entities | Enabled state, source trims, output offsets, gain, endpoint fades, output mute intervals and linearly interpolated gain keyframes |
| Caption tracks                                                         | Language/script/source-reference metadata, output-timed cues and styling, visibility and burn-in                                  |

Audio gain, fade, mute and music/sound effects are typed track entities and controls rather than duplicate operation payloads. Freeze and crossfade are typed segment entities rather than free-floating operations. Unknown operation types and unknown payload fields are rejected. Original video without audio produces silence. Tracks are resampled to 48 kHz stereo, trimmed, delayed and mixed without automatic gain normalization; a limiter prevents mix clipping. Short tracks end naturally; long tracks are clipped to output duration. Keyframes specify absolute linear gain, replacing base gain from their first point onwards. Endpoint fades multiply the result; use keyframes for fades in the middle of a track.

Timed zoom/crop windows may not overlap. Image/text overlays can overlap and are composited in operation order; burned-in caption tracks follow those overlays. Position coordinates interpolate within the available canvas so `0.5` centers the overlay. PNG width is a fraction of output width; scaling preserves aspect ratio within both that width and the output height. Text font size is output pixels. Production renders copy approved font files into the workspace and use explicit fontfile paths (Arial/Times/Courier on Windows; Liberation2 on Linux). Override with EDIT_FONT_SANS, EDIT_FONT_SERIF, EDIT_FONT_MONO. Text wraps conservatively within the canvas; oversized blocks fail rather than truncate. English/Latin text rendering is tested; complex-script shaping, fallback coverage and multilingual translation are not certified.

Emoji uses a controlled PNG asset reference and never a system emoji font. Upload a PNG you have rights to use, or provide an approved licensed PNG through the same owned asset registration process; `emoji` is descriptive metadata, not a font-rendering instruction. No third-party emoji or music downloader is included.

Automatic ducking, speech separation, face tracking, arbitrary transitions, overlay entrance motion, animated images, final exports and 1440p/4K are explicitly outside this release. `EDIT_RENDER_FINAL` is reserved but rejected by the worker. Existing burned-in captions on the source remain part of its pixels.

## APIs

All endpoints require the existing JWT and scope records to the authenticated owner. The backend currently has no global route prefix; use these routes directly against its base URL. Response wrapping follows the existing response interceptor.

| Method | Route                            | Body / result                                                                                                           |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/ai-editor/plans`               | `{ jobId, clipId, plan }`; creates revision 1                                                                           |
| GET    | `/ai-editor/plans/:id`           | Plan and server-derived source/output metadata                                                                          |
| PUT    | `/ai-editor/plans/:id`           | `{ revision, plan }`; optimistic revision update                                                                        |
| POST   | `/ai-editor/plans/:id/validate`  | Empty body validates stored plan; optionally submit a complete proposed plan directly; returns compiled bounds/duration |
| POST   | `/ai-editor/plans/:id/preview`   | Empty body; durable version and asynchronous job                                                                        |
| GET    | `/ai-editor/plans/:id/versions`  | `?page=1`; `{ items, page, pageSize: 25 }`, newest first                                                                                                    |
| GET    | `/ai-editor/versions/:id`        | Status, progress, error and a one-hour signed playback URL on success                                                   |
| POST   | `/ai-editor/versions/:id/cancel` | Cancel queued/active preview; completed versions reject cancellation                                                    |

Structural/timeline/asset errors use the shared `{ success: false, error: { code, message, details: [{ path, message }] } }` envelope. Unknown or unauthorized assets return unavailable errors without revealing another owner's media. POST `/ai-editor/versions/:id/retry` retries a failed, retryable immutable snapshot with a new queue generation (up to three manual retries). Cancelled/completed versions cannot restart. Permanent validation failures require a new corrected revision. API responses omit storage keys, source object internals, asset ETags and execution tokens. Source/asset content fingerprints remain server-side.

Minimal create body (replace the example IDs with an owned, completed clip of at least 10 seconds):

```json
{
  "jobId": "0123456789abcdef01234567",
  "clipId": "0123456789abcdef01234568",
  "plan": {
    "schemaVersion": 1,
    "timestampSystem": "output_seconds",
    "video": {
      "aspectRatio": "preserve",
      "resolution": "720p",
      "fps": 30,
      "segments": [
        { "id": "main", "type": "video", "sourceStart": 0, "sourceEnd": 10 }
      ]
    },
    "audio": {
      "original": {
        "gain": 1,
        "automation": [
          { "time": 0, "gain": 1 },
          { "time": 5, "gain": 1 },
          { "time": 6, "gain": 0 },
          { "time": 8, "gain": 0 },
          { "time": 9, "gain": 1 }
        ]
      },
      "tracks": []
    },
    "operations": [
      {
        "id": "zoom-1",
        "type": "zoom",
        "start": 4.2,
        "end": 6.8,
        "params": {
          "fromScale": 1,
          "toScale": 1.3,
          "focusX": 0.5,
          "focusY": 0.4,
          "easing": "easeInOut"
        }
      }
    ]
  }
}
```

For music: use Studio `POST /studio/projects`, then `POST /studio/projects/:id/assets/upload` with `{ name, mimeType, size }`, PUT to the returned signed URL, and `POST /studio/projects/:id/assets/complete` with `{ assetId }`. Wait until the asset is `ready`. Reference that `assetId` in an editing audio track. The existing upload worker checks declared object size/type, probes the media, and persists actual duration/streams. Editing additionally enforces ownership, allowed MIME type, R2 existence/size, trim range and audio streams; it probes again immediately before rendering. PNG overlays use the same workflow. Assets remain subject to their Studio project's lifecycle; removing that media can make future renders fail. Existing completed edit versions are independent R2 objects.

An example music track is `{ "id": "music", "role": "music_track", "assetId": "OWNED_ASSET_ID", "start": 0, "sourceStart": 0, "sourceEnd": 10, "gain": 0.1, "automation": [{ "time": 0, "gain": 0.1 }, { "time": 6, "gain": 0.1 }, { "time": 7.5, "gain": 0.6 }, { "time": 8, "gain": 0.1 }] }`. Add a `sound_effect` track at `start: 7` with its own source trim. Uploaded audio must be long enough for the requested trim.

## Worker and operational limits

API processes only publish jobs. Existing `MEDIA_WORKER_ROLE=all` consumes editing previews too. For a separate worker set `MEDIA_WORKER_ROLE=editing` and run `npm run start:worker:dev` or the existing production worker command. It uses the render-only media module, with no new AI provider dependency. Studio's existing upload metadata worker still needs to run (`all` or `studio`) for uploaded assets to become ready.

Configure `EDIT_RENDER_CONCURRENCY` (default 1), `EDIT_RENDER_TIMEOUT_SECONDS` (default 1800, range 10–7200), and `EDIT_SOURCE_MAX_BYTES` (default 500 MiB), plus `EDIT_OUTPUT_MAX_BYTES` (default 200 MiB). Existing `MEDIA_HOST_CONCURRENCY`, `FFMPEG_THREADS`, and `MEDIA_COMMAND_TIMEOUT_SECONDS` still bound shared native processing. Keep the host command deadline at or below the editing timeout. Local media probing has a 30-second timeout. Editing forces approved demuxers (MOV/MP4, MP3, WAV, OGG, PNG), permits only file/pipe protocols, streams downloads with size limits and conditional ETag checks, and performs a complete video/audio decode before publication. R2 connections have a 10-second connect and 120-second idle timeout. Worker execution leases expire after 60 seconds and are renewed every second only while still valid. Progress, upload intent and publication require the matching token and a fresh lease. Temporary workspace names include version ID and attempt, with random isolation for overlapping attempts; cleanup runs after child processes close.

Fixed Phase 1 budgets: 600-second sources/outputs, 24 segments, 60 operations, 8 external audio tracks, 40 gain points and 30 mute windows per track, 3 caption tracks with 150 cues each, 100 MiB per extra asset and 300 MiB aggregate extra media, PNGs within 4 megapixels, source video within 8.29 megapixels, preview sides at most 1920 pixels, and a resolution/duration/effects complexity budget. An atomic MongoDB admission document limits each owner to 5 admitted previews; the worker verifies admission again. Redis limits writes to 20/minute and reads to 120/minute. The host/worker gates enforce rendering concurrency independently. JSON/form bodies under `/ai-editor/` are limited to 1 MiB. Output uses an FFmpeg byte cap and post-render size/duration checks. Multi-segment graphs use a conservative 256 MiB raw-frame buffering estimate including source span and branch count; edits exceeding it fail explicitly. At most 8 image overlays and 150 total burned caption cues are admitted. These are conservative application limits, not a certified OS memory ceiling.

The worker reports queued/processing/completed/failed/cancelled states, persists progress, retries 3 times with exponential backoff, polls cancellation every second and applies a deadline to the whole render/download workflow. Each attempt uploads to a distinct private `job-sources/edits/<owner>/<clip>/<version>/<executionToken>.mp4` key. Only the fenced winning key is published; pending attempt keys form a durable cleanup ledger. A stale worker can delete only its own key. Upload intent is durable so interrupted/abandoned objects can be removed. Completed publication is never rolled back because a later status write failed. Every 30 seconds, worker reconciliation repairs missing queue publication, marks terminal abandoned executions failed, and retries failed/cancelled output cleanup. All workers use the same DB predicates and idempotent keys.

## Verification

Run `npm run typecheck`, `npm run build`, and `npm test -- --runInBand ai-editor` from `backend`. To enable the actual media integration suite, set `EDIT_FFMPEG_PATH` and `EDIT_FFPROBE_PATH` to existing executable paths before running Jest. Tests explicitly skip that suite when these variables are absent. No binary package was added to application dependencies.

Real-media tests generate synthetic source/audio/PNG assets, render every supported effect family, probe duration/size/streams, render silent sources/freezes, and decode mixed audio to check frequency amplitudes across speech/music/effect windows, synchronization and clipping. Service tests cover ownership predicates, unavailable media, optimistic revisions, deterministic publication, retries, final failures, cleanup and preserving durable success. Service tests use mocks. `npm run test:editing:storage` additionally runs real Redis/BullMQ, production media validation/rendering, actual FFmpeg, and AWS SDK requests against a streaming local S3 stand-in. It requires EDIT_TEST_REDIS plus the media binary paths. `npm run test:editing:flow` provides the full Nest HTTP/JWT → Mongo → queue → worker → private storage workflow, revision concurrency and failed-version retry checks; it requires EDIT_TEST_MONGOD or an explicitly supplied EDIT_TEST_MONGO_URI and always selects a uniquely named disposable database. The local SSO store is an adapter and object storage is not live R2. Current verification gaps and exact results are recorded in AI_EDITOR_AUDIT.md. No live production credentials are read by these scripts.

Filter construction follows the [FFmpeg filter reference](https://ffmpeg.org/ffmpeg-filters.html); render specifications remain derived artifacts, never the editing source of truth.

New Studio asset uploads use `job-sources/studio-assets/...` in the private source bucket. Existing `studio/...` assets keep their existing keys; deployments with public legacy assets need a separate migration. Drain old editing workers before rolling out the attempt-key change. Historical versions without ETags require a fresh plan/version for content-frozen guarantees.
