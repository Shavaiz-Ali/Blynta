# Production backend reliability investigation — 2026-10-19

Scope: backend fixes for the supplied October 17–19 worker/API logs. No production credentials, records, queues, assets or processes were changed. No frontend changes or database migration are required. Production confirmation remains outstanding.

## 1. Highlight retry stack overflow: reproduced and corrected

`JobsProcessor` reuses `job.transcript` on resume. Mongoose hydrates it as a DocumentArray with subdocument parent references. `artifactHash()` in `backend/src/media/pipeline-cache-identity.ts` recursively enumerated these internal references while building the highlight cache identity, before calling the provider. Fresh provider transcripts are plain objects, which explains the first provider failure followed by stack overflow on retries.

Reproduction used the real compiled JobSchema and a Mongoose model without a database: construct a job containing one transcript row, then call `artifactHash({segments: job.transcript, configuration: 'test'})`. Baseline throws `RangeError: Maximum call stack size exceeded`; repeated stack frames are `canonical` and `Array.map` in `pipeline-cache-identity.js` around line 23. This is local stack evidence consistent with the supplied resume logs, not a captured production stack trace.

The hash now converts actual Mongoose Documents to plain data without getters, virtuals or transforms, tracks ancestor cycles and bounds nesting. Plain and hydrated transcript hashes match. Shared acyclic references remain supported. Transcript contents are preserved. Large transcript duration reductions also avoid spreading all timestamps into `Math.max`.

Tests: `pipeline-cache-hydration.spec.ts` and the resumed processor case in `jobs-pipeline-cache.processor.spec.ts` use real hydrated data and verify media/transcript reuse without downloads, audio extraction or transcription. `jobs.processor.ts` also retains sanitized source stack locations in failure logs.

## 2. Render failures: evidence loss corrected; separate local zoom stall reproduced

Path: `EditRenderProcessor.process` → guarded revision/lease → validator → local source/asset staging → `EditingRenderer` → `buildRenderSpec` → `runCommandWithProgress` → upload → object verification → guarded publication.

Previously, command failures became an ordinary Error with no machine-readable exit status, and the worker reduced most failures to `EDIT_RENDER_FAILURE`. This prevented a diagnosis of the supplied revision 2 failures and retried deterministic command errors. The logs do not contain that revision's operations, stderr, failed phase, source/asset availability or process status. Its exact original cause remains unknown; the three short failures do not establish an FFmpeg filter, font, R2 or permissions problem.

`MediaCommandError` now carries internal exit/signal/spawn evidence. `render-failure.ts` classifies permanent command/validation/access failures separately from transient storage/network/process-resource failures. Bounded, sanitized stderr, failed phase and operation type names are logged; safe diagnostics are stored additively in `failureDetails`. Command arguments and signed URLs are not logged. Permanent failures use BullMQ's unrecoverable error; cancellation, resource gating, existing attempts, leases, cleanup and publication guards are retained.

Real synthetic rendering with FFmpeg 6.1.1 exposed a separate EOF stall: a 12-second clip with zoom from seconds 5–10 timed out with SIGTERM, while gain and emoji cases completed. The same compiled fixture completed when the final duplicate fps filter after zoompan was omitted; retaining that filter with a normalized timebase still stalled. The focused compiler change omits that duplicate only when an enabled zoom exists. zoompan already produces the requested CFR and the output encoder retains `-r`. Real integration assertions check 288 frames at 24 fps for the zoom and combined cases, along with duration and audio gain. This finding must not be presented as the proven cause of production revision 2 without its operations/error evidence.

Tests: `render-failure.spec.ts`, `edit-services.spec.ts`, and opt-in `ffmpeg-edit-renderer.integration.spec.ts`. Portable test binaries are ignored local artifacts, not application dependencies.

## 3. AI Studio timeout and oversized prompts

The supplied second model call hit its configured 30,000 ms abort signal after 30,189 ms. No Google HTTP rejection was recorded for that execution. The 47,786-byte prompt contained full capability schemas already included in context plus another full patch schema. Context also included prior edit snapshots despite supplying the complete current plan.

Intent/context now carries capability names, asset rules and dependencies. Generation/correction retains the full patch contract once, alongside the current complete plan, mapped transcript information, selected assets, session context and user request. Prior approved edits contain patch/revision rather than redundant complete beforePlan copies; persisted snapshots used for concurrency and audit are unchanged. User/clip/plan ownership and session scopes are preserved.

Controlled real graph + installed LangChain/Google adapter with synthetic HTTP measured the same fixture:

| Node | Baseline prompt bytes | Optimized bytes |
| --- | ---: | ---: |
| interpret | 31,952 | 3,127 |
| generate_patch | 46,623 | 17,798 |

These are local fixture measurements; production prompt size depends on the actual plan/history. Both model calls successfully completed through functionCalling in the controlled test. No live Google latency or model availability is established by synthetic HTTP.

Transient HTTP 408/429/500/502/503/504 and transport failures use bounded exponential backoff with jitter. All attempts share the existing three-call budget and 90-second execution deadline. Interpretation reserves a call for patch generation. Retry consumes the optional correction budget; it never reruns asset resolution or creates another proposal. Schema, authentication, model configuration and application errors are not retried as transient provider failures. Cancellation stops backoff, and each call timeout is capped by remaining time.

Optional `AI_EDIT_PATCH_TIMEOUT_MS` adjusts generation/correction only (integer 1,000–90,000); it is capped by remaining execution time. Omission preserves the model timeout. No timeout increase is required by this patch.

Tests: graph cancellation, expired deadline, successful transient patch retry without tool replay, exhaustion, existing revision/ownership cases, `transient-retry.spec.ts`, and `node scripts/test-proposal-provider.cjs`. The latter exercises the installed adapter/SDK with synthetic HTTP, including second-call success, 400/401/403/429/503, malformed structured output, token limit, timeout, redaction and application persistence failure.

## 4. Initial registered highlight failure: actual historical cause unavailable

The registered path resolves the current registry model/provider/decrypted credential for each generation and uses its configured endpoint, tokens, temperature and timeout. Previously its catch discarded the exception and usage recorded only `HIGHLIGHT_PROVIDER_FAILED`.

The same existing highlight schema now explicitly validates returned objects. A bounded iterative SDK error walk preserves safe HTTP status/reason, timeout/network, malformed output/token limit, adapter or application categories, including cyclic wrapped causes. Usage persistence failures cannot overwrite the original model error. Logs identify model IDs and elapsed time without key/header/prompt content. Existing provider retry limits and outer pipeline behavior remain in place.

The first production provider failure cannot be reconstructed from its generic message. A future approved attempt must supply `highlights.registered.failed` diagnostics before declaring its cause resolved. Tests cover nested 403/429/503 errors, schema/token/transport errors, circular error graphs and the actual service path.

## 5. Mongoose warnings

Backend source and seed update operations now use `returnDocument: 'after'` in place of deprecated `new: true`. Related expectations are updated. A real Mongoose query with a stubbed driver boundary verifies the after-update result and option forwarded to the collection. No warning suppression, filters, upserts or other query semantics were changed.

## Verification record

Completed verification:

- Backend build and compiled AI route/build-stamp checks passed. Complete `tsc --noEmit` passed, including tests. Older Google-validation fixtures were corrected to provide complete model settings and narrow the result union; no runtime validation was weakened.
- Full backend suite: **93 passed suites, 849 passed tests**; two opt-in suites / 12 tests skipped. This run was followed by focused checks for the final additions below.
- Focused reliability suite: **10 suites / 162 tests passed**.
- Real FFmpeg 6.1.1 integration: **9/9 tests passed** after the zoom fix, including exact 24 fps / 288-frame output and gain assertions. The baseline run had two zoom timeout failures (7/9 passed), and is not counted as a passing run.
- Final command/downloader/classification/SDK checks: **4 suites / 30 tests passed**, including real child exit and missing-binary behavior, supervisor timeout/kill classifications, and preserved existing downloader authentication translation. The typed command error's stderr is inspected internally for that existing translation, without adding authentication configuration or logging raw stderr.
- `node scripts/test-proposal-provider.cjs` passed with the installed LangChain/Google adapter and synthetic HTTP. No live inference or AWS access was used.
- Scoped lint for the substantive runtime changes passed. The existing highlight service still has **53 pre-existing lint errors**, independently reproduced by linting its HEAD contents; they concern unchanged legacy error handling and unused imports. They were not suppressed or broadly refactored. This is not a claim that repository-wide lint is clean.
- No deprecated `new: true` remains in backend TypeScript/source seed operations. `git diff --check` passed.

An interrupted earlier full-suite run and incomplete process output were not counted as passes. Test counts overlap and must not be summed. Production revision, real provider latency, R2 access and the original revision 2 render failure remain unverified.

## Safe deployment and recovery (requires separate approval)

1. Review and commit the backend patch. Build the target revision with the existing backend dependency/install procedure; run the regression checks. Preserve rollback artifacts and current media.
2. Inspect active render/pipeline work before scheduling a graceful API/worker rollout. Do not restart active workers blindly. Verify `dist/build-info.json`, health build revision/hash and worker startup time against the deployed build; local tests do not prove production is running this patch.
3. No migration or credential rotation is needed. `failureDetails` is additive. The timeout environment variable is optional; leave it unset initially.
4. After approval and revision verification, use the existing owner-authorized retry flow for the affected highlight job once. Valid saved video/audio/transcript should be reused. Do not delete artifacts or edit billing records. Confirm no stack overflow and inspect any remaining provider status before further retries.
5. For the failed render, inspect the saved revision and new safe diagnostics on an approved retry. Confirm source and referenced assets are accessible. Do not modify the EditPlan to force success. A permanent failure should stop immediately; transient storage/network failures retain bounded queue retries.
6. A controlled approved AI Studio request must verify real provider latency, second-call completion, one proposal and unchanged revision until apply. Observe cancellation and timeout categories; do not claim production recovery solely from synthetic HTTP tests.
