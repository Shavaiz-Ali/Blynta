# Blynta Phase 1 editing engine audit

Audit date: 2026-10-10. Scope: backend implementation and fixes in this working tree. Changes remain uncommitted. This report distinguishes unit verification, real local media/storage verification, and outstanding full database verification.

## A. Architecture assessment

The editor is a separate Nest domain under src/ai-editor. EditPlan is the editable source of truth; EditVersion stores immutable revision snapshots. Strict Zod contracts feed a pure timeline compiler and FFmpeg graph compiler. API processes authenticate and validate, Mongo stores plans/versions/admission, and BullMQ delivers preview work to the existing media worker infrastructure. Rendering reuses media inspection, cancellation context, process registry and the host concurrency gate. R2 streams source/assets and publishes private attempt-specific output. The generation pipeline and original media are preserved; no editing credit debit or conversational UI was added.

This boundary is suitable for Phase 2: an LLM can propose a complete validated plan derived from the current revision. Client/LLM content cannot provide arbitrary FFmpeg filters, commands, URLs or local paths. The director must handle ambiguous repeated source ranges and optimistic revision conflicts. Full production readiness is conditional on section C.

## B. Significant findings and fixes

Paths below are relative to backend. Verification marked unit uses adapters/mocks and does not prove Mongo atomicity.

| Severity | Affected file(s) | Root cause | Actual fix | Verification |
| --- | --- | --- | --- | --- |
| Critical | src/ai-editor/edit-render.processor.ts; edit.schemas.ts | Overlapping executions could overwrite a shared version output or delete a winning render | Unique execution-token output keys; durable pending-key ledger; token, generation and fresh-lease predicates; preserve durable completion after an ambiguous response | Unit stale-upload/durable-success/cleanup cases; real private upload path. Mongo race verification outstanding |
| High | edit-render.processor.ts | Expired workers could publish or update progress; stale retry deliveries could run again | 60-second leases renewed every second only before expiry; fenced writes; old-generation rejection; held-lease delivery delayed; abort on failed renewal/deadline | Unit cancellation, duplicate, held lease and stale generation tests; real ordinary cancellation. Hard worker crash outstanding |
| High | edit-admission.service.ts; edit-plans.service.ts | Count-then-insert allowed concurrent per-owner oversubscription and stale releases | Atomic admission document with five slots; generation-specific keys; worker recheck; orphan reconciliation | Code/predicate review; eight-request Mongo race harness provided but not executed successfully |
| High | edit-plans.service.ts; edit-render.processor.ts | Failed previews lacked a safe bounded restart; permanent errors were blindly retried | Failed-only immutable snapshot retry, max three manual generations; three automatic attempts; permanent validation/404/412 becomes unrecoverable | Unit permanent/stale retry behavior; real Bull retry after PUT outage. HTTP/manual retry still outstanding |
| High | edit-plans.service.ts; edit-plan-validator.service.ts; edit-render.service.ts; storage/r2.service.ts | Ownership alone did not freeze mutable source/asset content | Persist source and version asset ETags; conditional GET; enforce byte caps while streaming; revalidate owner and real streams | Unit owner/unavailable-media validation; real wrong-ETag rejection and download byte limit |
| High | studio/studio.service.ts; storage/r2.service.ts | New reusable assets could use a public storage namespace | New uploads use job-sources/studio-assets; editing outputs use private source namespace; owner-scoped signed playback; API views omit object keys and execution fields | Studio regression assertion; local unsigned GET 403, signed GET 200 with cryptographic signature verification. Live bucket policy outstanding |
| High | edit-render.service.ts; media/services/media-inspection.service.ts; ffmpeg-edit-renderer.ts | Native probing/decoding allowed excessive resources and container external references | Approved demuxers, file/pipe protocols, MOV external references disabled, stream/dimension/codec validation, input/output budgets, conservative multi-branch buffering budget, full output decode before upload | Real source/asset rendering, corruption rejection, silent/VFR/portrait probes and full decode; policy unit tests |
| High | media/utils/run-command-with-progress.ts | On Windows detached PowerShell could exit successfully without running FFmpeg | Detached process groups only on non-Windows; Windows retains tracked process-tree cancellation | Reproduced detached true/false; production renderer and ordinary cancellation pass on Windows |
| Medium | ffmpeg-edit-renderer.ts; edit-render.service.ts | Font discovery and absolute Windows paths made text rendering unreliable | Copy approved fonts; relative font/text paths with workspace cwd; expansion disabled; bounded wrapping and explicit fit rejection | Real Latin text with special characters/newlines in apostrophe-containing workspace; integration harness now supplies explicit approved font |
| Medium | ffmpeg-edit-renderer.ts; timeline.ts | VFR normalization after frame selection could collapse source timing | Normalize FPS before trims/freezes; frame-rounded segment/crossfade timeline | Real silent portrait VFR test: 60 frames at 30 fps, 720x1280; real freeze/crossfade and audio synchronization |
| Medium | ffmpeg-edit-renderer.ts; edit-plan.contract.ts | Tall overlays and excessive caption/image fan-out could exceed canvas or resources | Preserve overlay aspect within width and height; eight image overlays; 150 total burned caption cues; bounded text | Real tall transparent PNG and overlays; contract tests. Extreme narrow/wide images are not exhaustively certified |
| Medium | edit-render.processor.ts | Missing queue publication, parent-status drift and abandoned workspaces could persist | Generation-aware queue repair, per-item failure isolation, current revision status recovery, deferred output cleanup; temp janitor with resolved-path checks, 130-minute age and active-lease check | Unit publication/cleanup cases; normal temp cleanup verified locally. Real Mongo reconciliation/crash sweep outstanding |
| Medium | edit-plans.service.ts; edit-plans.controller.ts; main.ts; edit-rate-limit.guard.ts | Unbounded requests/history and internal record disclosure | Owner-scoped allowlisted views, 25-item pages, bounded page index, 1 MiB editor request body, Redis read/write limits, strict unknown-field rejection | Contract/service unit checks and code review; real HTTP enforcement outstanding |
| Medium | common/filters/all-exceptions.filter.ts | Typed editing errors lost field details through shared exception formatting | Preserve structured code/issues in existing error envelope | Dedicated exception-filter tests pass |
| Low | app.controller.spec.ts; notifications/notifications.service.spec.ts; studio/studio.service.spec.ts | Existing test mocks disagreed with current service behavior and new private key prefix | Correct health database mock, saved-notification return value and upload-key expectation | Full regression suite passes |

New worker failure logs retain categorized codes and timing rather than raw user text/native output. R2 file-upload logs omit local filenames and object keys. Existing unrelated backend logging was not broadly rewritten.

## C. Remaining issues and prerequisites

1. **Mandatory full end-to-end workflow remains unverified.** The supplied test-editor-flow.cjs must still prove Nest HTTP/JWT → real Mongo → Bull → production worker/FFmpeg → private storage → durable status/signed URL, revision history, admission races and failed-version manual retry. Official local mongod was blocked by Windows Application Control (spawn UNKNOWN). No successful Mongo-backed editing test is claimed.
2. A connection diagnostic exposed the configured Mongo URI in tool output. Those credentials require rotation. Automatic approval review rejected subsequently authenticating to Atlas with them. They have not been reused after rejection. Rotate locally and explicitly authorize a uniquely named disposable database test; do not paste credentials into chat.
3. Local S3 verification uses actual AWS SDK requests and signature verification but is a loopback stand-in. Live Cloudflare R2 bucket privacy/IAM, production signing and provider abort behavior are not certified. Local flow harness substitutes the SSO session store; real session-store integration is outstanding.
4. Linux host-gate behavior, hard worker crashes, native process orphans, reconnect storms and maximum-size stress require deployment-host tests. Application limits and sampled RSS are not an OS-enforced 1 GiB guarantee. Use host concurrency one and a memory limit validated on the target host.
5. Legacy public studio/... objects need a separate migration. Drain old editing workers before rolling out attempt-key publication. Historical snapshots without ETags require a fresh revision for content freezing. Legacy fixed-key cleanup records are not automatically migrated.
6. Full repository lint remains failing. A captured full run reports 1080 errors/118 warnings before final formatting; it includes two formatting errors subsequently fixed. Expanded final scoped lint still reports existing shared exception-filter typing debt. Do not describe repository lint as passing.
7. Temp janitor processes at most 100 matching directories per sweep; a very large active/young backlog can delay older cleanup. Very extreme PNG aspect ratios and all 600-second/effect combinations are not exhaustively tested. Complex-script shaping/translation, animated images, director behavior, final exports and 4K remain outside certification/scope.

## D. Supported editing operations

Validated means strict contract/timeline/media checks are implemented and tested; media evidence is synthetic local FFmpeg, not every production input.

| Operation | Implemented | Validated | Real FFmpeg | Limitations |
| --- | --- | --- | --- | --- |
| Trim, split, reorder, repeated video ranges | Yes: ordered segments | Yes | Yes | Single owned source; branch buffering budget can reject distant/repeated ranges |
| Freeze frame | Yes: typed segment | Yes | Yes | 0.1–10 seconds; silent original audio; no crossfade on freeze |
| Zoom in/out/static | Yes | Yes | Yes | Scale 1–3; normalized focus; linear/cosine easing; no face tracking |
| Aspect ratio/global crop/timed crop | Yes | Yes | Yes | No overlapping timed zoom/crop windows; output sides <=1920 |
| Fade in/out | Yes | Yes | Yes | Endpoint transitions only |
| Video crossfade with audio crossfade | Yes | Yes | Yes | Neighbor video segments, frame aligned; reject incompatible/overlapping windows |
| Image and emoji overlays | Yes | Yes | Yes | Owned static PNG <=4 MP; eight overlays; emoji is controlled PNG, not system font |
| Text overlay | Yes | Yes | Yes | Approved fonts; bounded fit; tested Latin; complex scripts not certified |
| Original audio gain, mutes, automation, fades | Yes | Yes | Yes, amplitude/timing checks | Linear absolute gain; silent source yields silence |
| Music, sound effect, voiceover | Yes: track roles | Yes | Yes, mixing/timing checks | Owned uploaded audio; 48 kHz stereo; no automatic ducking or speech separation |
| Captions visibility/style/burn-in | Yes | Yes | Yes | Output-timed cues; total burn-in 150; no translation; source burned captions remain pixels |
| 720p/1080p preview at 24/30 fps | Yes | Yes | Yes | H.264/AAC; no final/4K export |

## E. Testing results and exact commands

Run commands from D:\web_dev\Blynta\backend. Environment setup used for initial native tests:

~~~powershell
$env:EDIT_FFMPEG_PATH=Join-Path $env:TEMP 'blynta-editor-test-tools\node_modules\ffmpeg-static\ffmpeg.exe'
$env:EDIT_FFPROBE_PATH=Join-Path $env:TEMP 'blynta-editor-test-tools\node_modules\ffprobe-static\bin\win32\x64\ffprobe.exe'
$env:EDIT_TEST_REDIS='C:\Program Files\Memurai\memurai.exe'
~~~

| Command | Actual outcome |
| --- | --- |
| npm run typecheck | Final pass |
| npm run build | Final pass |
| npx jest --runInBand --json --outputFile editor-jest-results.json *> editor-jest.log | 489 passed, zero failed, three skipped; 62 passed suites/one skipped, 69.25 seconds |
| npx eslint src/ai-editor src/app.controller.spec.ts src/media/utils/run-command-with-progress.ts src/media/services/media-inspection.service.ts src/storage/r2.service.ts | Final focused pass: zero errors, one existing R2 buffer typing warning |
| npm run lint:check -- --format json --output-file editor-eslint-results.json | Failed: snapshot 1080 errors/118 warnings; two new formatting errors later corrected |
| Focused eslint command above plus src/common/filters/all-exceptions.filter.ts and its spec | Failed: 21 existing shared-filter errors and three warnings overall |
| node scripts/test-editor-storage.cjs | Passed on FFmpeg 6.1.1 and isolated Memurai; actual production validator/renderer, AWS SDK streaming, signed GET, unchanged original hash, cancellation and failed upload retry; benchmarks below |
| node scripts/test-editor-flow.cjs | Failed before Mongo startup: Windows Application Control. No full E2E result |
| git diff --check | Passed; Git emits normal LF/CRLF conversion warnings |

Initial full regression runs exposed obsolete health/notification mocks and the old Studio key-prefix expectation; corrected before the passing full suite. One earlier concurrent 1080p benchmark exceeded the harness's 120-second wait; the benchmark-only wait ceiling was raised to 300 seconds and the default storage benchmark reran successfully. Production timeout was not increased to hide that failure.

Final temporary FFmpeg test tools had disappeared. The first quick rerun consequently failed its executable-path precondition. Final local reruns use installed FFmpeg 8.1.1:

~~~powershell
$env:EDIT_FFMPEG_PATH=(Get-Command ffmpeg.exe).Source
$env:EDIT_FFPROBE_PATH=(Get-Command ffprobe.exe).Source
$env:EDIT_TEST_REDIS='C:\Program Files\Memurai\memurai.exe'
node scripts/test-editor-storage.cjs --quick
npx jest --runInBand ai-editor/ffmpeg-edit-renderer.integration.spec.ts
~~~

The first FFmpeg 8 storage rerun timed out waiting for Bull completion (worker error), and the separate integration suite passed three/failed one because default font discovery failed. The harness now reports queue error messages and uses the approved explicit font for overlay integration. Final storage quick rerun passed, including corrupt-media rejection, conditional downloads, active cancellation, signed playback, source hash/temp cleanup and a Bull job with at least two attempts. Final FFmpeg 8 integration rerun passed all four tests in 13.664 seconds. The first queue timeout was not reproduced on rerun; its root cause remains undiagnosed. Neither earlier failure is omitted.

Three skipped full-suite tests are the Mongo replica-set credit integrations: concurrent AI Clips/Studio reservation serialization and duplicate settlement; duplicate billing cycle/upgrade balance preservation; ledger update/delete rejection. Editing media integration did run: four tests cover VFR portrait, all effects/crossfade, silent freeze, and speech/music/effect synchronization without clipping. Editor service/contract suites add 25 tests. Existing generation, transcription, captions, activities, notifications, credits and billing unit regressions ran; live third-party integrations did not.

Evidence: editor-audit-test-summary.json, editor-storage-results.json and editor-storage-quick-results.json. Unit mocks are not represented as full E2E. Local storage test uses a read-only asset repository adapter; the production EditRenderProcessor database lifecycle is unit-tested, not exercised by that harness.

## F. Measured performance

Windows, FFmpeg 6.1.1, one local render worker; synthetic source with audio, overlay, text and zoom. Wall time includes downloads, probes, host gate, encode, full decode verification and upload; excludes fixture generation and queue waiting.

| Output | Render wall seconds | Observed Node RSS MiB | Bytes |
| --- | ---: | ---: | ---: |
| 3 s 720p cold | 28.620 | 104 | 760980 |
| 3 s 720p retry success | 14.157 | 110 | 760980 |
| 30 s 720p | 68.534 | 118 | 11254988 |
| 30 s 1080p | 95.998 | 131 | 16120544 |

Peak sampled native FFmpeg Windows working set was 322 MiB across that storage benchmark. Sampling included fixture generation; Node figures are observations, not a continuous peak. They do not certify maximum-plan memory, CPU utilization or portable throughput. Earlier concurrent testing increased render time. The FFmpeg 8 quick rerun ran alongside media tests: 3-second renders took 9.500 and 10.547 seconds, Node RSS observations 135/109 MiB; aggregate sampled FFmpeg working set 527 MiB includes concurrent tests and is not a comparable single-worker benchmark.

Budgets: 600-second source/output; source <=500 MiB default and <=8.29 MP; assets <=100 MiB each/300 MiB aggregate; default output <=200 MiB with native byte cap and postcheck; 24 segments/60 operations/eight tracks; 256 MiB conservative multi-branch frame estimate; concurrency one by default. No extrapolated ten-minute benchmark or hard OS memory certification is claimed.

## G. API and data contracts

All routes use existing JWT authentication and owner predicates, with existing response envelope. Strict schemaVersion 1 uses timestampSystem output_seconds and manual plans. Source trims/freezes carry explicit source coordinates; operations/cues use compiled output seconds. Unknown keys/types, nonfinite values, invalid intervals/assets and excessive complexity fail explicitly.

| Method | Route | Contract |
| --- | --- | --- |
| POST | /ai-editor/plans | jobId, clipId, complete plan; create revision 1 from owned completed source |
| GET | /ai-editor/plans/:id | Allowlisted plan with derived current revision status |
| PUT | /ai-editor/plans/:id | revision plus full plan; optimistic update, stale revision 409 |
| POST | /ai-editor/plans/:id/validate | Stored or complete proposed plan; compiled duration/bounds |
| POST | /ai-editor/plans/:id/preview | Immutable version; asynchronous stable generation job identity |
| GET | /ai-editor/plans/:id/versions?page=1 | Newest-first items, page, pageSize 25 |
| GET | /ai-editor/versions/:id | Status/progress/error/renderStats; one-hour signed playback on success |
| POST | /ai-editor/versions/:id/cancel | Durable queued/active cancellation; completed version cannot cancel |
| POST | /ai-editor/versions/:id/retry | Failed retryable snapshot; new generation, max three manual retries |

Lifecycle: queued → processing → completed/failed/cancelled. Automatic transient retry returns to queued; permanent failures stop immediately. Generation plus execution token/fresh lease fence persistence. Plan revisions do not mutate older version snapshots or published outputs. Polling returns projected records without storage keys, ETags, owner internals or tokens. Error envelope preserves code, message and field issues. Asset upload remains Studio signed-upload/register/metadata validation. Future patches must merge against the latest revision, validate the full result, then use optimistic PUT; there is no new patch/conversational endpoint.

## H. Phase 2 readiness

The contracts, timeline mapping, immutable previews and bounded renderer provide the foundation for User Prompt → LLM EditPlan Patch → Validation → Render → Preview. Phase 2 development can build against these contracts, but production acceptance is incomplete. Before declaring it ready, verify the Mongo HTTP workflow/races/manual retry/history, live private R2 and session store, and deployment-host crash/memory behavior; resolve rollout/migration prerequisites. No multilingual translation, conversational interface, 4K output or new credit behavior was implemented.
