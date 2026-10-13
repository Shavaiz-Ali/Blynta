# Hardcoding audit and provider architecture refactor

Baseline: 1bf217f. The automated source inventory covers 1,085 tracked and newly added monorepo TypeScript/JavaScript files, including tests and legacy Studio as read-only scope. Secret values were never printed or copied. A later read-only database dry run inspected provider metadata with index creation disabled and changed zero fields.

## Important findings

Baseline line numbers below identify the original findings before refactoring. The machine inventory provides current file/line matches for remaining literals.

| Baseline file:line | Value | Problem | Destination | Consumers | Compatibility |
|---|---|---|---|---|---|
| backend/src/ai-registry/admin-ai.service.ts:280 | Credential check URL | Business service constructed an upstream request | Existing provider record + Google adapter + approved transport | Credential validation, admin UI | Pinned legacy policy and additive backfill |
| backend/src/ai-registry/admin-ai.service.ts:291 | 400/401/403/429 | Duplicated HTTP/error classification | Nest HttpStatus + provider-errors | Credential checks and generation | Existing serialized error codes preserved |
| backend/src/ai-registry/admin-ai.service.ts:37 | GoogleAdapter injection | Administration depended on one vendor | ProviderAdapterRegistry + ProviderValidationService | Admin, graph, highlights | Only implemented Google adapter enabled |
| backend/src/ai-registry/admin-ai.service.ts:97 | Default routing key | Repeated persisted key | AI_ROUTING.LEGACY_DEFAULT | Model registry, highlight routing, seed | Keep the existing single policy document |
| backend/src/ai-registry/admin-ai.service.ts:73 | Page size 25 | Repeated application policy | Shared PAGINATION | Admin registry and DTOs | Response shape and page sizes unchanged |
| backend/src/ai-registry/admin-ai.service.ts:283 | 15 second credential timeout | Operational value buried in a service | AI_LIMITS + validated AI_CREDENTIAL_TIMEOUT_MS + provider override | Validation service | Default remains 15000ms; retries remain zero |
| backend/src/ai-registry/google-adapter.service.ts:70 | Model lookup URL | Endpoint ignored provider configuration | Google adapter receives provider config | Model tests and generation | Approved Google origins/versions only |
| backend/src/ai-editor/agent/editing-graph.service.ts:41 | Direct Google execution | Graph coupled to a vendor implementation | ProviderAdapterRegistry | LangGraph model calls | Patch/CAS/tool budgets remain unchanged |
| backend/src/media/services/highlight-detection.service.ts:352 | Registered Google SDK factory | Registered highlights ignored provider endpoint configuration | Registry languageModel factory + protected transport | Highlight generation and metering | Legacy environment mode retained before provisioning |
| backend/src/media/services/highlight-detection.service.ts:169 | Legacy Groq endpoint fallback | Repeated compatibility default | Named legacy-provider-policy + existing LLM_BASE_URL | Pre-registry highlight jobs | Compatibility-only; not a supported registry adapter |
| backend/src/jobs/schemas/job.schema.ts:10 | JobStatus/SourcePlatform/ClipProcessingState | Backend/frontend duplicates could drift | @blynta/types/contracts | Schemas, jobs workers, main/admin UI | Every persisted value preserved; explicit Mongoose String types |
| apps/app/features/jobs/types.ts:12 | Frontend job enums | Second stage/status source | Shared contract re-export | Main job views/query hooks | Existing import locations remain usable |
| apps/admin/features/admin-jobs/types.ts:1 | Admin status union | Missing cancelling/cancelled | Shared contract + typed admin presentation mappings | Jobs list and detail | Adds correct presentation for existing persisted statuses |
| backend/src/users/schemas/user.schema.ts:11 | Plan identifiers | Duplicate plan identifier definitions | Shared UserPlan enum | Entitlements, billing, registry, admin selectors | Credit grants and Paddle mapping unchanged |
| backend/src/ai-registry/registry.contract.ts:3 | AI task strings | Repeated backend/frontend identifiers | Shared AI_TASK/AI_TASKS | Zod, selectors, routing | Same task strings and schemas |
| apps/app/features/ai-editor/models.ts:28 | Availability endpoint | Repeated API route literals | API_ENDPOINTS | Availability hook | Same HTTP contract and task query |
| apps/app/features/ai-editor/queries.ts:61 | Editor routes | Repeated dynamic path construction | Typed endpoint builders | Studio proposal/render/history hooks | Identifier encoding added; valid IDs unchanged |
| apps/admin/features/admin-ai/api.ts:84 | Admin AI routes | Endpoint strings scattered in transport | API_ENDPOINTS.aiAdmin | Admin queries and mutations | Added authenticated adapters metadata endpoint |
| backend/src/ai-editor/edit-plans.service.ts:30 | Edit queue and retry policy | Queue identifier lived in a business service; retries duplicated | edit.constants | Producer, processor, worker module | Same queue/job names, attempts, backoff and retention |
| backend/src/jobs/jobs.processor.ts:65 | Worker lock/stall defaults | Repeated processor options | MEDIA_WORKER_POLICY | Pipeline/render workers | Same fixed policy; concurrency still validated config |
| backend/src/ai-editor/edit-render.service.ts:47 | Editing resource budgets | Duplicated numeric fallbacks | EDIT_LIMITS + validated env | Renderer and admission | Existing byte/timeout budgets preserved |
| backend/src/storage/r2.service.ts:237 | URL TTLs/prefixes/video MIME | Repeated storage policy values | STORAGE_POLICY | R2 consumers/downloads/uploads | Existing prefixes and expiry semantics unchanged |
| backend/src/ai-editor/agent/editing-graph.service.ts:300 | Node names and recursion budget | Graph identifiers repeated | AGENT_NODE/AGENT_LIMITS | LangGraph | Topology remains code, no DB-editable graph |
| backend/src/app.module.ts:30 | Unvalidated startup configuration | Invalid config could fail late | common/configuration across API/workers | Bootstrap, registry, resources | Optional subsystems remain optional; invalid supplied values rejected |
| packages/auth/src/backend.ts:10 | Backend service URL binding | No protocol/embedded credential validation | Runtime URL guard at binding boundary | Main/admin/auth and compatible legacy consumer | HTTP internal bindings preserved; no new public secret |
| backend/src/jobs/jobs.constants.ts:31 | Legacy paid-model allowlist | Legacy compatibility identifiers still persisted | Intentionally retain compatibility policy | Old jobs only | New registry choices come from DB; no claim of OpenAI support |
| backend/src/billing/credit-pricing.ts:1 | Credit pricing rules | Existing billing source of truth must not be duplicated | Retain existing validated billing policy | Ledger/Paddle/credit accounting | No pricing migration or new collection |
| backend/src/users/schemas/user.schema.ts:26 | 5/50/200 credit defaults | Product grant rules, not AI provider settings | Retain PLAN_CREDITS source of truth | User creation and billing | No credit entitlement change |
| backend/src/youtube/youtube-oauth.service.ts:16 | OAuth/YouTube protocol URLs | Security-sensitive fixed integration endpoints | Intentionally retain named integration constants | YouTube OAuth/publication workers | No arbitrary issuer/credential target configuration |

## Implementation and ownership

The existing ai_providers collection now supports baseUrl, apiVersion, provider credential-check timeout settings and a configuration revision. AI models record the provider revision and a SHA-256 configuration fingerprint used by their last successful test. Provider IDs, encrypted credential AAD, model references, usage history and routing documents are preserved.

AdminAIService delegates credential validation to ProviderValidationService and execution to ProviderAdapterRegistry. The registry currently implements Google only. OpenAI and Anthropic records can remain disabled placeholders; they cannot be enabled, used to create operational models, or execute requests. GoogleAdapter owns authentication, request paths, SDK configuration, structured output parsing and usage extraction. The real SDKs were exercised through synthetic transport without paid calls.

Approved origins/API versions are a deployment-owned security policy; actual provider endpoint configuration is stored in MongoDB. The allowlist is not database-editable. The transport uses HTTPS, excludes embedded URL credentials/query strings from base URLs, checks all resolved IPv4 addresses, pins the chosen address during connection, and never follows redirects. Arbitrary headers are discarded. DNS and HTTP work honor cancellation, response/request bytes are bounded, retries remain zero, and failures use safe static messages. IPv6/private enterprise endpoints are intentionally unsupported.

Default routing remains the existing editing-default document, consumed by edit planning, refinement and provisioned highlight routing. No live task-specific policies were collapsed or rewritten. Introducing a task-scoped routing API would be a separate behavior change. The existing pre-provisioning highlight compatibility mode remains environment-configured and is explicitly separate from implemented registry adapters.

## Shared code and source of truth

- packages/types/src/contracts.ts owns public persisted job/clip stages, source platforms, subscription plan identifiers, AI tasks/error codes, shared model-setting limits/defaults and typed API/route builders.
- packages/types/src/generated is reproducible CommonJS/declaration output, checked in for the independently installed backend. It is generated by scripts/build-public-contracts.cjs, not a second manually maintained contract. A test checks byte-for-byte generation and backend/frontend resolution.
- provider-policy, provider-errors and provider-adapter.registry own approved endpoints, error classification, routing keys and implemented protocols.
- common/configuration validates required infrastructure, supplied numeric operational limits, feature switches, URL shapes, vault keys/version and billing JSON structure at API/worker startup. Existing domain validators still enforce their finer rules. Optional integrations remain optional. main.ts consumes validated runtime configuration.
- edit.constants, agent.constants, jobs.constants and storage.constants own existing queue names, bounded retries/timeouts, graph topology and storage policy.
- The main/admin frontend queries use typed API endpoints. Admin gets adapter capabilities/default endpoint values from an authenticated API. Public model availability never contains provider URLs or credential material.

## Significant values intentionally retained

- EditPlan Zod bounds, operation discriminators, timeline/compiler/FFmpeg flags and preset styles remain the authoritative engine contract or protocol implementation. Duplicating them in another global constants module would introduce drift.
- Credit grants, billing pricing/ledger rules, Paddle IDs and currency behavior retain their existing sources of truth. Paddle IDs remain configured, model token prices remain database-owned, and no new pricing collection was introduced.
- Legacy job model identifiers remain compatibility policy for existing jobs. New registry model lists are database-driven; this does not make legacy OpenAI/Anthropic names operational registry adapters.
- YouTube/OAuth endpoints remain fixed named protocol/security integration constants, rather than arbitrary admin-selected credential destinations. Existing queue constants in notifications, activities, mail and YouTube were reused.
- Different public pagination defaults remain intentional: admin/registry use 25, existing jobs API uses 20 with maximum 50. These were not silently homogenized.
- Mathematical units, percentages, boolean/status protocol values, UI copy and literal fixtures are intentional. Tests asserting persisted strings are compatibility baselines.
- Legacy Studio source was not changed. The shared auth URL guard accepts its existing valid HTTP/HTTPS bindings and public contracts preserve serialized values.

## Deployment and backfill

1. Include packages/types alongside backend in the deployment checkout. Backend package.json/package-lock.json now reference that local package. A backend-only directory archive is insufficient unless the shared package is packaged separately.
2. Install frontend workspace dependencies with pnpm and backend dependencies with npm ci. Checked-in runtime contracts permit backend production installs without a TypeScript compiler in the shared package. When editing the contract source, run node scripts/build-public-contracts.cjs from the monorepo root.
3. Preserve existing AI_CREDENTIAL_KEYS and key versions. The optional new AI_CREDENTIAL_TIMEOUT_MS defaults to 15000; no new secret is required. Invalid supplied startup configuration now fails clearly without echoing values.
4. Back up provider/model metadata, then run npm run migrate:ai-endpoints in backend. The inspected configured database dry run reported eligibleFields: 3 and changedFields: 0. The command disables automatic index/collection creation.
5. Review the dry run, then apply with npm run migrate:ai-endpoints -- --apply. It only fills missing approved Google fields, preserves IDs/credentials/models/routing/usage, and uses conditional updates. It does not overwrite explicit operator fields or reset existing model test state for the identical legacy endpoint.
6. Deploy API and all consuming workers before the new admin UI. Avoid mixed-version administrative writes/execution during rollout; older code does not honor configured endpoints or test fingerprints. Then deploy main/admin frontends.
7. Changing API version, endpoint, credential reference or provider operational settings invalidates prior authorization via revision/fingerprint checks. Run the model test again and enable/set the appropriate existing default.

Rollback keeps additive fields and encrypted records intact. If an endpoint/version was changed after rollout, restore the approved legacy configuration and retest before rolling back execution code. Never rotate a vault key by overwriting an existing key version, delete collections, or recreate providers to roll back this refactor. No apply migration or production deployment was executed by this task.

## Verification

- Full backend suite passed: 73 suites, 633 tests; 2 opt-in suites / 8 tests skipped.
- After provider fingerprint and shared plan hardening, 272 focused backend tests passed (same 8 opt-in skips). Final shared model-policy validation passed 95 provider/configuration tests. Final queue/credit-recovery checks passed 15 tests. These runs overlap; counts are not additive.
- Frontend/session/billing/contract regression batch passed 55 tests. Authenticated SSR and contract compatibility batch passed 24 tests. Final AI Studio and generated-contract checks passed 32 tests.
- Backend, main app and admin production builds passed. Shared types/auth and final main-app TypeScript checks passed.
- New provider/configuration modules passed lint; admin lint and changed main frontend consumers passed. The wider modified-backend lint run exposed existing type-safety/require-await debt in older media, YouTube and worker code. That whole-backend lint result is not claimed clean; it is a separate prerequisite for a repository-wide zero-warning lint gate.
- Original-source lint verification confirmed 53 existing errors in highlight detection, 22 in YouTube API handling and 4 in the activities worker. See [baseline evidence](hardcoding-lint-baseline.json); the new provider/configuration lint checks are clean.
- Actual SDK configured endpoint/authentication checks passed using a synthetic transport. Google credential list requests, network/private DNS rejection, address pinning, redirect resistance, stale provider/credential fencing and unsafe endpoint inputs are covered by deterministic tests.
- Provider/model/credential browser workflows passed at 390/1024/1440px with synthetic API/auth responses. Provider Save controls stay visible while the body scrolls. Temporary preview routes/processes were removed before the final builds.
- Configured database dry run passed: 3 missing provider fields, 0 changed fields. No index creation, apply migration, live provider generation or deployment was executed.

The JSON inventory is observational, not a claim that every literal should be extracted. Remaining production matches are classified above as protocol, compatibility, UI presentation, existing domain policy or test fixture values.

[Provider configuration preview](hardcoding-refactor-evidence/provider-dialog-1440.png) · [Browser results](hardcoding-refactor-evidence/results.json) · [Machine inventory](hardcoding-inventory.json)

## Modified and added files

- apps/admin/features/admin-ai/AIManagement.tsx
- apps/admin/features/admin-ai/api.ts
- apps/admin/features/admin-clips/ClipsView.tsx
- apps/admin/features/admin-jobs/components/JobDetailPage.tsx
- apps/admin/features/admin-jobs/components/JobsView.tsx
- apps/admin/features/admin-jobs/types.ts
- apps/admin/lib/navigation.ts
- apps/app/features/ai-editor/StudioWorkspace.tsx
- apps/app/features/ai-editor/models.ts
- apps/app/features/ai-editor/queries.ts
- apps/app/features/jobs/processing-state.ts
- apps/app/features/jobs/queries.ts
- apps/app/features/jobs/types.ts
- backend/package-lock.json
- backend/package.json
- backend/scripts/seed-ai-registry.ts
- backend/scripts/test-ai-provider.ts
- backend/src/activities/activities-worker.module.ts
- backend/src/admin/dto/list-query.dto.ts
- backend/src/ai-editor/agent/editing-graph.service.ts
- backend/src/ai-editor/agent/editing-graph.spec.ts
- backend/src/ai-editor/agent/proposals.service.ts
- backend/src/ai-editor/edit-plan-validator.service.ts
- backend/src/ai-editor/edit-plans.service.ts
- backend/src/ai-editor/edit-render.processor.ts
- backend/src/ai-editor/edit-render.service.ts
- backend/src/ai-registry/admin-ai.service.ts
- backend/src/ai-registry/admin-ai.spec.ts
- backend/src/ai-registry/ai-registry.module.ts
- backend/src/ai-registry/google-adapter.service.ts
- backend/src/ai-registry/highlight-routing.service.ts
- backend/src/ai-registry/model-registry.service.ts
- backend/src/ai-registry/registry.contract.ts
- backend/src/ai-registry/registry.controllers.ts
- backend/src/ai-registry/registry.schemas.ts
- backend/src/ai-registry/registry.spec.ts
- backend/src/app.module.ts
- backend/src/jobs/credits-recovery.service.ts
- backend/src/jobs/jobs-worker.module.ts
- backend/src/jobs/jobs.constants.ts
- backend/src/jobs/jobs.processor.ts
- backend/src/jobs/render.processor.ts
- backend/src/jobs/schemas/job.schema.ts
- backend/src/mail/mail-worker.module.ts
- backend/src/main.ts
- backend/src/media/services/highlight-detection.service.spec.ts
- backend/src/media/services/highlight-detection.service.ts
- backend/src/notifications/notifications-worker.module.ts
- backend/src/storage/r2.service.ts
- backend/src/users/schemas/user.schema.ts
- backend/src/youtube/youtube-api.service.ts
- backend/src/youtube/youtube-worker.module.ts
- docs/admin-ai-management-browser.cjs
- docs/ui-audit-data.cjs
- packages/auth/src/backend.ts
- packages/types/package.json
- apps/admin/features/admin-jobs/constants.ts
- backend/scripts/backfill-ai-provider-endpoints.ts
- backend/scripts/test-provider-adapters.cjs
- backend/src/ai-editor/agent/agent.constants.ts
- backend/src/ai-editor/edit.constants.ts
- backend/src/ai-registry/provider-adapter.registry.ts
- backend/src/ai-registry/provider-errors.ts
- backend/src/ai-registry/provider-policy.spec.ts
- backend/src/ai-registry/provider-policy.ts
- backend/src/ai-registry/provider-transport.service.ts
- backend/src/ai-registry/provider-transport.spec.ts
- backend/src/ai-registry/provider-validation.service.ts
- backend/src/common/configuration.spec.ts
- backend/src/common/configuration.ts
- backend/src/media/legacy-provider-policy.ts
- backend/src/storage/storage.constants.ts
- docs/hardcoding-audit.md
- docs/hardcoding-inventory.json
- docs/hardcoding-refactor-evidence/results.json
- packages/types/src/contracts.ts
- packages/types/src/generated/contracts.d.ts
- packages/types/src/generated/contracts.js
- packages/types/src/generated/package.json
- scripts/audit-hardcoding.cjs
- scripts/build-public-contracts.cjs
- scripts/tests/backend-config.test.mjs
- scripts/tests/shared-contracts.test.cjs

The user requested committing and pushing this verified refactor. Deploy backend/API workers and main/admin frontend consumers with the shared package as described above.
