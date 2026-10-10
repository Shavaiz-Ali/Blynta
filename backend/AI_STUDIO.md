# Phase 2 — main-app AI Studio integration

Implementation date: 2026-10-10. This is an extension of [AI_AGENT.md](./AI_AGENT.md) and the audited [Phase 1 engine](./AI_EDITOR_AUDIT.md). Production acceptance remains contingent on the live configuration and verification described below. The separately deployed `apps/studio` product, its editing agent, timeline and export flow have not been replaced.

## Features and frontend routes

| Route | Implementation |
| --- | --- |
| Admin `/ai`, `/ai/providers`, `/ai/models`, `/ai/usage` | Existing management pages retained; sidebar renamed AI Management, supported-task controls, loading skeletons, toast feedback and destructive-action confirmations added |
| Main `/dashboard` | Existing hero and credit-confirmation workflow retained; fabricated external model choices removed and shared task-filtered registry selector added |
| Main `/studio` | Recent owned edit plans, actual latest preview status, paginated completed jobs/clips, source thumbnails when existing metadata supplies them, start/continue actions |
| Main `/studio/[clipId]?jobId=...` | Responsive prompt-first workspace, original/edited playback, models, conversation, proposals, explicit approval/rejection, rendering, version history, downloads and owned assets |
| Existing clip detail | Adds Edit with AI alongside the existing separate-product Edit in Studio action |

Studio uses the existing authenticated main layout and DashboardLayout. Desktop has a video/assistant split; narrower screens stack the panels. Native accessible video controls provide play, seek, time and duration. Model selectors and proposal actions have labels/focus states. Distinct skeletons cover workspace, models, messages, versions and media. Native disclosure panels keep asset/history controls compact. No animations are required.

## Model management and task policy

The same `ai_models` collection now accepts `tasks`: `highlight_detection`, `edit_planning`, `edit_refinement`. Omitted tasks on historical model records mean editing/refinement only; they do not silently become eligible for highlights. Changing tasks invalidates the model test, alongside existing capability/settings/credential changes. The admin test uses the actual shared HighlightsResponseSchema when highlight support is declared; its minimal empty-highlights reply is a connectivity/schema check, not a video-quality benchmark. Otherwise the existing structured connectivity test is retained. All declared tasks still require enabled provider/credential, a valid test with the current credential revision, text/structured-output capabilities and subscription access.

`GET /ai/models/available?task=...` defaults to edit_planning. It returns safe model display metadata and a selectable flag. Free accounts have Auto only. Pro/Business accounts can select authorized, tested records; no unimplemented adapter appears operational. Premium accounts may have several registered Gemini records, but operational multi-provider support is not claimed. The common `editing-default` policy continues to supply Auto; configure its model for every task you intend to serve. There is no second registry or independent list of frontend models.

## Actual highlight routing and compatibility

New job creation accepts optional `modelId`, a database ObjectId. It rejects non-default legacy `aiModel` overrides on new requests. Existing historical jobs retain their previous `aiModel` field and legacy worker allowlist behavior.

Before credit reservation, JobsService checks existing source/output authorization and resolves the requested registered model through current account entitlements. It persists `highlightModel`: registry ID, provider ID, external model identity, a SHA-256 settings/capabilities/task signature and whether Auto was requested. This snapshot contains no credential or decrypted secret. The original credit amount/reservation/settlement flow remains intact; modelId joins the existing request fingerprint so changing selections under one credit operation is rejected.

Before highlight cache lookup and before every provider call, the worker/service rechecks the pinned registered model, current account access, task support and credential test. Auto stays pinned to the model chosen at creation, even if the global default later changes. Changed model identity or settings fails clearly; it never mixes configurations or silently chooses another model. Rotated credentials can resume after the model is retested, provided the model/configuration signature remains the same.

Registered calls use the existing Google AI SDK highlight adapter, existing highlight contracts/prompts/windowing/grounding/selection, and existing meteredGenerateObject billing instrumentation. The credential comes from the existing AES vault. Timeout/temperature/output limits come from the registry; SDK retries are disabled for registered calls. Actual returned token counts, latency, model identity and configured estimated cost are also recorded in `ai_model_usage`. Missing token metadata stays unknown. Provider errors are sanitized, and a failed registered window fails the job rather than substituting environment settings or presenting partial success. Original parent-job/Bull retry and billing semantics remain unchanged.

Compatibility is explicit: a new Auto request uses the working environment-based path only while no `editing-default` policy exists. Availability reports `compatibilityMode` for the highlight task in that condition. Once a policy exists, an unavailable/untested/task-incompatible default fails closed. Explicit model IDs always require authorization and never use the compatibility path. Existing jobs without a registered snapshot continue through their original environment path.

Cache identity retains source/transcript hashes, instructions, style/preset, prompt version and owner rules, and adds the registered selection/configuration signature. Results from another model/configuration cannot share the same new cache identity. Credentials never enter the cache. Existing cache/lease fencing, source integrity, output budgets, clip target rules, charging and settlement are reused.

## Backend endpoints added or extended

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/ai/models/available?task=...` | Task-filtered entitled models; safe selectable/default/compatibility metadata |
| POST | `/jobs` | Existing job creation plus optional registered modelId and persisted resolved highlight identity |
| POST | `/ai-editor/initialize` | Strict `{jobId, clipId}` owned completed-clip get-or-create |
| GET | `/ai-editor/plans` | Up to 25 recently updated plans scanned; latest plan per available owned clip, with actual latest preview metadata |
| GET | `/ai-editor/assets` | Up to 50 recent ready owned PNG/approved audio assets; no storage keys or media URLs |
| GET | `/clips/:clipId/ai-edit/state?planId=...` | Latest session and last 20 saved proposals for the owned plan; excludes before-plan and fingerprint fields |
| POST | `/clips/:clipId/ai-edit/proposals/:id/reject` | Owned pending-only durable rejection |
| POST | `/ai-editor/versions/:id/download` | Completed owned output, available owned source check, attachment-signed URL |

The existing propose/get/apply/session, plan validation/revision, preview/version/retry/cancel APIs remain the editing/rendering authority. Existing JWT/rate guards and body caps apply. Studio does not run FFmpeg, add billing charges, or write an alternate edit representation.

## Initialization and proposal lifecycle

Initialize first verifies an owned completed source clip, then reuses the most recently updated owned plan for that clip/job. A first plan has the original strict schema, one clip-relative video segment, original audio, no operations, and a 720p vertical preview profile. Existing plan creation still checks actual private media presence, source ETag, duration/resource constraints and the original validator/compiler.

New canonical Studio initializations set a server-only studioInitialization flag. A partial unique index on userId/sourceClipId/studioInitialization=true prevents concurrent initializer inserts. Duplicate-key recovery retrieves the winner. Historical/manual plans remain legal; their existing index/API is unchanged. Install this index before accepting traffic. Concurrent Mongo enforcement is not claimed tested by unit mocks.

The frontend initializes once per mounted clip using a guarded mutation. It does not blindly create on every render. Reloading safely uses the same backend initializer. React development duplicate effects are guarded, and server uniqueness is the final authority. Recent cards point to the clip's most recently updated plan; Studio does not offer a manual multi-plan picker.

Each new prompt has a new UUID; an uncertain network response retains the exact original body/UUID for an explicit retry. The 100-second request timeout accommodates the existing 90-second agent budget. There are no automatic mutation/provider calls on query invalidation or refresh. Reload retrieves saved session/proposal state. An unresolved retry is kept in mounted workflow memory, not persisted to browser storage; a full reload restores server-saved proposals rather than regenerating them. Explicitly dismissing a retry abandons local retry controls only.

The server determines edit_planning versus edit_refinement from whether the request supplies an existing session. The graph checks that same task on initialization and every call. Conversation history remains server-owned. Proposal cards describe timings and parameters from the validated structured patch, with the agent's summary as context; ordinary users do not see raw plan JSON.

Pending proposals can be applied or rejected. Approval first merges against the actual current revision, then atomically claims pending → applying before the original full-plan CAS. Rejection also uses a pending-only CAS, so it cannot win after approval claims the proposal. Rendering is separate. A plan-write failure resets applying to pending when no durable receipt exists; receipt recovery handles a lost successful response. An interrupted applying proposal offers explicit Resume approval. This is not a Mongo transaction: multi-document crash/race behavior still needs real database verification. The existing single-receipt limitation when later edits overwrite an unrepaired receipt remains documented in AI_AGENT.md.

GET state marks generating proposals older than five minutes interrupted without retrying an LLM, then reloads actual state. Clarification, unsupported, failed, applied and rejected states are displayed distinctly. A stale proposal explains the revision conflict and requires refreshing/new generation rather than overwriting newer changes.

## Rendering, signed playback and versions

Render preview is an explicit action against the existing immutable current-revision/profile identity. The original BullMQ service handles idempotent submission, admission, retries, cancellation, FFmpeg/resource limits, ETags, private R2 and cleanup. Active versions poll every 2.5 seconds; terminal states stop polling. Window focus refetches selected version metadata. Percentages appear only when the backend supplies progress.

Completed playback uses the existing authorized outputUrl; original playback uses the existing owned clip media-url hook. Media errors attempt at most one automatic authorized metadata refresh per source/version and expose a manual retry; changing signed URLs cannot create an automatic refresh loop. URLs are short-lived query data, never saved to browser storage. Raw storage keys are excluded from response projections. Account changes create a separate main-app query client and remount its children; old client cleanup clears its cache. This prevents prior conversation/signed media metadata from being reused in another account.

Version history has real revision/time/status and pagination. Selecting a completed version changes playback only. There is no restore or fake undo. Downloads request fresh authorized metadata and an R2 URL signed with a safe attachment filename. The R2 signing helper's optional filename parameter does not change existing callers. The button explicitly says Download preview; no separate full-quality export pipeline is invented. Proposal association is not fabricated when older version metadata lacks it.

## Assets and supported edits

The list and agent preserve the original ready owned PNG and approved audio MIME allowlists. Uploads explicitly reuse existing `/studio/projects`, project assets/upload and assets/complete APIs, followed by signed PUT to R2 and existing Bull metadata validation. Users choose an existing asset workspace or explicitly create one. These are reusable asset containers; no separate legacy timeline or render is altered, and no clip metadata is copied into a second Studio datastore. Uploads are capped to 100 MiB in this UI and accept PNG/MP3/WAV/M4A/OGG. The backend independently verifies registered bytes/type and validates native media. Refresh exposes assets once ready; no invented progress or validation success appears.

Suggestions advertise original-audio adjustment and bounded zoom only. Text, owned image/emoji overlays and owned audio tracks use the existing agent/patch engine. Missing assets prompt selection/upload. No stock library, arbitrary URL, translation, 4K, scene-cut agent, caption restructuring or manual timeline is presented as available.

## Files and fetching boundaries

Main feature files live in `apps/app/features/ai-editor`: contracts, presentation, queries, shared ModelSelector, StudioLanding, StudioWorkspace, ProposalCard and AssetUpload. The existing models.ts hook now accepts task and uses separate task keys. Main route files are under app/(main)/studio; hero, clip detail, dashboard navigation, QueryProvider, job input/query payload and frontend test scripts are extended.

Backend additions: ai-registry/highlight-routing.service/spec, shared media/highlight-result.contract, jobs/jobs-model-routing.spec and ai-editor/studio-integration.spec. Existing registry contracts/model/test/controller/module, API/worker job modules, job DTO/schema/service/processor, highlight service/spec, editor plan/schema/projection/controller, agent state/controller/approval/graph and R2 signing are extended. Admin feature API/form and navigation are updated. Seed declares the supported tasks on newly inserted disabled records; existing seed records are not overwritten.

TanStack keys group available models by task and editing plans, state, session, proposals and version pages by their identifiers. Query functions pass cancellation signals for the new GETs. Approval/rejection invalidate plan/state/proposal/history/recent metadata; render actions invalidate versions and plan. IDs prevent responses from a different selected version replacing its playback. Credential submission remains write-only and outside mutation caches. New pending prompt submissions are not stored in localStorage/sessionStorage. No new dependency/runtime or environment variable was required.

## Verification, limits and production prerequisites

| Check | Result |
| --- | --- |
| Complete backend Jest run with installed FFmpeg/FFprobe | 566 passed, 0 failed, 3 existing Mongo tests skipped; 70 suites passed; 109.858 seconds |
| Follow-up stale/interrupted approval regression | 8 passed after the final recovery adjustment |
| Frontend SSR/query integration and existing sharing/navigation regressions | 38 passed, 0 failed |
| Scoped backend lint | 32 files, 0 errors/warnings; unrelated baseline lint debt remains |
| Main/admin scoped lint and production builds | Passed, including the final downgrade UI follow-up |
| Backend typechecking/build | Passed |
| Git whitespace check | Passed |

Final verification results are recorded in phase2-test-summary.json and the final log/report files. The complete backend run uses installed FFmpeg/FFprobe and includes original media integration tests; deterministic repository/provider fixtures are not described as live E2E. Frontend Node tests execute the actual selector/card/presentation/query code with API/hook boundaries, actual SSR output and account-cache isolation. Builds verify both Next apps and backend. Corrections to initial tests, JSX replacement, type/format checks and query-timer cleanup were made before the final gates.

Not verified here: authenticated interactive browser journeys, actual Mongo initialize/approval/rejection races, live Gemini with encrypted credentials, seed/bootstrap, production R2 signed playback/download/CORS uploads, or external publishing/SSO. The prior automatic approval rejection remains: the exposed Mongo credentials must be rotated and isolated database testing explicitly authorized before reconnecting. No blocked credentials were read or reused. Existing three Mongo replica-set credit tests stay skipped.

Deployment order: apply the canonical initialization index; configure the existing encryption keyring and rotated database access; bootstrap disabled models using the documented explicit seed; set tasks and adequate timeout/output settings; test with the current credential; enable the provider/model and set a tested free-access default; deploy API and workers together, then the main/admin apps. Establish R2 CORS for the main app's upload origin and verify attachment response signing. Run isolated HTTP/Mongo/LLM/render/playback/download tests before declaring acceptance complete. Existing Phase 1 resource/crash/private-asset migration prerequisites and reported backend dependency advisories remain; they were not erased by this frontend integration.

Current bounded UI limits: provider form catalog initially loads its first 25 provider records; availability has the existing 100-model bound; recent plans scan 25 records; session state shows 20 proposals and session history 50 messages; ready assets show 50. Source thumbnails are reused when present; no new clip-thumbnail renderer was added. Model task tests validate schema/connectivity, not highlight quality. Retry UUIDs survive uncertain responses within the mounted workflow; refresh restores already persisted server state. Version restoration, caption/segment conversational patches, non-Google provider adapters and stronger multi-document transaction receipts are not included.
