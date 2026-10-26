# AI registry architecture audit and operating rules

Audited 2026-10-26 against the repository and the supplied record snapshot. No production database or live customer key was inspected or modified.

## Confirmed cause before changes

`backend/src/ai-registry/provider-validation.service.ts`, `targetModel`, originally included null/missing model credential bindings only when `provider.defaultCredentialId` equaled the credential under test. The supplied model had a null credential binding and its provider had no default credential, so validation excluded it before making any provider request. Matching provider IDs and text capability alone could not satisfy that predicate.

`ModelRegistry.configured` explicitly uses `model.credentialId || provider.defaultCredentialId`. Thus the supplied configuration also lacked the credential binding required for runtime. This is a combination of incomplete runtime configuration and an unnecessarily restrictive validation policy. Credential testing should be possible before choosing runtime defaults.

The original validation fallback sorted by priority and record ID and selected the first model. That was deterministic ordering, but silently made a policy choice among several eligible models. Validation also returned cached success without making a fresh provider request. Provider `configured` looked only at the provider default credential, overlooking direct model bindings and conflating stored configuration with operational readiness.

## Sources of truth

| Relationship/state                | Stored authority                                                      | Resolution                                                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider identity                 | `ai_providers._id`, unique `code`                                     | Record IDs connect models and credentials; `code` is a display/catalog identifier, not a model ID or adapter switch.                                                                                                        |
| Implementation                    | `AIProvider.adapter`, `ProviderAdapterRegistry`, `provider-policy.ts` | Only registered adapters with approved endpoints can operate.                                                                                                                                                               |
| Credentials owned by provider     | `ai_provider_credentials.providerId`                                  | Multiple credentials are supported, encrypted with authenticated provider/credential identity. Labels are unique per provider.                                                                                              |
| Provider default credential       | `ai_providers.defaultCredentialId`                                    | Single pointer; no inferred fallback to another stored key.                                                                                                                                                                 |
| Models owned by provider          | `ai_models.providerId`                                                | Multiple models; `(providerId, modelId)` is unique. `modelId` is the upstream identifier.                                                                                                                                   |
| Model credential binding          | `ai_models.credentialId`                                              | Non-null overrides the provider default. Null/missing means inherit the provider default. An unavailable override never falls back silently.                                                                                |
| Auto default                      | `ai_model_policies` record `_id: editing-default`                     | One atomic model-record pointer. `isDefault` is computed in Admin listing, not stored on model records.                                                                                                                     |
| Provider/credential default model | No separate record exists                                             | Validation can select explicitly; otherwise it prefers the eligible Auto default, then a sole eligible model.                                                                                                               |
| Task selection                    | Model `tasks`, `ModelRegistry.supportsTask`, `resolveUserModel`       | Explicit/pinned selection or shared Auto default, then task and account access checks. Missing legacy `tasks` means editing planning/refinement, not highlights. There are no independently configurable defaults per task. |
| Capabilities                      | `ai_models.capabilities`                                              | Validation requires text; operational AI tasks and the structured model test require text and structured output. Other capabilities are administrator declarations, not automatically verified by a text probe.             |
| Credential identity evidence      | Credential validation metadata                                        | `lastValidationStatus` preserves historical success across unrelated access, quota, and transport errors. Latest attempt status/message are separate. Confirmed authentication rejection marks invalid.                     |
| Model readiness evidence          | Model test metadata                                                   | Successful structured test must match current credential ID/revision and provider revision/configuration hash. Model configuration changes reset its test status. A known-invalid credential blocks tasks.                  |

There is also a deliberately retained legacy highlight path: `HighlightRouting.select` allows environment-based highlighting only before any Auto policy exists. `highlight-detection.service.ts` reads `LLM_PROVIDER`, `LLM_MODEL_NAME`, `LLM_API_KEY`/`GROQ_API_KEY` for that compatibility mode. Once a registry default exists, registry routing fails closed rather than falling back to environment credentials. This is separate configuration, not an additional source of registry defaults. The working media pipeline is unchanged.

## Validation and runtime policy

`POST /admin/ai/credentials/:id/validate` still accepts no body. It additionally accepts `{ "modelId": "<AI model registry record ID>" }`; this is not the upstream model name.

1. Load the enabled, non-archived credential and its enabled provider. Require a registered adapter and approved endpoint.
2. Eligible probe models belong to that provider, are enabled and non-archived, support text, and have either no direct binding or a binding to the credential being tested. Models bound to a different credential are excluded, even if selected explicitly or by Auto.
3. An explicit selection must be eligible. Without one, prefer the eligible Auto model; otherwise require exactly one eligible model. Zero or several candidates produces `valid: false`, `category: configuration_error`, with credential/model access undetermined. No provider request occurs and the key is not marked invalid.
4. Decrypt the credential under test and send a minimal real generation request through its provider adapter. No hardcoded probe model and no successful response cache are used. Probe selection does not persist bindings or model-readiness evidence.
5. Preserve sanitized upstream error classification. Authentication rejection, permission/model denial, malformed requests, quota, network failure, timeout, and storage failure remain distinct. A denied model request alone does not prove an invalid key or establish authentication success.
6. Recheck provider revision and model selection/configuration, then fence credential metadata updates by credential revision and previous attempt timestamp. A concurrent change returns failure rather than certifying stale state.

Runtime execution and model testing retain the stricter binding rule: direct model credential, else explicit provider default. Merely adding or validating a key does not choose it for runtime. This avoids silently changing environments or access boundaries when a second key is added. A single credential can serve multiple models through inheritance or several explicit bindings.

## Default and deletion safety

Provider defaults are one field on one provider document. Auto is one policy document with a unique `_id`; concurrent changes are atomic last-writer-wins pointer updates. Concurrent first-time upsert collisions retry against the existing singleton. No second `isDefault` flag is written.

Selecting a provider default checks credential ownership, enabled state, and archive state. Direct model binding writes also check these states. Referenced credentials cannot be deleted through Admin; unreferenced deletion archives the encrypted record. A referenced Auto model cannot be archived until the pointer changes.

Disabling a credential/provider/model intentionally suspends dependent execution. Pointers remain for explicit re-enabling; runtime checks reject disabled, archived, missing, mismatched, or stale dependencies and never silently choose a different key/model. Cross-collection references are application-enforced, not Mongo foreign keys or a multi-document transaction. A concurrent disable/archive and assignment can leave an unavailable reference; it cannot make that reference operational. Admin readiness exposes this state. Hard multi-document referential invariants would require a separate transactional design, not a claim made by these changes.

The Auto default currently must allow free users; free Auto additionally requires an adapter with `freeAuto` support. A shared default must support every task for which it will be used. Separate task/provider defaults and additional adapters are future capabilities, not fields introduced by this fix.

## Admin state meanings

- `enabled`: administrator permits use; this does not certify connectivity.
- `credentialConfigured` / `credentialCount`: enabled, non-archived stored credentials exist.
- `configured`: an enabled credential is selected as provider default or bound directly to a non-archived model. No implicit default selection occurs.
- `validatedCredentialCount`: credentials with historical successful validation status; this is not a live connectivity check. Latest validation attempt/message is displayed separately.
- `modelCount`: non-archived models, whether enabled or tested.
- `operationalAdapter`: implementation exists; it is not provider readiness.
- `accessibleModelCount` / `operational`: models currently pass runtime readiness checks, including enabled status and test evidence for current configuration. This is evidence from prior requests, not a live provider health monitor or a guarantee against future upstream failure.
- Model `lastTestStatus`: historical test result. `readyForTasks` is computed using current configuration so credential replacement/disabling does not leave the UI claiming readiness.

## Required steps for the supplied configuration

1. Validate credential `6adf276ec2b66427f358c2a8`. The singleton enabled text model can now be probed with no default; alternatively pass `{ "modelId": "6adf27e0c2b66427f358c2af" }`.
2. For runtime, set the provider's `defaultCredentialId` to that credential, or bind the model directly. Keep null on the model if inheritance is intended.
3. Test the model with that binding. Enable it, configure its supported tasks and plan access, and select the Auto default if Auto execution is wanted. Testing a disabled model remains supported for this setup workflow; credential validation requires an enabled text candidate.
4. Execute an authorized task. Credential validation alone does not replace the structured model test.

The existing provider code `gemini-flash-latest` is unusual but does not cause the failure. Preserve it: it is unique and returned in the user catalog. New providers should use a stable provider label such as `google-gemini`. Generic model contracts no longer require a Gemini prefix; adapter implementations own provider-specific behavior. OpenAI/Anthropic remain unimplemented Admin adapters and Groq remains available only in legacy highlighting; installing their SDK packages is not adapter support. No new adapter or provider rename is implied.

## Change scope and compatibility

Changes are limited to registry validation, Admin services/controllers/contracts, current-readiness checking, the Admin AI page/API types, and focused tests. Existing no-body validation requests, null inheritance, global routing document IDs, records, encryption, and task access checks remain compatible. New response fields are additive. Ambiguous validation now requires explicit selection instead of choosing by priority; repeated validation makes real requests. No schema migration, production record write, commit, or deployment is required or performed.

Tests exercise real service resolution against predicate-evaluating in-memory repositories, encrypted credentials, and synthetic provider HTTP responses. Existing suites cover upstream failures, credential replacement, revision fencing, task/plan checks, and secret redaction. Singleton upsert contention is simulated at the repository boundary; this is not a live MongoDB concurrency/load test. Live provider access with customer keys is not part of local verification.

### Changed files

| File                                                     | Purpose                                                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/ai-registry/provider-validation.service.ts` | Explicit probe selection, singleton-only fallback, fresh requests, complete model context fencing.                          |
| `backend/src/ai-registry/model-registry.service.ts`      | Known-invalid credentials cannot qualify for task readiness.                                                                |
| `backend/src/ai-registry/admin-ai.service.ts`            | Separate configuration/readiness states, archive-aware bindings, concurrent first-default retry, safer model test outcomes. |
| `backend/src/ai-registry/registry.contract.ts`           | Optional validation model selection and generic upstream model identifier syntax.                                           |
| `backend/src/ai-registry/registry.controllers.ts`        | Validate and forward the optional probe model record ID.                                                                    |
| `backend/src/ai-registry/provider-policy.ts`             | Remove the obsolete successful-validation cache TTL.                                                                        |
| `backend/src/ai-registry/credential-resolution.spec.ts`  | Predicate-based resolution and runtime inheritance regressions.                                                             |
| `backend/src/ai-registry/admin-ai.spec.ts`               | Fresh-request expectations, binding/status cases and simulated singleton contention.                                        |
| `backend/src/ai-registry/registry-routes.spec.ts`        | Authenticated optional-body API compatibility and malformed selection rejection.                                            |
| `apps/admin/features/admin-ai/AIManagement.tsx`          | Probe model selection with pagination, accurate status labels and setup instructions; adapter-driven controls.              |
| `apps/admin/features/admin-ai/api.ts`                    | Additive status response types.                                                                                             |
| `docs/ai-registry-architecture.md`                       | Audit, source-of-truth map, policy, setup steps and verification limits.                                                    |

### Verification

- AI registry suite: 10 suites, 159 tests passed, including authenticated local HTTP routes. Localhost tests require execution outside the sandbox's socket restriction.
- After test-helper lint corrections: focused Admin/resolution suites passed again (54 tests).
- Backend type check and Nest production build passed.
- Admin type check passed.
- Installed Google SDK/credential-probe/LangChain synthetic-transport regression script passed; no upstream request was made by this local check.
- Git diff whitespace check passed.
- Targeted backend lint introduced no errors: production changes, the new resolution suite and route additions pass. The existing `admin-ai.spec.ts` retains the same 13 unsafe-`any` errors reproduced from its original HEAD version; these predate this change.
