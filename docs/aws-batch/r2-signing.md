# R2 signature failure: evidence, deployment and verification

Follow-up: the operator has now confirmed the failing manifest GET and the
unsuccessful path-style change for job definition revision 7 / image v3. See
[the final HTTP boundary investigation](r2-http-boundary-investigation.md) for
the current evidence, new transport checks and remaining production uncertainty.
The addressing change below is historical and must not be repeated as a new fix.

## What is established

The supplied CloudWatch event contains only `InvalidRequest: Please use
AWS4-HMAC-SHA256`. It does **not** identify the operation, HTTP status, request ID,
job ID, deployed digest or runtime endpoint. The precise production root cause
cannot be confirmed from that event. Do not assume the failure is output upload.
An SDK `InvalidRequest` at `renderer.main` is different from an FFmpeg failure,
which is wrapped as `MediaCommandError`; presigning itself makes no R2 request.

An offline trace of the **previous compiled** `R2Service` with SDK 3.1109.0 and
synthetic credentials proved that manifest GET, source HEAD, progress PUT and
presigned source GET already used `AWS4-HMAC-SHA256` and `auto/s3/aws4_request`.
It also showed virtual hosting: `blynta.<account>.r2.cloudflarestorage.com`.
The change explicitly uses path addressing: `<account>.r2.cloudflarestorage.com/blynta/...`.
This preserves the configured account endpoint and removes an addressing
ambiguity; it is **not evidence that virtual hosting caused this production error**.
The pre-change source did not use Signature V2 or a custom signer.

The shared client uses explicit, validated `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY`, region `auto`, and SDK v3 signing/presigning. Credentials
are not trimmed, swapped, or replaced by AWS task credentials. ConfigService
reads injected variables; the standalone renderer does not load EC2's `.env`.
Other S3Client constructors in `youtube.processor.ts`, `audit-clip-import.cjs`,
and `studio-r2-cors.cjs` also use SDK v3, `auto` and explicit R2 credentials.
They are outside this rendering path and are unchanged. No duplicate renderer
storage implementation was introduced.

## Request path

1. `BatchRenderService.execute` uploads `task.json` using `R2Service.uploadBuffer`,
   then submits a Batch job using the EC2 IAM role. The command supplies the
   manifest key, not a URL or credentials. SubmitJob overrides `R2_ENDPOINT`,
   `R2_BUCKET_NAME`, and `R2_SOURCE_BUCKET_NAME` from the worker. These overrides
   take precedence over the job definition: verify the worker as well as the definition.
2. Fargate injects the two R2 credential fields from Secrets Manager. The
   entrypoint is `dist/src/batch-render/renderer.main.js` → `runRenderer` → the
   same shared `R2Service` used by the backend.
3. The renderer downloads the private manifest with SDK GET, then HEADs the source.
   Clip tasks generate an SDK SigV4 presigned GET at execution time. FFmpeg uses
   that URL directly and seeks/range-reads; the full long video is not downloaded
   once per clip. URLs are passed unchanged and are not logged.
4. Edit tasks download bounded staged inputs using SDK GET. Existing FFmpeg,
   captions, crop, overlays and audio behavior are unchanged. Progress JSON uses PUT.
5. After FFprobe validation, the renderer PUTs the file, HEAD-verifies its size,
   and PUTs the result marker. The backend requires Batch `SUCCEEDED`, matching
   result identity and output HEAD verification before publishing completion.
   Final clip publication stays on the existing backend path.

Manifest, progress, result, staged inputs and intermediate outputs keep their
existing `job-sources/batch/<hash>/...` keys and source-bucket routing. Published
clips remain under `clips/...` in the output bucket. Same and separate private
buckets remain supported; HTTPS, collision and private-source checks remain intact.

## Safe diagnostics

`r2_operation_failed` records SDK command, `endpointHttps`, `endpointIsR2`, fixed
region `auto`, path addressing, `requestSignedWithV4`,
`requestUsesConfiguredEndpoint`, exception type/message, HTTP status and request
ID if returned. The request booleans are observed **after SDK signing**; absence
means the request did not reach that middleware. `endpointIsR2` recognizes the
account S3 endpoint shape, including jurisdiction endpoints; it cannot verify
that the account ID is the intended account or that credentials belong to it.

`renderer_stage_failed` correlates `jobId` with stages including
`manifest_download`, `source_check`, `source_signing`, `cutting`,
`input_download`, `captioning`, `encoding`, `output_upload`,
`output_verification`, and `result_upload`. Progress failures carry their phase
and operation `PutProgress`. Original exceptions/retry classification are preserved.

Logs allowlist metadata and redact known R2 credentials, URLs and authorization
material. Never enable AWS SDK wire logging, `aws --debug`, shell tracing, or
print full job environments, secrets, manifests, requests, responses or presigned
URLs. Collect the new two events and the actual job ID to finish the diagnosis.
If a request is demonstrably signed with V4 and R2 still rejects it, inspect the
recorded request ID with Cloudflare and verify the deployed digest and secret
field mappings privately; do not rotate credentials speculatively.

## Build a new image and revision (operator only)

No image build, AWS deployment or credential change has been performed by this fix.
Use Bash with AWS CLI and jq under the existing IAM/SSO session. Run only after
this change is committed/pushed and the local checks pass. Do not overwrite `v2`.

```bash
export AWS_REGION=ap-south-1
FIX_SHA=$(git rev-parse HEAD)
BUILD_ID=$(aws codebuild start-build --project-name blynta-renderer-build \
  --source-version "$FIX_SHA" --query build.id --output text)
aws codebuild batch-get-builds --ids "$BUILD_ID" \
  --query 'builds[0].{status:buildStatus,source:resolvedSourceVersion,logs:logs.deepLink}'
```

Repeat the status query until `SUCCEEDED`; stop on failure and confirm resolved
source equals `FIX_SHA`. The root buildspec performs reproducible `npm ci`,
builds Linux AMD64, tests the image, and pushes the SHA tag. The Dockerfile
copies fresh `backend/src`, runs `build:renderer`, and copies `/app/dist` from
that build stage. Both Docker and CodeBuild run the compiled signing preflight.
Require `renderer_storage_preflight_passed`, `sigV4Verified: true` and
`accountEndpointPreserved: true`. The new script fails against the old compiled
virtual-host client. Dockerfile/buildspec changes are not needed.

Use the definition from the failed job, preserving all existing secrets, roles,
Fargate settings, retries, network, log and timeout configuration. This prints
only selected job metadata, not its full environment:

```bash
FAILED_JOB_ID='REPLACE_ACTUAL_FAILED_JOB_ID'
CURRENT_DEF=$(aws batch describe-jobs --jobs "$FAILED_JOB_ID" \
  --query 'jobs[0].jobDefinition' --output text)
test "$CURRENT_DEF" != None
aws batch describe-jobs --jobs "$FAILED_JOB_ID" \
  --query 'jobs[0].{id:jobId,status:status,definition:jobDefinition,image:container.image,log:container.logStreamName}'
DIGEST=$(aws ecr describe-images --repository-name blynta/ffmpeg_renderer \
  --image-ids imageTag="$FIX_SHA" --query 'imageDetails[0].imageDigest' --output text)
test "$DIGEST" != None
IMAGE="834897673310.dkr.ecr.ap-south-1.amazonaws.com/blynta/ffmpeg_renderer@$DIGEST"
umask 077
DEPLOY_DIR=$(mktemp -d)
aws batch describe-job-definitions --job-definitions "$CURRENT_DEF" \
  --query 'jobDefinitions[0]' > "$DEPLOY_DIR/previous.json"
jq --arg image "$IMAGE" '
  {jobDefinitionName,type,platformCapabilities,parameters,containerProperties,
   retryStrategy,timeout,propagateTags,tags}
  | with_entries(select(.value != null))
  | .containerProperties.image = $image
  | .containerProperties.environment = (
      ((.containerProperties.environment // []) | map(select(
        .name != "R2_BUCKET_NAME" and .name != "R2_SOURCE_BUCKET_NAME" and
        .name != "R2_ENDPOINT" and .name != "R2_PUBLIC_DOMAIN")))
      + [{name:"R2_BUCKET_NAME",value:"blynta"},
         {name:"R2_SOURCE_BUCKET_NAME",value:"blynta"},
         {name:"R2_ENDPOINT",value:"https://add75aeac145699c8f5d04fa5abacbf5.r2.cloudflarestorage.com"}])
' "$DEPLOY_DIR/previous.json" > "$DEPLOY_DIR/next.json"
NEW_DEF=$(aws batch register-job-definition \
  --cli-input-json "file://$DEPLOY_DIR/next.json" --query jobDefinitionArn --output text)
aws batch describe-job-definitions --job-definitions "$NEW_DEF" \
  --query "jobDefinitions[0].{definition:jobDefinitionArn,image:containerProperties.image,secrets:containerProperties.secrets,storage:containerProperties.environment[?name=='R2_ENDPOINT'||name=='R2_BUCKET_NAME'||name=='R2_SOURCE_BUCKET_NAME'||name=='R2_PUBLIC_DOMAIN']}"
```

The image must equal `IMAGE`; buckets must both equal `blynta`. Preserve the
working `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` secret mappings from
`blynta/renderer/r2-credentials`; see [r2-credentials.md](r2-credentials.md).
No new environment variable, permission or credentials are required. The AWS
region stays `ap-south-1`; the R2 signing region stays `auto` in code.
Registering a revision does not update active tasks or the worker's revision pin.

## One complete canary before production rollout

Build the updated backend in the deployment release (`cd backend; npm ci;
npm run build`), without restarting the production worker. This also gives the
smoke process the updated client. Keep its existing secure runtime environment
and EC2 IAM role. Run the following from the backend release directory with the
new definition ARN and pushed SHA copied from the deployment shell:

```bash
R2_ENDPOINT=https://add75aeac145699c8f5d04fa5abacbf5.r2.cloudflarestorage.com \
R2_BUCKET_NAME=blynta R2_SOURCE_BUCKET_NAME=blynta R2_PUBLIC_DOMAIN= \
BATCH_RENDER_JOB_DEFINITION="$NEW_DEF" \
BATCH_SMOKE_ID="r2-signing-$FIX_SHA-$(date +%s)" \
RENDER_EXECUTION_MODE=aws_batch BATCH_RENDER_ATTEMPTS=1 \
node -r dotenv/config scripts/batch-render-smoke.cjs \
  'source-videos/REPLACE_OWN_EXISTING_SOURCE/video.mp4'
```

Use an owned source at least five seconds long with audio. This command uses the
real adapter and renderer, does not rerun AI or publish a product clip, and writes
only a fresh execution and its hashed artifact prefix. It shares normal Fargate
capacity. Do not launch a second PM2 worker against production queues.

Record the returned Batch job ID, output key and positive byte count. Require:

1. The submitted job uses `NEW_DEF` and its definition references the new digest;
   verify selected DescribeJobs/DescribeJobDefinitions fields as above.
2. CloudWatch `/aws/batch/blynta-renderer` shows cutting, captions and successful
   uploads, without either failure event. The manifest GET, source HEAD and
   signed FFmpeg source read must therefore have succeeded.
3. The Batch state is `SUCCEEDED`. The smoke adapter reads the matching result
   marker and HEAD-checks output size. Its successful returned output key/byte
   count is evidence of an existing R2 object, not just an FFmpeg exit code.
4. Play the private output using existing authorized tooling/app access; check
   crop, captions, five-second timing and audio. Do not print signed URLs in logs
   or delete any source/artifact. A local signing test does not establish these results.

Only after success, pin the worker's existing
`BATCH_RENDER_JOB_DEFINITION` to the new ARN/revision in its deployment environment.
Ensure its three R2 routing variables equal those above, and leave credentials
in their working secret mechanism. Drain active work through the normal rollout,
then from `backend` run `node -r dotenv/config scripts/restart-media-worker.cjs`
and inspect `pm2 describe blynta-worker` / `pm2 logs blynta-worker --lines 100 --nostream`.
Retry just one owned failed clip through the existing app to verify final
`clips/...` publication and playback. No legacy Studio deployment is needed.

If the canary fails, keep the current worker pin and collect the safe diagnostic
events. Do not bulk-retry customer clips. Rollback after a rollout uses the prior
release/revision or the existing `RENDER_EXECUTION_MODE=local` fallback under the
same drained deployment procedure; leave existing R2 objects untouched.

References: [Cloudflare's SDK v3 example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/),
[R2 S3 API and region](https://developers.cloudflare.com/r2/api/s3/api/).
