# Production AI validation and adapters investigation

Investigation date: 14 October 2026. No production deployment, restart, credential replacement, restriction change, or database modification was performed. Local source changes are uncommitted on top of `2b72c82fb488f70c1d0f633f6cceb2515d655ed2`; the local build correctly reports `sourceDirty: true`.

## Confirmed findings

### Credential diagnostics defect

The local Google adapter makes a model-list request using the decrypted credential from MongoDB. It uses the configured approved origin (`https://generativelanguage.googleapis.com`) and API version (`v1` or `v1beta`, default `v1beta`), `GET /models?pageSize=1`, an empty body, and `x-goog-api-key`. Credential secrets are not taken from a frontend request or substituted with an environment API key.

Before this patch, the adapter discarded Google's response body and passed only its HTTP status to `classifyProviderFailure`. That classifier treated every credential-check HTTP 400 as `AI_AUTH_OR_ACCESS_FAILED`. `ProviderValidationService` then persisted `invalid` for every unsuccessful check, including quota failures, malformed requests, timeouts, and decryption failures. These are confirmed source defects. They prevented determining why Google rejected the production request; they do not establish that the production key is invalid.

Google's public discovery documents were retrieved without credentials for both API versions. They identify `models.list` as GET, with paths `v1/models` and `v1beta/models`, and `pageSize` as an integer query parameter. A positive size of 1 matches that documented request contract. This is not a successful live check using the production credential or proof of the actual configured production version. Sources: [models reference](https://ai.google.dev/api/models?hl=en), [v1 discovery](https://generativelanguage.googleapis.com/$discovery/rest?version=v1), [v1beta discovery](https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta).

The real Google SDK generation adapter and LangChain adapter were tested with synthetic transport. Both use the same configured origin/version and key header; generation uses POST `/models/{model}:generateContent`, whereas validation deliberately uses the non-generation GET model-list request. No paid generation or live key request was made.

AES-256-GCM authenticated decryption uses credential/provider identity and stored key version. Tests verify round-trip secret recovery, replacement with revision 2, loading the replacement on a subsequent validation, and refusing stale credential/provider validation results through revision checks. Production ciphertext, key versions, revisions, and decrypted credentials were not inspected.

### Production adapters route

Read-only requests to `https://13-234-63-132.sslip.io` produced:

| Request | Observed response | UTC time |
|---|---|---|
| GET `/admin/ai/adapters` | 404, `Cannot GET /admin/ai/adapters` | 07:54:54 |
| GET `/health` | 200, database connected, uptime 75660 seconds, no build revision | 07:56:28 |
| GET `/admin/ai/providers` without authentication | 401, Unauthorized | 07:56:28 |

The response identifies nginx/1.30.4 and Express. The missing route is reproducible through the public origin while another route in the same AI admin section reaches authentication.

In local source, `AdminAIController` declares GET `adapters` beneath `admin/ai`. `AIRegistryModule` registers that controller and is reachable from `AppModule` through its imported modules. `main.ts` applies no global prefix or URI versioning. The frontend's shared contract and `aiAdminApi.adapters()` use `/admin/ai/adapters`, matching the URL in the user's production request. The newly compiled controller and its module import graph also pass registration checks.

**The precise production 404 cause and exact running backend SHA remain unverified.** No SSH alias/identity or PEM path was supplied, and no authenticated production admin session was available. Public `/health` does not expose a revision. Local registration cannot certify production registration. An older artifact, an unrestarted API process, a different process directory, mixed upstream instances, or a proxy routing difference are hypotheses requiring host inspection, not confirmed diagnoses. Deployed frontend/backend commit compatibility is also unverified.

## Changes

- `provider-errors.ts`: reads bounded JSON errors; extracts numeric Google code, allowlisted status/reason, and sanitized message; maps malformed requests to `AI_REQUEST_FAILED`, quota to `AI_QUOTA_OR_RATE_LIMIT`, access/key errors to the existing auth/access code, and timeouts separately. Unknown HTTP 400 is not presumed to be authentication failure.
- `google-adapter.service.ts`: logs only safe diagnostics and request configuration on failed validation. Model lookup uses the same safe error parser. No response headers, raw JSON, error metadata, or exception bodies are logged/returned. Literal/encoded credentials, other Google key patterns, URLs, email/IP/project identifiers, long tokens, and log-control characters are redacted.
- `provider-validation.service.ts`: persists `invalid` only for confirmed credential rejection (invalid/expired/missing/leaked key or unauthenticated rejection). Unrelated failures persist `error`, preserving the distinction from credential validity. Existing enabled/archive and revision filters remain in place.
- Regression tests cover success, invalid key, malformed requests, quota, restrictions/permission errors, disabled API, timeout, secret redaction, credential replacement, stale revisions, and authenticated route behavior.
- `scripts/check-ai-routes.cjs`: checks compiled controller method/path, registration, and reachability from `AppModule`; no duplicate endpoint is introduced.
- `scripts/write-build-info.cjs` runs after a successful build and route check, recording commit, dirty-source state, build timestamp, and compiled artifact SHA-256. Existing `/health` includes this identity captured at process startup. Missing or malformed manifests report `unknown` rather than guessing a commit.
- `scripts/smoke-ai-admin.cjs`: read-only authenticated GET smoke test, accepting an existing admin JWT only through `AI_SMOKE_ADMIN_TOKEN`. It checks health build identity, samples artifact consistency, unauthenticated 401, and authenticated 200 with Google adapter options. Sampling does not prove that every load-balanced instance was inspected.
- `scripts/inspect-ai-deployment.cjs`: host-side inspection of existing PM2 API entries, process start times, checkout/artifact identity, and selected nginx routing directives. It avoids environment dumps, credentials, full proxy config, restarts, and starting an absent PM2 daemon. On-disk state is explicitly distinguished from what a running process loaded.

## Verification

- Backend typecheck: passed.
- Local production build, contract-install check, compiled AI route registration, and build stamping: passed.
- AI registry, health controller, and build identity: 9 suites, 113 tests passed.
- Real Google SDK and LangChain endpoint/header serialization test with synthetic transport: passed.
- Changed production TypeScript and new tests: targeted ESLint passed.
- Authenticated HTTP smoke script: passed against a local Nest server with a signed synthetic admin JWT, actual Passport JWT strategy and AdminGuard, and mocked user/session/data dependencies. It rejects missing/invalid JWTs and consumer sessions. It was not run with a real production administrator token.
- Google's production error body, saved provider configuration, saved credential decryption/revision, Cloud API enablement/restrictions, EC2 process revision, live proxy configuration, and frontend deployment revision: not verified. No policy-change explanation is assumed.

## Host diagnosis and deployment steps

Before changing production, obtain the SSH username/alias and local PEM path. Do not put the PEM contents, Google key, database URI, or bearer token into chat, command-line arguments, or Git.

1. On EC2, run the read-only inspection script as the existing application owner. Confirm API process names, PIDs, cwd, entry point, mode/instances and listeners; review the nginx server/upstream routing for this hostname. Compare each loopback API with the public route. The local canonical PM2 config uses `blynta-api`, `dist/src/main.js`, port 5001, and one fork instance, but these are not asserted to be the actual deployed settings.
2. Compare checkout SHA, the compiled controller checksum, process startup, and any existing build manifest. A Git checkout at the latest commit or a new file on disk does not prove that the running process loaded it. Inspect all API processes/upstreams and frontend deployment metadata before assigning a stale-build or proxy root cause.
3. Inspect the saved provider's base URL/API version and credential revision without printing ciphertext or plaintext. Run the safe validator using the existing saved credential, capturing the sanitized error code/status/reason/message. Verify API enablement, application/API restrictions and server outbound address against that specific error. Do not remove restrictions or replace the key speculatively.
4. Report the resulting confirmed diagnosis and proposed production changes for approval. This investigation has not authorized or performed a redeploy or credential change.
5. After deployment approval, build a reviewed committed revision with `npm ci` and `npm run build` inside `backend`. Require the compiled route check and a clean-source build manifest. Preserve existing credential/encryption settings. Align the existing API process's cwd/entry point with that verified artifact and restart only that verified process; do not launch a duplicate API to work around the missing route.
6. Check `/health` for the approved SHA and matching artifact hash. With a securely supplied existing administrator JWT, run `npm run smoke:ai-admin` using `AI_SMOKE_BASE_URL`, `AI_SMOKE_ADMIN_TOKEN`, and the complete `AI_SMOKE_EXPECTED_REVISION`. Check every known upstream separately as well as the public origin. Confirm the deployed frontend's API origin and revision compatibility.
7. Trigger validation through the existing admin action. The GoogleAdapter terminal log now shows the sanitized upstream diagnostic. PM2 logs can be filtered to `GoogleAdapter` to inspect these lines; do not publish complete application logs. An example shape (synthetic, not the observed production Google error) is:

```json
{
  "operation": "credential-validation",
  "request": { "baseUrl": "https://generativelanguage.googleapis.com", "apiVersion": "v1beta", "method": "GET", "path": "/models", "pageSize": 1 },
  "code": "AI_REQUEST_FAILED",
  "upstreamStatus": 400,
  "upstreamCode": 400,
  "upstreamErrorStatus": "INVALID_ARGUMENT",
  "upstreamMessage": "Sanitized explanation from Google"
}
```

These local fixes remove the confirmed diagnostic defect and add deployment verification. They are not a claim that either production incident has been resolved or that the original Google failure's root cause is known.
