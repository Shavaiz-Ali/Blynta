# Gemini credential validation investigation

Date: 2026-10-15. Local baseline and running production API revision: `b78c865`.

## What is established

The production response supplied by the user at 07:17:31 UTC reports HTTP 400,
Google `INVALID_ARGUMENT`, reason `API_KEY_INVALID`, and message
“API key not valid. Please pass a valid API key.” This is a specific rejection of
that request's key, not merely a generic 400 incorrectly classified as authentication.
Changing the request operation alone cannot be claimed to fix this specific rejection.

A read-only production GET `/health` at 07:18:12 UTC returned running revision
`b78c865d920d03cba06bcaac77f5d703ee19a412`, sourceDirty=false,
builtAt=2026-10-14T16:25:28.028Z and artifact hash
`f5225934c79d202d0f27f5029d7fe2eb4c8b105ea9e2c7d52e717d62dd452011`.
The build manifest is loaded at API startup. The local patch is not running there.
This verifies the API process, not the separately managed worker's running build.

The exact reason why the working generation request and rejected request differ
is still unconfirmed: production credential bytes and the running worker's selected
credential have not been compared. No production secrets, MongoDB records or new
validation requests were accessed. The user reports entering the same key, which
must be checked against the actual runtime source rather than presumed.

Confirmed implementation defects are a models-list probe instead of a generation
probe, insufficient separation of credential identity from model access, and a
bare HTTP 401 being sufficient to mark a credential invalid. The new probe addresses
those defects. It does not establish that Google's explicit invalid-key response
was false.

## Both request paths

| Detail | Legacy highlights | Registered highlights | Old admin validation |
| --- | --- | --- | --- |
| Credential | `LLM_API_KEY || GROQ_API_KEY` from worker environment | Registry-selected DB credential | Selected DB credential |
| Client | `@ai-sdk/google` | `GoogleAdapter.languageModel()` using the same SDK | Manual REST through `ProviderTransport` |
| Endpoint | SDK default `https://generativelanguage.googleapis.com/v1beta` | Approved provider DB baseUrl/apiVersion | Approved provider DB baseUrl/apiVersion |
| Model | `LLM_MODEL_NAME` or existing legacy default | Selected DB model identifier | None |
| Operation | POST model `generateContent` (structured generation) | POST model `generateContent` (structured generation) | GET `/models?pageSize=1` |
| Auth | SDK `x-goog-api-key` header | SDK `x-goog-api-key` header | `x-goog-api-key` header |

`HighlightDetectionService.generateFor()` calls the legacy path if no registered
selection is supplied. `HighlightRouting.select()` intentionally retains compatibility
when no explicit model/default routing policy exists. JobsService persists the selection;
JobsProcessor passes it to highlight detection. Registered inference re-resolves
current registry eligibility and never falls back to the environment key after a
registered provider failure. Existing metering, credit limits and usage recording stay intact.

The agent's EditingGraph also resolves registry models/credentials on each call,
with task, plan and model-test checks. The existing Google LangChain client uses
the same approved endpoint, API version, key header and protected transport.
It remains distinct from the highlight SDK because it implements structured agent calls.
Both require text and structured output; task membership is checked separately.
No unnecessary vision/audio/tool-calling requirement was introduced.

The admin route is `AdminAIController` -> `AdminAIService.validateCredential()`
-> `ProviderValidationService.validate()` -> `GoogleAdapter.validateCredential()`.
The service loads the enabled nonarchived credential with explicit cipher-field
selection and its enabled provider. `CredentialVault.decrypt()` authenticates
AES-256-GCM with AAD `providerId:credentialId:keyVersion`. Ciphertext is not sent
as a key. Enrollment already trims outer whitespace and rejects masked placeholders.
Tests verify decryption round-trip and the exact outgoing synthetic key header.
The frontend submits the secret, not the displayed mask.

The old GET URL is correctly constructed for the approved Google origin/version.
It tests catalog access, not configured-model generation access. That distinction
motivates the new generation probe but does not explain `API_KEY_INVALID` by itself.

## Local correction

- The validator now calls `GoogleAdapter.languageModel()` and the installed SDK's
  `doGenerate()`, sharing the exact factory used by registered highlights.
- It selects an enabled nonarchived text model explicitly bound to the tested
  credential, or inheriting it through the provider default. An unrelated routing
  model cannot be selected. No environment model or hardcoded validation model is substituted.
- It uses model temperature and a bounded output limit (at most the existing 128-token
  test allowance), with the smaller of the model and provider/credential timeout.
  No automatic retries. A small probe can incur provider token charges.
- Generated text proves basic generation access. A genuine token-limited response
  with positive usage also proves access when a thinking model consumes the budget.
  Empty/catalog-shaped responses do not certify generation. Structured-output and
  task-specific eligibility still require the existing separate model test.
- SDK error response bodies are parsed only into bounded, sanitized Google status,
  reason and message fields. No raw SDK error, headers, key or credential-bearing
  URL is logged or returned. SSRF/DNS pinning, approved-origin/version restrictions,
  redirect blocking, request/response limits and vault format are preserved.
- Response fields `category`, `credentialStatus`, `modelAccessStatus` separate the
  attempt outcome from identity. Categories distinguish invalid key, permissions,
  malformed request, unavailable model, quota, network, timeout, provider outage
  and local credential storage failure. Existing `valid`, `code`, diagnostics,
  latency and new `modelId` remain available to the current admin handler.
- Only an explicit invalid/expired/revoked key reason or `UNAUTHENTICATED` marks
  identity invalid. IAM/restriction/model/config/quota/provider failures do not
  erase a previous valid identity. Validation never disables credentials or
  changes secrets, model eligibility or routing.
- Additive credential metadata separates latest attempt status/error/message
  from last successful validation time/context. Five-minute generation proof is
  bound to model configuration, provider configuration/revision, credential ID/revision
  and probe strategy. Prior catalog successes cannot satisfy this cache.
- Provider/model freshness checks and credential revision/last-attempt timestamp
  fencing prevent publishing a success over concurrent configuration/replacement
  or newer validation. No migration/backfill is required.

## Read-only discrepancy diagnostic

Local script: `backend/scripts/diagnose-google-credential.cjs`.
It uses raw MongoDB reads and the existing compiled CredentialVault; it does not
bootstrap Nest, start queues, create indexes, mutate documents, or call Google.
It compares decrypted bytes to the diagnostic process environment with constant-time
SHA-256 digest equality, printing only match booleans (never digests, lengths,
plaintext, cipher fields, connection URLs or raw errors). It also reports effective
model binding and provider default metadata. Missing comparison input is null.

After copying this reviewed script to the server, run from backend:

```bash
node scripts/diagnose-google-credential.cjs 6acdfa5f3208db09578cb0cf
```

The script loads backend `.env` without overriding existing environment values.
A mismatch establishes that this saved credential differs from that process's key.
A match does not prove an already-running PM2 worker has the same environment,
selected credential, configuration or loaded revision. Confirm the actual job's
persisted registered selection/default routing and separately verify worker build
before concluding equivalence. Never share `.env`, PM2 environment dumps or raw
credential documents. No production diagnostic was executed during this change.

## Verification

The full backend suite passed: 80 suites / 730 tests, with 2 opt-in suites /
8 tests skipped. After the final SDK malformed-response correction and fixture
relocation, the focused validation suite passed again: 2 suites / 59 tests.
The backend production build (including contract and compiled route checks),
changed runtime-module lint, real installed SDK synthetic test, two read-only
diagnostic tests and one admin API response test all passed. Coverage includes:

- encrypted saved-credential round trip, replacement and exact synthetic key header;
- generation endpoint/version/model/auth agreement using the real installed Google
  SDK and existing LangChain client against a synthetic protected transport;
- successful generation followed by successful validation with the same model/key;
- explicit invalid key, permission, model, bad request, quota and provider failures,
  with sanitized real-SDK error propagation;
- unrelated model and provider-default binding selection, missing configuration,
  prior valid identity preserved across model/context failures, success cache fencing;
- concurrent credential/provider/model state changes, secret redaction,
  timeout/DNS/TLS classification and thinking-model token limits;
- registered highlights use the registry key rather than a different environment key;
- existing registry task/capability/plan tests and the video-processing test suite;
- safe read-only comparison output and existing frontend failure-result passthrough.

Jest uses a documented SDK boundary fixture because its CommonJS runner cannot
load this ESM SDK. `scripts/test-provider-adapters.cjs` independently exercises the
real installed SDK, compiled adapter and HTTP serialization without upstream calls.
All test credentials/responses are synthetic. No production key is certified locally.

## Safe rollout and outstanding prerequisite

No new environment variable, dependency, frontend runtime change or database migration.
No commit, push, production credential changes, deployment, worker restart or requeue
was performed. Review and authorize release before updating/restarting production.
After an approved rollout, verify the running API health build revision and separately
verify worker revision; run one approved validation against the intended saved
credential/model and inspect the sanitized result. Run the existing model test before
setting task/default routing. Do not bypass the test gate or rewrite validity fields.

To fully migrate existing legacy highlight jobs, configure a tested eligible DB model,
credential binding and routing, then use normal job creation/recovery controls under
approval. This patch preserves the compatibility path so the currently working pipeline
is not broken. Establishing which credential the reported successful production job
actually used remains necessary to identify the precise source of the discrepancy.
