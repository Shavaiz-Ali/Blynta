# Single private R2 bucket: AWS Batch deployment

The old `assertBatchStorage()` rejected `source === output` independently of the
HTTPS check. It runs in both `BatchRenderService.execute()` and `runRenderer()`.
Revision `blynta-render-job:3` embeds that old code: deploying only the EC2 worker
will move the same failure into Fargate. Rebuild the image and register a new
revision; do not reuse or overwrite revision 3 or its image tag.

No production deployment, bucket operation or AWS change is performed by these instructions.
Run them after the reviewed fix is committed and pushed.

## Storage and failure behavior

Use the existing bucket and existing credentials, on the worker and task:

```ini
AWS_REGION=ap-south-1
RENDER_EXECUTION_MODE=aws_batch
BATCH_RENDER_QUEUE=blynta-render-queue
BATCH_RENDER_JOB_DEFINITION=blynta-render-job:<NEW_REVISION>
R2_BUCKET_NAME=blynta
R2_SOURCE_BUCKET_NAME=blynta
R2_ENDPOINT=https://<EXISTING_R2_ACCOUNT_ID>.r2.cloudflarestorage.com
```

`R2_PUBLIC_DOMAIN` must be absent or empty for this shared private bucket. Verify
Cloudflare's public development URL and direct public custom-domain access are
disabled. Clearing an application variable alone does not make a public bucket
private. No second bucket or new application environment variable is required.
Keep `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in the existing secret mechanism;
the token needs object read/write access to `blynta`. Existing EC2 IAM permissions
remain unchanged. The renderer uses the job definition's secret injection, not
credentials copied from the EC2 process.

The worker sends bucket names and endpoint as non-secret SubmitJob overrides so
task storage routing matches the submitting process. Existing key routing stays:

| Objects                        | Existing keys                                                  | Bucket                  |
| ------------------------------ | -------------------------------------------------------------- | ----------------------- |
| Durable source videos          | `source-videos/<id>/video.mp4`, `job-sources/<job>/<file>.mp4` | `R2_SOURCE_BUCKET_NAME` |
| Task, progress, result markers | `job-sources/batch/<sha256>/{task,progress,result}.json`       | `R2_SOURCE_BUCKET_NAME` |
| Staged editing inputs          | `job-sources/batch/<sha256>/inputs/<file>`                     | `R2_SOURCE_BUCKET_NAME` |
| Intermediate rendered video    | `job-sources/batch/<sha256>/output.mp4`                        | `R2_SOURCE_BUCKET_NAME` |
| Published clips                | `clips/<job>/<clip>-captioned.mp4`                             | `R2_BUCKET_NAME`        |

With one bucket, all rows target `blynta`. With separate buckets, the original
routing is preserved. No keys or objects are renamed, moved, removed or migrated.
FFmpeg temporary files stay in an isolated local task directory. Backend and task
reject unsafe keys and collisions between an input and any task/output/marker key.

Configuration/input errors throw BullMQ `UnrecoverableError`, stopping automatic
Bull retries and allowing existing failure finalization to mark only the affected
clip failed. The renderer exits with code 2 for these errors (including a missing
clip source detected by HEAD); SubmitJob includes `evaluateOnExit` with `EXIT` for
code 2. Other failures retain bounded AWS attempts, and temporary worker errors
retain Bull retry eligibility. A persisted terminal execution is never resubmitted
on a Bull retry. Manual clip retry creates a fresh execution identity as before.
Older execution records without the optional `retryable` field remain compatible.

## Build and register a revision (Bash, AWS CLI and jq)

Use the deployment checkout containing the pushed fix. Commands require the
operator's AWS SSO/IAM session; never export static keys.

```bash
export AWS_REGION=ap-south-1
FIX_SHA=$(git rev-parse HEAD)
BUILD_ID=$(aws codebuild start-build --project-name blynta-renderer-build \
  --source-version "$FIX_SHA" --query build.id --output text)
aws codebuild batch-get-builds --ids "$BUILD_ID" \
  --query 'builds[0].{status:buildStatus,source:resolvedSourceVersion,logs:logs.deepLink}'
```

Repeat the status command until `SUCCEEDED`; stop on failure. The existing root
buildspec builds Linux AMD64 with `backend/Dockerfile.renderer`, validates FFmpeg,
FFprobe, filters and fonts, and pushes the commit-SHA image. Verify the resolved
source equals `FIX_SHA`. The Dockerfile and CodeBuild both run
`node scripts/check-renderer-storage.cjs` against the compiled module inside the
image. Require `renderer_storage_preflight_passed` in the build log before using
the image. This offline guard accepts single/separate private buckets and checks
HTTPS, privacy and collision protection; an old compiled module fails the build.
Rebuilding is mandatory; updating the EC2 checkout does not update Fargate images.

Clone the existing revision to preserve execution/task roles, secret references,
network/public-IP configuration, logging, CPU, RAM and disk settings:

```bash
DIGEST=$(aws ecr describe-images --repository-name blynta/ffmpeg_renderer \
  --image-ids imageTag="$FIX_SHA" --query 'imageDetails[0].imageDigest' --output text)
IMAGE="834897673310.dkr.ecr.ap-south-1.amazonaws.com/blynta/ffmpeg_renderer@$DIGEST"
umask 077
DEPLOY_DIR=$(mktemp -d)
aws batch describe-job-definitions --job-definitions blynta-render-job:3 \
  --query 'jobDefinitions[0]' > "$DEPLOY_DIR/previous.json"
jq --arg image "$IMAGE" '
  {jobDefinitionName,type,platformCapabilities,parameters,containerProperties,
   retryStrategy,timeout,propagateTags,tags}
  | with_entries(select(.value != null))
  | .containerProperties.image = $image
  | .containerProperties.environment = (
      (.containerProperties.environment // []
        | map(select(.name != "R2_BUCKET_NAME" and
                     .name != "R2_SOURCE_BUCKET_NAME" and .name != "R2_PUBLIC_DOMAIN")))
      + [{name:"R2_BUCKET_NAME",value:"blynta"},
         {name:"R2_SOURCE_BUCKET_NAME",value:"blynta"}])
  | .retryStrategy.evaluateOnExit = [{onExitCode:"2",action:"EXIT"}]
' "$DEPLOY_DIR/previous.json" > "$DEPLOY_DIR/next.json"
# Review the private local file; ensure the existing R2_ENDPOINT is valid HTTPS.
NEW_REV=$(aws batch register-job-definition \
  --cli-input-json "file://$DEPLOY_DIR/next.json" --query revision --output text)
printf 'Pin BATCH_RENDER_JOB_DEFINITION=blynta-render-job:%s\n' "$NEW_REV"
aws batch describe-job-definitions --job-definitions "blynta-render-job:$NEW_REV" \
  --query 'jobDefinitions[0]' > "$DEPLOY_DIR/registered.json"
jq -e --arg image "$IMAGE" '
  .containerProperties.image == $image and
  any(.containerProperties.environment[]; .name == "R2_BUCKET_NAME" and .value == "blynta") and
  any(.containerProperties.environment[]; .name == "R2_SOURCE_BUCKET_NAME" and .value == "blynta") and
  (all(.containerProperties.environment[]; .name != "R2_PUBLIC_DOMAIN" or .value == ""))
' "$DEPLOY_DIR/registered.json"
aws batch describe-job-definitions --job-definitions "blynta-render-job:$NEW_REV" \
  --query "jobDefinitions[0].{revision:revision,image:containerProperties.image,storage:containerProperties.environment[?name=='R2_BUCKET_NAME'||name=='R2_SOURCE_BUCKET_NAME'||name=='R2_ENDPOINT'||name=='R2_PUBLIC_DOMAIN']}" \
  --output json
```

Do not print credential values. Keep the previous image/revision for reference;
do not deregister or terminate running production jobs as part of this rollout.
Registration alone does not change which revision the worker submits.

Before changing the running PM2 worker, test the new definition in an isolated
smoke process using the already-updated EC2 backend. From its backend directory,
set `NEW_DEF` to the returned definition and `SOURCE_KEY` to an existing video you
own (at least five seconds, with audio). These overrides affect only this process:

```bash
NEW_DEF="blynta-render-job:$NEW_REV"
SOURCE_KEY='source-videos/REPLACE_OWN_TEST_SOURCE/video.mp4'
BATCH_RENDER_JOB_DEFINITION="$NEW_DEF" \
BATCH_SMOKE_ID="single-bucket-$FIX_SHA-$(date +%s)" \
RENDER_EXECUTION_MODE=aws_batch BATCH_RENDER_ATTEMPTS=1 \
node -r dotenv/config scripts/batch-render-smoke.cjs "$SOURCE_KEY"
```

Copy the actual `NEW_REV`/`FIX_SHA` values from CloudShell when using a separate
EC2 shell. The smoke command requires the existing EC2 R2/Mongo runtime environment
and EC2 instance role. It does not restart PM2, modify product clips, rerun AI, or
delete source objects. It writes only a unique Batch execution and its temporary
R2 prefix. It must report an AWS job ID, output key and positive byte count after
Batch `SUCCEEDED`, matching result identity, and R2 HEAD size verification. Retain
that output as live-test evidence; a local FFmpeg fixture is not a live Batch test.
Do not change the production worker pin until this canary succeeds. A test job
uses normal shared Fargate capacity but does not stop or alter existing jobs.

## EC2 build, compiled-code check and PM2 deployment

Find the actual checkout with `pm2 describe blynta-worker` (the canonical process
name in `backend/ecosystem.config.js`). In that checkout, update to `FIX_SHA` using
the existing deployment/release procedure. Do not reset or overwrite local secrets.
Build in the deployment release before switching the running process:

```bash
cd backend
npm ci
npm run build
node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { ConfigService } = require('@nestjs/config');
const { assertBatchStorage } = require('./dist/src/batch-render/render-task');
const env = {R2_BUCKET_NAME:'blynta', R2_SOURCE_BUCKET_NAME:'blynta',
  R2_ENDPOINT:'https://example.r2.cloudflarestorage.com'};
assert.doesNotThrow(() => assertBatchStorage(new ConfigService(env)));
assert.throws(() => assertBatchStorage(new ConfigService({...env,
  R2_ENDPOINT:'http://example.r2.cloudflarestorage.com'})), {name:'UnrecoverableError'});
assert(!fs.readFileSync('dist/src/batch-render/render-task.js','utf8').includes(
  'Batch rendering requires HTTPS R2 and separate private source/output buckets'));
console.log('Compiled single-bucket validation passed');
NODE
```

Update the worker's existing deployment `.env`/secret environment to the values
above, pinning `blynta-render-job:$NEW_REV`. Keep its existing concurrency limits.
Before restart, allow active media work to drain using the existing deployment
window; do not kill active renders or globally pause customer queues for a test.
Under the normal host deployment lock, use the repository's canonical restart
helper (dotenv loads this release's `.env`, and the helper removes stale worker
aliases before starting exactly one canonical worker):

```bash
node -r dotenv/config scripts/restart-media-worker.cjs
pm2 describe blynta-worker
pm2 logs blynta-worker --lines 100 --nostream
```

The EC2 render/edit worker and Fargate image need deployment. An API restart is
needed only if its storage environment changes (for example removing an old
`R2_PUBLIC_DOMAIN` so clip downloads use signed URLs). The Docker build needs no
Mongo, Redis or R2 credentials. Do not redeploy the legacy Studio application.

## Verify one clip without bulk customer retries

First, optionally use `scripts/batch-render-smoke.cjs` from the main runbook with
a unique `BATCH_SMOKE_ID`, the new definition and your own private test source.
It writes only its own hashed Batch prefix/execution and does not publish a product
clip. It does not load `.env` itself: invoke with `node -r dotenv/config` or supply
the existing secure runtime environment. Do not run a second PM2 media worker
against production queues for this test.

1. Sign in to the existing Blynta web app using your test account. Open an owned
   failed video whose transcript/highlights and durable source already exist.
2. Choose **Retry** on exactly one failed clip. Do not use whole-video retry, bulk
   retry, delete claims, reset queues, or retry other users' clips. The existing
   endpoint is `POST /jobs/:jobId/clips/:clipId/retry` and keeps its authorization
   and credit checks. It queues a new render identity without rerunning highlights.
3. Find that clip's new execution in `batchexecutions` using its `owner.jobId` and
   recent creation time. Record its AWS job ID. In the Batch console/DescribeJobs,
   verify the new job-definition revision, bucket overrides both `blynta`, and
   transitions through `RUNNING` to `SUCCEEDED`.
4. Inspect `/aws/batch/blynta-renderer` and the worker's `render_completed` event
   for that clip. The task result key must be under its hashed Batch prefix; final
   publication must remain `clips/<job>/<clip>-captioned.mp4`. Failed tasks must not
   mark a clip completed. Play/download the clip through the app and check crop,
   captions, audio and timestamps.
5. Verify the original source object remains at its original key, with the same
   size/ETag, and other clips' states were not reset. Do not modify or migrate any
   existing R2 objects during this verification.

There is no per-user execution-mode or job-definition switch in the current
implementation. This tests only your clip, but it shares normal production queue
capacity. Strict zero-impact isolation requires an isolated staging backend,
database and Redis namespace with the existing web app pointing at that backend;
it cannot be guaranteed by creating another worker on the production queue.

If rollback is needed, set the existing worker flag to `local` and restart the
worker through the same helper after draining/cancelling your own test task.
Retry only the affected clip through the app. Pinning the old revision 3 while
keeping `aws_batch` with a shared bucket restores the original failure.

References: [AWS retry matching](https://docs.aws.amazon.com/batch/latest/APIReference/API_EvaluateOnExit.html),
[Cloudflare public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
