# Database model registry and AI editing proposals

Implementation date: 2026-10-10. This extends the audited Phase 1 engine. Code is implemented and locally verified; production acceptance still requires the database and live-provider checks below. No Gemini seed or live model success is claimed.

Phase 2 subsequently adds main-app Studio, registered highlight routing, task policy and proposal rejection/approval claims. See [AI_STUDIO.md](./AI_STUDIO.md) for the current integration; the sections below describe the original agent foundation.

## Architecture and preserved boundaries

AIRegistryModule owns provider metadata, the encrypted credential vault, model configuration, deterministic routing, administration and provider usage. AIEditingAgentModule lives under src/ai-editor/agent and imports the existing AiEditorModule. The graph retrieves owned data and proposes patches; approval calls the existing EditPlansService.update, which revalidates the full merged plan and uses the existing revision CAS. Preview remains POST /ai-editor/plans/:id/preview through the existing BullMQ worker, FFmpeg, private R2 and immutable versions.

The renderer, timeline compiler, demuxer/protocol restrictions, ETag checks, media/output limits, lease fencing, private attempt keys and cleanup safeguards remain intact. The only persistence extension to EditPlan is a server-only lastAppliedProposalId written in the same atomic revision update. Existing full-plan updates remain supported. The environment-based highlight detector and billing/credit behavior were not migrated or replaced. Workers import the original editor module and do not run the LLM graph.

## Schemas and indexes

| Collection | Purpose | Significant indexes |
| --- | --- | --- |
| ai_providers | Allowlisted adapter, code, name, enabled flag, default credential reference | Unique code |
| ai_provider_credentials | AES cipher/IV/tag/key version, label, enabled/archive flags, revision and validation metadata | Provider index; unique providerId + label |
| ai_models | Provider/model identity, credential override, capabilities, settings, plan access, priority, pricing, test fingerprint and archive status | Unique providerId + modelId |
| ai_model_policies | Single editing-default routing document and revision | Unique string _id |
| ai_agent_sessions | Owner, clip, plan, actual last selected model and status | Owner + clip + creation time |
| ai_agent_messages | Separate bounded messages and tool results, execution/proposal/model references | Owner + session + creation time |
| ai_edit_proposals | Owner, clip/plan/session, base revision, patch, before-plan snapshot, summary, outcome, request fingerprint | Unique owner + requestId; owner + clip + creation time |
| ai_model_usage | Per-call outcome, real token metadata when available, latency, provider/model snapshot, pricing snapshot and estimated USD | Unique executionId + call; model + creation time |

Mixed plan/patch snapshots are parsed through the actual Phase 1 Zod contracts before use. Establish database indexes before accepting traffic. Unit checks verify index declarations, not real concurrent Mongo uniqueness enforcement.

## Credential encryption and administration

CredentialVault uses AES-256-GCM, a fresh cryptographically random 12-byte IV, and a 16-byte authentication tag. AAD binds provider ID, credential ID and key version. Master keys are strictly validated base64 representations of 32 random bytes and are loaded only from AI_CREDENTIAL_KEYS; they are never persisted in Mongo. Missing keys, tampered data and identity mismatch fail closed with sanitized errors. IV/tag/cipher/key-version fields are select:false. Credential writes encrypt before persistence and return a separate metadata query. Masked placeholders are rejected.

The admin UI submits write-only password fields using direct authenticated requests, outside TanStack mutation caches; it resets the password form after each attempt and retains only safe metadata in query caches. Keys are not saved to browser storage or returned by read APIs. LangChain serialization is tested to exclude the actual key. Credential replacements increment a revision and invalidate model availability until a successful test with that revision. Unreferenced credential removal archives/disables its cipher; referenced removal returns conflict. Model removal archives its metadata/history and refuses the current default.

Existing JWT authentication and AdminGuard require an active privileged admin session. Durable existing Activities records audit authorized management intents before writes, using safe record IDs/action names and pending status; these intent records do not certify write outcomes. The API response reports the operation outcome. Audit failure prevents the configuration write. SDK/provider failures never expose raw error payloads or keys.

Rotation: retain the old key in the keyring, add a new independent key under v2, and set AI_CREDENTIAL_KEY_VERSION=v2. New replacements use v2; old records still decrypt with v1. Re-enter provider credentials through the write-only replacement flow (or implement a separately reviewed batch migration), retest affected models, and remove v1 only after all old cipher records have migrated. Automatic bulk re-encryption is not included.

## Registry, availability and entitlements

Only Google is implemented through the current LangChain ChatGoogle Node adapter. OpenAI/Anthropic can have disabled provider metadata, but cannot be enabled or selected; no fake adapters exist. Database values cannot load code or define endpoints. Gemini identifiers are syntax checked, and the model test verifies the configured identifier via Google's Models.get API plus a minimal structured-output request. Models remain unavailable until a successful test with the current enabled credential. Credentials are rechecked at every model call; no decrypted key enters Redis.

The existing billing-managed User.plan is reread from the database for each request/call. Free rejects every explicit model override and uses the configured Gemini default. Pro and Business may request only selectable models explicitly allowed for that plan. Business has no universal entitlement. Auto uses one atomic routing document; concurrent changes cannot create two defaults. Missing/disabled/untested defaults return controlled errors. There is no automatic fallback or silent switch of a premium selection. A routing/model identity change during an execution stops the request.

GET /ai/models/available returns plan, selectionAllowed, nullable defaultModelId and only safe usable model metadata. No credential IDs, keys, private pricing or admin settings are returned. The user app provides useAvailableEditingModels with immediate staleness and refetch on focus; the backend remains authoritative.

## Administrator APIs and UI

All routes below use JWT, privileged AdminGuard and the Redis AI rate guard. List APIs accept bounded page, search, enabled and providerId filters as applicable; they return items/page/pageSize=25. Search is escaped, not executed as arbitrary regular expression syntax. Usage summaries aggregate actual persisted records and explicitly distinguish requests with known pricing.

| Method | Route | Behavior |
| --- | --- | --- |
| GET/POST | /admin/ai/providers | Paginated metadata / create allowlisted provider |
| PATCH | /admin/ai/providers/:id | Update fields, enable Google, choose/clear default credential; adapter immutable |
| GET/POST | /admin/ai/providers/:id/credentials | Safe metadata / encrypted creation |
| PATCH | /admin/ai/credentials/:id | Explicit replacement, label or enabled state; revision CAS |
| POST | /admin/ai/credentials/:id/validate | Bounded Google model-list authentication check; sanitized validity/latency |
| DELETE | /admin/ai/credentials/:id | Referenced conflict; otherwise archive and disable |
| GET/POST | /admin/ai/models | Paginated registry / validated model creation |
| GET/PATCH/DELETE | /admin/ai/models/:id | Detail / settings and access update / archive |
| POST | /admin/ai/models/:id/test | Actual model lookup and minimal structured request; persist fingerprint and usage |
| POST | /admin/ai/models/:id/set-default | Atomically replace the default routing pointer; free access required |
| GET | /admin/ai/usage | Recorded calls, tokens, estimated costs, latency and outcomes |

The existing admin layout now contains /ai, /ai/providers, /ai/models and /ai/usage. It provides search/filter/pagination, provider/credential selection, credential create/replace/validate/disable/remove, model settings/capabilities/plan access, enable/disable, default selection, test/archive and usage tables/cards. No credential secret is displayed after submission. The provider selector loads the first 25 providers; an existing model's provider remains represented if outside that page. Large registries need a searchable provider picker rather than expanding unbounded metadata reads.

Saving a full model configuration invalidates its test status even when the form resubmits settings; retest before use. Simple enable/disable toggles do not change the configuration fingerprint. Current provider retry setting supports exactly zero; unsupported nonzero settings are rejected rather than ignored. Admin connectivity tests cap output at 128 tokens. Enabled flags alone do not prove availability.

## Gemini seed/bootstrap and rollback

Seed/bootstrap are explicit operator commands and are never run at startup. Configure a verified intended Gemini identifier in the existing LLM_MODEL_NAME. The seed does not invent a default model ID, replace admin settings, or mark the model operational without a test.

~~~powershell
# From backend, after safe database access has been authorized:
npm run seed:ai-registry
# Explicitly import existing LLM_API_KEY, encrypted under the active master key:
npm run seed:ai-registry -- --bootstrap-credential
# Only when intentionally replacing the prior bootstrap secret:
npm run seed:ai-registry -- --bootstrap-credential --replace-credential
~~~

Set AI_BOOTSTRAP_ADMIN_ID to an active administrator for credential audit. Bootstrap is idempotent using provider/model identities and a unique Environment bootstrap credential label; existing defaults and credentials are preserved unless replacement is explicitly requested. Model starts disabled/untested. In admin, validate its credential, test the model, enable it and confirm/default its routing. The seed stores configured capability assertions for text/structured output only; actual model lookup/output must pass before selection. It does not certify untested vision/audio/tool capabilities.

Rollback: disable the new registry model/provider to stop AI proposals; keep the original LLM_PROVIDER/LLM_MODEL_NAME/LLM_API_KEY configuration for highlight generation. Keep the master keys while encrypted records exist. No billing rollback or video data migration is necessary because this feature does not debit credits or modify originals. Existing Phase 1 previews/full-plan APIs remain independent.

## Bounded LangGraph and tools

The actual StateGraph executes load_context → interpret → resolve_information → generate_patch → validate. Missing/ambiguous transcript matches go directly to clarification. Invalid patches receive at most one correction and another validation; infrastructure failures/stale revisions stop without a paid corrective guess. Unsupported requests return unsupported. Successful proposals are saved as pending, never rendered automatically.

The graph uses LangChain structured-output envelopes with outcome, summary and patchJson. The JSON string contains the actual strict patch contract. This avoids sending Phase 1's arbitrary descriptive metadata dictionary as a native Google tool schema; decoding, merging, timeline and asset validation still use the same original Zod schema. It is not a second editing representation or executable command layer.

| Tool | Input | Authorized result |
| --- | --- | --- |
| get_clip_context | Empty; owner/clip/plan fixed by server closure | Source/output duration, revision, compiled timeline, source dimensions, transcript availability |
| get_current_edit_plan | Empty | Latest owned plan only |
| get_available_assets | Empty | Up to 50 owned ready PNG/approved audio metadata records; no keys/URLs |
| search_transcript | phrase <=200 characters | Exact/approximate segment bounds, confidence, ambiguity and all output candidates |
| validate_edit_patch | Actual strict patch | Merge against latest owned revision and run Phase 1 media/timeline validation |

Each tool independently reloads owner-scoped plan/job data. Source job transcript times are clamped to the clip and translated to clip-relative source times, then mapped across every video segment. Coarse segment timestamps are identified as coarse; no word-level precision is fabricated. Missing phrases, repeated/ambiguous ranges and unmapped ranges require clarification. Clip pixel dimensions are explicitly unavailable; job dimensions are labeled source dimensions.

Budgets: three model calls, ten tool calls, one correction, 90-second execution signal, per-call model timeout <=60 seconds, <=64 KiB serialized context, and model output cap <=8192 tokens per call. Reported total usage above 32000 prevents additional calls; this is an observed-usage boundary, not a provider-independent input-tokenizer guarantee. SDK retries are disabled. Redis allows three costly calls/minute, 20 other writes/minute, 120 reads/minute; AI_AGENT_DAILY_REQUEST_LIMIT defaults to 50 proposal requests per owner/day. These are explicit resource limits, not new credit charges. Per-plan/per-model quota administration is a future policy extension.

## Patch and proposal lifecycle

~~~json
{
  "baseRevision": 2,
  "changes": [{
    "action": "add",
    "operation": {
      "id": "zoom_001", "type": "zoom", "start": 0.5, "end": 2,
      "params": {"fromScale": 1, "toScale": 1.3, "focusX": 0.5, "focusY": 0.5, "easing": "linear"}
    }
  }]
}
~~~

Operation actions: add, update (operationId plus complete same-ID/type operation), remove, enable, disable. Audio actions: add_audio_track, update_audio_track (trackId plus complete same-ID/role track), remove_audio_track, enable_audio_track, disable_audio_track, update_original_audio (complete original controls). Track/control schemas are derived directly from planSchema. Patch size is limited to 20 changes; a target may be changed once per patch. Unrelated settings/operations/tracks are preserved. Resulting plan and referenced assets must pass the original validator. Segment/caption restructuring is not supported by this patch version and must be reported as unsupported rather than simulated.

| Method | Route | Contract |
| --- | --- | --- |
| POST | /clips/:clipId/ai-edit/propose | planId, prompt <=4000 chars, requestId UUID, optional sessionId/modelId |
| GET | /clips/:clipId/ai-edit/proposals/:id | Owned saved proposal/status; no automatic approval |
| POST | /clips/:clipId/ai-edit/proposals/:id/apply | Recheck ownership/base revision, merge/revalidate, existing atomic revision update |
| GET | /clips/:clipId/ai-edit/sessions/:id | Owned session and latest 50 user/assistant messages |

Request IDs are unique per owner and bound to a request fingerprint. Replays return the same record without another provider call; changed reuse conflicts. Failed runs require a new request ID. Generation interrupted for over five minutes is marked failed when read, never automatically replayed against the provider. Session context uses eight bounded messages and two prior approved proposals with before-plan snapshots, allowing the model to propose an inverse when unambiguous. This is not an unrestricted undo/rebase mechanism; every inverse still validates and needs approval.

Approval checks the proposal's exact base revision and calls existing full-plan update with a server-only receipt marker. Concurrent approvals/manual updates compete on the same CAS; a lost response can be repaired from the marker without applying twice. Proposal-status persistence follows the atomic plan write; these two collections are not transactionally committed together. If a subsequent proposal replaces the marker before reconciliation of a lost status write, the older pending proposal remains stale and must be inspected rather than reapplied. Explicit preview rendering creates the next immutable version through the unchanged renderer.

## Usage and operational behavior

Each physical generation invocation has a unique execution/call identity, model database ID plus external provider model ID snapshot, provider ID, task type, latency and outcome. Actual SDK input/output/total counts are recorded when present; absent counts remain unknown. Configured pricing is snapshotted per call for estimates, not hardcoded market prices or user billing. Idempotent usage insertion avoids double accounting if writes are retried. Admin model tests are recorded separately from edit proposals. Unknown pricing is labeled unknown in the UI. Provider success followed by malformed proposal data can still be a successful paid API call; proposal failure is separately persisted.

Errors are sanitized for authentication, unavailable model, quota/rate, timeout and general provider failure. No premium fallback is implemented. Model/credential state is read directly rather than cached; availability changes are enforced at the next request/call boundary. Database writes and media HEAD validation are not instantly interruptible by the graph signal; no later provider call starts after that signal aborts.

## Files and environment

New backend: src/ai-registry (schemas/contracts/vault/Google adapter/registry/admin APIs/rate guard/tests), src/ai-editor/agent (patches/tools/graph/sessions/proposals/controller/module/tests), scripts/seed-ai-registry.ts, scripts/test-ai-provider.ts. Existing changes: app.module imports the agent; AiEditorModule exports its existing plan/validation services; EditPlan gains internal receipt metadata; existing update optionally records that receipt; main.ts also bounds new AI request routes to 1 MiB. One new real FFmpeg test proves patch output uses the original compiler. The local storage harness can write independent --ai-audit evidence.

Frontend: apps/admin/features/admin-ai and four AI management routes in the existing layout; apps/app/features/ai-editor/models.ts provides the available-model query hook. No chat/timeline editor was added.

Dependencies pinned: @langchain/core 1.2.17, @langchain/langgraph 1.4.21, @langchain/google 0.2.10. Backend Jest transforms only the Google adapter's ESM eventsource parser to support existing CommonJS tests. Native Node Google client construction also passed without any provider request.

New environment: AI_CREDENTIAL_KEYS (secret JSON keyring), AI_CREDENTIAL_KEY_VERSION (v1 default), AI_AGENT_DAILY_REQUEST_LIMIT (50 default), AI_BOOTSTRAP_ADMIN_ID (operator bootstrap only). Optional live smoke reads only explicit AI_TEST_API_KEY and AI_TEST_MODEL_ID; it never loads application .env. Existing Mongo/Redis/R2/JWT/LLM settings remain in place.

## Verification and limits

| Command | Result |
| --- | --- |
| npm run typecheck (backend) | Passed |
| npm run build (backend) | Passed |
| npx eslint src/ai-registry src/ai-editor/agent | Passed, zero errors/warnings |
| npx jest --runInBand --json --outputFile ai-agent-jest-results.json *> ai-agent-jest.log with installed EDIT_FFMPEG_PATH/EDIT_FFPROBE_PATH | 546 passed, zero failed, three skipped; 67 passed suites/68 total; 96.91 seconds |
| npm run typecheck (apps/admin) | Passed |
| npm run build (apps/admin) | Passed; /ai, /ai/providers, /ai/models, /ai/usage built |
| npx eslint features/admin-ai 'app/(main)/ai' (apps/admin) | Passed |
| npx eslint features/ai-editor/models.ts and npm run typecheck (apps/app) | Passed |
| node scripts/test-editor-storage.cjs --quick --ai-audit with installed media binaries and isolated Memurai | Passed: real queue/production validator+renderer, full decode, conditional bounded downloads, private signed GET, corrupt media rejection, cancellation, failed PUT with actual Bull retry, unchanged source hash/temp cleanup |
| git diff --check | Passed; normal LF/CRLF conversion warnings |
| npm audit --json | Reported 12 advisories (3 moderate, 7 high, 2 critical) in existing backend dependency families; no broad dependency upgrade was performed |

Deterministic tests use mocked provider replies and repository adapters. The real LangGraph, tool objects, strict patches and original validation execute. New test suites cover encryption/IV/tampering/identity/rotation; safe replacement and admin intent writes; routing/free/premium/disabled/untested/current-credential policies; transcript mapping/absence; graph correction/timeout/tool failure; stale ownership/session/proposal requests; idempotent approval; and actual patched FFmpeg output. Mongo uniqueness/races and real HTTP persistence remain unverified. Three skipped tests are existing Mongo replica-set credit tests, identified in ai-agent-test-summary.json. Earlier failures (Jest ESM loader, DOM timeout classification, a seed enum type and test lint issues) were corrected before final gates.

The local 3-second storage regression rendered in 7.589 and 5.259 seconds; Node RSS observations were 139/148 MiB and sampled native FFmpeg working set 175 MiB. These synthetic measurements are not LLM latency, a ten-minute benchmark or a hard 1 GiB memory guarantee. Evidence is ai-agent-test-summary.json and ai-agent-storage-results.json. Phase 1 benchmark evidence is preserved separately.

Not run: live Gemini smoke, actual Mongo seed/bootstrap, full HTTP → Mongo → agent → approval → queue E2E, production R2 IAM/SSO checks and authenticated browser UI interactions. The Phase 1 audit's database blocker remains: prior Mongo credentials were exposed, automatic approval rejected reuse, and no rotation/explicit reauthorization was provided. Local mongod remains unavailable under the earlier Windows Application Control constraint. Do not bypass that rejection. Rotate configured credentials locally and authorize isolated database testing before seed/E2E verification. No credentials were read or reused for those checks during this implementation.

Other remaining prerequisites: deploy verified encryption keys/indexes; retest configured models against real provider credentials; validate deployment-host crash/resource behavior and legacy public asset migration from the Phase 1 audit; review existing dependency advisories and unrelated full-backend lint debt. Administration intents are audited before mutations but do not have a post-write outcome update. Multi-document proposal/plan receipt races need real Mongo verification. Provider retries/fallbacks, bulk key migration, arbitrary segment/caption patches and admin-defined per-plan/per-model quotas are not claimed operational.

## Frontend integration recommendation

Keep the future interface focused on prompt → saved proposal → explicit approval → explicit preview. Show Auto for premium users and automatic routing for free accounts using selectionAllowed; submit only registered model database IDs. Generate one request UUID per prompt and use GET polling for repeat status checks. Refresh current revision after conflict and display the patch before approval. Surface clarification/unsupported outcomes as questions/limitations, preserve coarse timestamp labels, and never submit raw filters or execute an LLM tool from the browser. Do not describe multi-provider premium selection as operational until those adapters and live model tests exist.

References used for the new integration: [LangChain ChatGoogle](https://docs.langchain.com/oss/javascript/integrations/chat/google), [LangGraph graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api), [Gemini Models API](https://ai.google.dev/api/models). Local installed types and runtime verification governed the implementation. The required local Next.js use-client guide was read before frontend changes.
