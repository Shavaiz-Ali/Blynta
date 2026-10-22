# R2 manifest authentication — final HTTP boundary investigation

## Production facts and limit of the conclusion

The operator's DescribeJobs output confirms job `18539cf4-51fc-4d3f-8df4-b4aa9f3cdd21` used `arn:aws:batch:ap-south-1:834897673310:job-definition/blynta-render-job:7`, image `834897673310.dkr.ecr.ap-south-1.amazonaws.com/blynta/ffmpeg_renderer:v3`, log stream `render/default/80bcb77dcd344ec9a9edbd5f63f0191c`, exit code 1. It ran October 21, 2026, 13:42:03–13:42:27 UTC. DescribeJobs confirms the image tag, not the historical immutable image digest.

The supplied events establish failure in `manifest_download` / `GetObjectCommand`, HTTP 400, `InvalidRequest: Please use AWS4-HMAC-SHA256`. They also establish that the old signing middleware observed an `AWS4-HMAC-SHA256 ` prefix and the configured R2 hostname. They do **not** establish that the complete authorization value was valid, that its credential matched the intended injected key, that no later request mutation occurred, or that the backend and task resolved the same account/bucket/key.

**The exact production root cause is not yet confirmed.** This change fixes a reproduced diagnostic/validation gap; it must not be described as a proven repair of this job's upstream 400. There has been no successful real Batch manifest download during this investigation, and no AWS access is configured in the local workspace. No infrastructure, credentials, jobs or production records were changed.

## Trace and source evidence

1. `BatchRenderService.execute` prepares `job-sources/batch/<execution-hash>/task.json`, awaits `R2Service.uploadBuffer`, then calls SubmitJob with that exact manifest key. Manifest upload uses `bucketFor`: its `job-sources/` prefix routes to `R2_SOURCE_BUCKET_NAME`, falling back to the output bucket. SubmitJob supplies endpoint/output/source bucket overrides; credentials stay in job-definition secrets. This ordering proves code intends to upload before submitting, not that this production object currently exists under the task's effective route.
2. `renderer.main.ts` calls `runRenderer` directly. `ConfigService` reads injected environment variables; it does not load the EC2 `.env` or fetch Secrets Manager. `runRenderer` validates the key/storage and calls `downloadToBuffer` inside `manifest_download` before any FFmpeg work.
3. `downloadToBuffer` constructs `GetObjectCommand({Bucket: bucketFor(key), Key: key})` and uses the same `R2Service` class as EC2. This is a header-authenticated SDK GET, not a presigned URL. Both clients use explicit R2-named credentials, `auto`, the configured endpoint and existing path-style addressing. They do not resolve R2 credentials from the AWS task role. The separate BatchClient correctly uses AWS credentials for AWS operations.
4. The installed SDK signer interpolates `credentials.accessKeyId` into `Credential=<id>/<scope>`. Its resolved-credential validation checks types, not the full authorization grammar. Reproduction: a JSON object string, spaces, quote, or slash in an access-key value still produces the old `requestSignedWithV4: true`, while the complete header is malformed. This is a confirmed failure of the old prefix-only observation, **not evidence those values were present in this task**. A syntactically valid but incorrect key or secret is a different condition and is not identified by grammar checks.
5. Inspection of the installed `@smithy/node-http-handler` showed direct forwarding of headers, hostname, method and encoded path/query to `node:https.request`. Its own keep-alive agent has no proxy-agent configuration here. There is no HTTP redirect-following loop. The S3 region-redirect option is not enabled. No custom signer or proxy agent is installed by this rendering path, and no source middleware intentionally changes the request after signing. Environment/preload presence in the actual container was not supplied and is now observable as booleans.

The initial local dependencies differed from the Docker lockfile: HTTP handler 4.12.1 versus locked 4.10.0, signature-v4 5.7.4 versus locked 5.7.0. This was a verification risk, not a demonstrated production cause. A clean `npm ci --ignore-scripts` is used for the final checks. The handler's new direct import is declared at the **existing locked version 4.10.0**, without a dependency-version upgrade. The renderer image uses Node 24; local checks use Node 26, so the image preflight and real Batch canary remain release gates.

## Minimal change

The S3 endpoint, signer, credentials, region, addressing and checksum configuration are unchanged. No repeat of the unsuccessful `forcePathStyle` change was made.

`R2HttpHandler` extends the same real `NodeHttpHandler`, with the same connection/socket timeouts and TLS verification. It observes each request immediately before `super.handle`, after all SDK middleware. The existing signing middleware records a private snapshot, allowing the final boundary to detect changed authorization, signed headers or target. Header case and query ordering are normalized for comparisons. Snapshots contain hashes only and are not logged; they do not contain bodies.

The only new rejection is a demonstrably malformed/mismatched authorization or a changed signed request. It fails with a value-free UnrecoverableError before sending, so deterministic failures do not repeat in Batch. Valid requests are delegated unchanged; unknown upstream errors are preserved. This guard cannot repair an upstream rejection of an otherwise valid signed request or an incorrect but syntactically valid credential.

Manifest requests/responses and failing transport/status responses carry:

- precise boundary (`NodeHttpHandler.handle`), method, safe hostname, endpoint/Host-header agreement;
- path **shape** (`/[bucket]/job-sources/batch/[execution]/task.json`) and a SHA-256 `requestTargetId` over protocol/hostname/port/encoded path; neither raw key nor query is logged;
- allowlisted authorization scheme, full grammar validity, signing region/service, configured-credential-ID agreement, R2 credential-format booleans and session-token/query-signature presence;
- private-snapshot equality booleans, proxy/preload environment-presence booleans, Node version and Batch job ID when available;
- response HTTP status, redirect/Location-presence booleans, no-follow behavior and an allowlisted/redacted Cloudflare Ray ID if supplied. Location values are never logged.

`r2_http_request`, `r2_http_response`, `r2_http_transport_failed` and `r2_http_request_blocked` complement the existing operation and stage events. An HTTP 400 response is logged before SDK XML deserialization. The same `requestTargetId` on a successful EC2 PUT and Fargate GET correlates endpoint/bucket/key without exposing the object key or any credential fingerprint. It excludes method and query intentionally for PUT/GET comparison.

This boundary observes the request handed to the native transport. It is not a packet capture of the failed historical task. A local HTTPS receiving server independently verifies the actual transmitted authorization signature. Production transport events plus Cloudflare's response/Ray ID are still needed to establish the remote failure condition.

## Changed files

| File | Purpose |
| --- | --- |
| `backend/src/storage/r2-http-handler.ts` | Final-boundary observer and deterministic invalid-request guard |
| `backend/src/storage/r2.service.ts` | Use that handler and attach the post-signing snapshot; existing S3 configuration retained |
| `backend/package.json`, `package-lock.json` | Declare the runtime handler import at its existing locked version, without upgrading it |
| `backend/src/storage/r2-http-handler.spec.ts` | Real receiving-server HTTPS and independent HMAC verification |
| `backend/test/fixtures/r2-loopback-*` | Public disposable TLS test fixtures; never production keys |
| `backend/scripts/check-renderer-storage.cjs` | Exercise the compiled observer/guard in the existing offline image preflight, rather than bypassing it |
| `backend/scripts/inspect-batch-r2.cjs` | Read-only job/route/mapping inspector; optional bounded manifest GET and private credential comparison |
| `backend/scripts/test-inspect-batch-r2.cjs` | Offline inspector redaction/routing/credential-comparison regressions |
| This report / `r2-signing.md` | Findings, limits and operator procedure |

## Verification

The new HTTPS test starts a loopback server with an explicitly trusted fixture certificate; TLS verification remains enabled. It receives the real SDK/Node transport requests and independently recomputes HMAC-SHA256 from their received method, encoded path, canonical query, signed headers, payload hash, date and `auto/s3/aws4_request` scope. Both PUT and GET signatures match the synthetic configured secret; no AWS session token is present. The renderer reads the same private-bucket manifest target and then intentionally stops on the expired synthetic manifest before FFmpeg.

Other cases cover the same reported HTTP 400, HTTP 302 without following Location, four malformed credential-header cases that pass the old prefix check, post-signing header mutation, and absence of credentials/authorization/query signatures/object keys in diagnostic logs. Existing tests retain source/output bucket routing, presigned URLs, stage reporting and Batch submission behavior. Inspector tests use fake AWS responses and secret payloads and make no real requests.

Final local results after a clean lockfile install:

- `npm ci --ignore-scripts --no-audit --no-fund` passed; HTTP handler **4.10.0**, signature-v4 **5.7.0**, S3 SDK **3.1109.0**. No SDK versions were upgraded.
- Backend build / compiled route verification, complete `tsc --noEmit` and scoped storage runtime/test ESLint passed.
- Focused R2/renderer/Batch suite: **6 suites / 93 tests passed**, including **11** new boundary tests. Encoded paths, streamed upload/HEAD, and harmless header-case/query reordering retained valid on-wire signatures.
- Full backend suite: **99 suites / 965 tests passed**, **3 opt-in suites / 16 tests skipped**. These counts include the focused tests and must not be added together.
- Compiled renderer preflight passed with `finalAuthorizationVerified: true`; the offline inspector metadata/routing/private-comparison/redaction script passed. The image's existing preflight command automatically runs the updated compiled check, without Dockerfile or infrastructure edits.
- `git diff --check` passed.

No real Cloudflare request, Docker image build, AWS deployment or Batch canary was performed. None of these local passes establishes production recovery or verifies that the historical manifest still exists.

## Read-only production evidence collection

Use a **separate release checkout**, built from this patch, in an authorized EC2 shell with the existing runtime environment. Do not build over files used by the live worker or restart it. The default inspector only issues DescribeJobs/DescribeJobDefinitions and prints selected safe metadata:

```bash
cd /path/to/separate-release/backend
npm ci
npm run build
AWS_REGION=ap-south-1 node -r dotenv/config scripts/inspect-batch-r2.cjs \
  18539cf4-51fc-4d3f-8df4-b4aa9f3cdd21
```

To verify the manifest currently exists and can be read using the EC2 process's credentials, append `--read-manifest`. It requires exact equality of the three R2 routing variables with the failed job before issuing a bounded GET; it prints byte count/success, never manifest contents. A route mismatch stops rather than reading a misleading alternative object.

An operator already authorized to read the referenced secrets can append `--compare-credentials`. This invokes AWS CLI GetSecretValue with the definition's exact JSON-field/version selection, pipes its output privately into memory, and emits equality/format booleans only. It does not edit secrets, rotate credentials or print credential hashes. No new permissions should be granted merely to run this diagnostic. `plaintextEntryPresent: true` identifies an ambiguous environment/secret mapping to inspect privately.

Important: comparison is against the **currently referenced secret version and this EC2 process**, not proof of the historical task's injected bytes or an already-running worker's environment. Different valid credentials can intentionally differ; inequality alone does not establish why Cloudflare rejected the request. If the script fails, do not enable shell tracing, print its raw subprocess errors, run AWS `--debug`, or paste SecretString into logs/chat.

## Deployment and actual recovery gate

No deployment was performed. No migration or new environment variable is required. Do not rotate credentials or change routing, permissions, proxies, infrastructure templates or path-style configuration speculatively.

After separate deployment approval, use the existing image/release pipeline to build this exact committed revision under the existing Node 24 renderer image. Require the compiled image preflight's `finalAuthorizationVerified: true`. Publish a fresh immutable SHA tag/digest; do not overwrite `v3`. Through the existing approved deployment process, preserve the failed definition's roles, secrets, routing overrides, network, Fargate settings and retry rules in the release revision. Record the immutable digest actually run; a mutable tag is insufficient. No AWS infrastructure files were changed by this patch.

After separate canary approval, run one existing staging smoke task with an owned source via `scripts/batch-render-smoke.cjs`. It creates a new Batch execution/artifacts, so it is **not** part of the read-only inspector and was not run here. Do not bulk-retry customer jobs or launch another production worker.

Require actual Fargate `manifest_download` success: the correlated `r2_http_response` GET must have HTTP 200, expected hostname, matching requestTargetId, full valid SigV4 grammar, configured credential agreement, `auto/s3`, no post-signing mutation and no redirect. Then require complete smoke-task success and its existing output verification before claiming rendering is restored.

If the GET still returns 400, keep that safe event, the stage/operation event, actual job revision/digest and Ray/request ID. A fully valid unchanged request with matching EC2 routing narrows the problem to credential/account acceptance or an external/runtime difference; it does not justify another client configuration guess. Use the private comparison and, if necessary, Cloudflare support with the Ray/request ID. Leave the live worker pin and credentials unchanged until evidence supports a specific correction and its rollout is approved.

References: [Cloudflare SDK v3 configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [AWS Node proxy configuration](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-proxies.html). Installed dependency source and the real HTTPS tests are the primary evidence for transport behavior in this checkout.
