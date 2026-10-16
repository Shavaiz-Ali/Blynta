# AI Studio generate_patch investigation

Local source baseline: `f89a7e0`. No deployment, production request, credential change,
queue operation, asset generation, UI change or FFmpeg change was performed.

## Conclusion and evidence limits

The production triggering exception cannot be determined from the supplied records.
They establish that interpretation completed, one required asset resolved, and the
second model-call boundary failed. The supplied API response contains only
`AI_PROVIDER_FAILED` / “AI provider request failed”. It contains no HTTP status,
Google reason, finish reason, parser exception or deployed build revision.

The confirmed application defect is loss of the underlying exception:

1. GoogleAdapter.structured catches invocation/configuration exceptions and
   replaces them with a generic ServiceUnavailableException. Its old classifier
   cannot see an HTTP status/body already hidden by LangChain, or distinguish
   SDK/parser exceptions from actual provider outages.
2. EditingGraph.modelCall records PROVIDER_OR_EXECUTION_FAILURE for most exceptions
   and stores AI_REQUEST_FAILED in usage regardless of the original code. The same
   catch also covers application work after generation, including usage persistence.
3. ProposalsService maps most terminal exceptions to AI_PROPOSAL_FAILED and marks
   every failure retryable. Those persisted values do not prove Google failed.

The adapter/graph succeeds locally with the current schemas, including the second
call, using real installed LangChain and a synthetic Google transport. Thus there
is no reproduced schema incompatibility or confirmed production-provider cause.
This patch fixes error preservation and adds regression coverage; it does not
claim the original production failure has been fixed.

## Exact path

`AgentController.propose` (JWT and AI rate limit guards)
-> `ProposalsService.propose` (owned plan/assets, model, session, idempotent proposal,
daily budget, history, 90-second overall execution/cancellation signal)
-> `EditingGraph.run`
-> load_context -> interpret -> resolve_information -> resolve_assets
-> generate_patch -> modelCall(answerSchema, payload)
-> registry.resolveUserModel (rechecks current entitlement/configuration/credential)
-> ProviderAdapterRegistry.get('google').structured
-> GoogleAdapter.create -> ChatGoogle.withStructuredOutput -> invoke
-> pinned ProviderTransport.fetch -> Google model generateContent
-> LangChain function-call extraction -> local Zod validation
-> graph response validation/usage persistence -> patch validation/proposal publication.

The reported second model_failed event is emitted inside modelCall's catch.
The local routing and 64,000-byte encoded-payload guards run before that try block;
they would not themselves produce that particular model_failed diagnostic.

## Call comparison

| Property | interpret | generate_patch |
| --- | --- | --- |
| Model | Registry selected model, rechecked | Same registry identity required, rechecked |
| Secret | Registry-decrypted credential | Fresh resolution; now records revision and equality-to-initial as a boolean |
| Endpoint/version | Approved provider settings | Same adapter/provider configuration path |
| SDK/operation | ChatGoogle, model generateContent | Same |
| Structured output | functionCalling, function `extract`, includeRaw=true | Same mode/name |
| Function parameters | phrases, clarification, unsupported, assets | outcome, summary, patchJson, unavailableCapabilities |
| Output tokens/temperature | Configured model settings | Configured model settings; no node-specific override |
| Timeout | Model timeout combined with execution signal | Same model timeout, subject to remaining 90-second overall budget |
| Input | Context, capabilities, prompt, interpretation task | Context plus patch contract, interpretation, searches, resolved assets, issues |
| Retries | SDK maxRetries=0 | SDK maxRetries=0; existing one correction remains for invalid patches |

The complex modelPatchSchema is serialized into the **prompt**. It is not the
generate_patch function declaration: patchJson is a string in a small envelope.
No functionCalling/jsonSchema switch, tool change, token-limit increase or provider
request workaround was introduced without an observed provider rejection.
Actual production settings/sizes are unknown. New model_started events capture
model IDs, credential revision/change boolean, approved base/version, mode, token
limit, temperature, timeout and prompt byte count without input content or key hashes.

## Minimal correction

- Observe the HTTP response at the existing protected transport boundary before
  LangChain can discard it. Keep status and allowlisted Google reason/status fields.
  Keep only known-safe message prefixes; omit arbitrary text that may echo prompts.
  Unknown-schema-field errors retain only a known schema keyword, never arbitrary names.
- Distinguish provider HTTP rejection, provider-response/parsing failure, token
  exhaustion, transport/network/timeout, SDK configuration and application execution.
  MAX_TOKENS never becomes a valid truncated proposal or a generic provider outage.
- Add safe exception type, configuration/invocation/parsing phase, duration,
  category, origin, retryability and model/node correlation to persisted diagnostics.
- Preserve error codes in usage and the failed proposal. HTTP 400, authentication,
  quota, malformed structured output and execution errors no longer all become
  AI_PROVIDER_FAILED / AI_PROPOSAL_FAILED.
- Supply the existing shared API filter's issues envelope so codes and safe details
  survive serialization. No shared filter rewrite was needed.
- Failure-diagnostic/usage writes cannot replace the original exception if those
  secondary writes also fail. Existing request idempotency and bounded correction
  logic remain; no new automatic paid retries were introduced.

## Controlled verification

`backend/scripts/test-proposal-provider.cjs` runs the real compiled graph,
GoogleAdapter and installed LangChain with synthetic HTTP. Owned-context, asset
resolution and asset validation are test doubles; no provider, R2, generation,
FFmpeg or live database is called.

It proves successful interpret -> resolve_assets(required=1,resolved=1)
-> generate_patch -> pending centered emoji proposal. It compares serialized
endpoint/auth/config and the actual function declarations for both requests.
It also injects a failing second response for 400/401/403/429/503, malformed
function arguments, MAX_TOKENS and transport timeout, asserting exact codes,
origin, status, retryability, safe API envelope, no secret/prompt echo, no hidden
third request and successful new execution after failure. A persistence failure
after a successful second response remains AI_EXECUTION_FAILED, not a provider error.

Final verification: 22 AI editor/registry suites passed with 282 tests; one opt-in
suite and 9 tests were skipped. Backend build (contract installation, TypeScript
compilation, compiled API route check and build stamping) passed. Scoped lint and
git diff whitespace checks passed. The real-adapter synthetic script passed,
including shared HTTP error-envelope serialization. Jest covers the original graph,
patch validation/correction, proposal idempotency, new terminal-error code/retryability
persistence and diagnostic privacy. No live provider acceptance test was performed.

These tests demonstrate local serialization and execution. Synthetic HTTP does
not prove Google will accept the actual production request or return a complete
production patch within the configured budget.

## Exact missing production evidence

After an approved release, collect the model_started events for calls 1 and 2 and
the model_failed event for call 2 from an affected proposal's diagnostics, correlated
by executionId and executionBuild/running API revision. Required fields are:

- node, call, providerModelId, durationMs;
- failure.code/category/origin/phase/exceptionType/retryable;
- failure.upstreamStatus/upstreamErrorStatus/upstreamReason/upstreamMessage and,
  when present, upstreamSchemaKeyword;
- token limit, timeout, prompt byte counts and credentialChanged/revision.

provider_http with 4xx/5xx proves an upstream rejection. provider_response with
HTTP 200 proves the response arrived and output processing/token limits failed.
adapter/configuration without a status means no observed HTTP rejection.
execution after model_result identifies an application-side failure.
Share only these safe events, not raw provider responses, prompts, transcripts,
headers, URLs containing credentials, keys or a PM2 environment dump. No production
retry/restart/deployment is authorized or performed by this investigation.
