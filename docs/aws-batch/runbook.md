# AWS Batch rendering: deployment and validation

No AWS resource or production flag has been changed by this implementation.
Use a staging Mongo database, R2 buckets, backend/worker and test media first.
The legacy `apps/studio` and backend Studio processors are not routed to Batch.

## Configuration

On backend render/edit workers (not the image build):

| Variable | Default / purpose |
| --- | --- |
| `RENDER_EXECUTION_MODE` | `local`; opt in with `aws_batch` |
| `AWS_REGION` | `ap-south-1` |
| `BATCH_RENDER_QUEUE` | `blynta-render-queue` |
| `BATCH_RENDER_JOB_DEFINITION` | `blynta-render-job`; deploy with a pinned `:revision` |
| `BATCH_RENDER_VCPU` | `2`; supported Fargate value |
| `BATCH_RENDER_MEMORY_MIB` | `4096`; must be compatible with vCPU |
| `BATCH_RENDER_ATTEMPTS` | `2`, allowed 1–3, retries belong to Batch |
| `BATCH_RENDER_TIMEOUT_SECONDS` | `3600`, 60–86400, each running attempt |
| `BATCH_TOTAL_TIMEOUT_SECONDS` | `7200`, 60–86400, preparation + queue + all attempts |
| `BATCH_POLL_INTERVAL_MS` | `5000`, 100–60000; prefer >=5000 in deployment |

Existing `MONGO_URI`, Redis, R2 and storage settings stay on the backend. The AWS
SDK uses the EC2 instance profile/default credential chain: do not set static AWS
keys. Existing render concurrency/global capacity limits still apply to remote
in-flight clip jobs. Increase them only after measuring queue and account quotas.
`EDIT_RENDER_TIMEOUT_SECONDS` still bounds the *entire* edited-video workflow;
increase it on staging if Batch queue wait exceeds the existing edit timeout.

The task needs only `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_SOURCE_BUCKET_NAME`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; optional `FFMPEG_THREADS`,
`MEDIA_HOST_CONCURRENCY`, `MEDIA_COMMAND_TIMEOUT_SECONDS`, `CAPTION_FONTS_DIR`.
Use a separate private source bucket with no public custom domain. Use a scoped
Cloudflare R2 object-read/write token for these buckets, injected at runtime from
Secrets Manager via the Batch job definition. R2 credentials are Cloudflare
credentials, not AWS IAM keys. The image needs no Mongo, Redis, AI or AWS secrets.

## IAM and network prerequisites

Attach `backend-role-policy.json` to the **EC2 instance role that actually runs
the BullMQ render/edit workers**. An API-only EC2 host does not submit these jobs.
For deployments sharing the role, the same policy covers both. Have an AWS
administrator verify attached policies/permission boundaries; this repository
cannot attest to the live role. `DescribeJobs` needs `Resource: "*"`. Cancel and
terminate currently cover jobs in this account/region; use a dedicated worker role
and queue. The application does not register definitions or pass arbitrary roles.

`blyntaBatchExecutionRole` trusts `ecs-tasks.amazonaws.com` and needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:GetDownloadUrlForLayer","ecr:BatchGetImage"],"Resource":"arn:aws:ecr:ap-south-1:834897673310:repository/blynta/ffmpeg_renderer"},
    {"Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:ap-south-1:834897673310:log-group:/aws/batch/blynta-renderer:*"},
    {"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"REPLACE_R2_SECRET_ARN"}
  ]
}
```

Add `kms:Decrypt` scoped to the secret's KMS key only if it uses a customer-managed
key. The log group already exists; set retention separately. `blyntaRendererTaskRole`
also trusts `ecs-tasks.amazonaws.com`; this renderer requires **no AWS API grants**
on that task role. ECS injects the R2 secret using the execution role.

CodeBuild's existing role needs `ecr:GetAuthorizationToken` on `*` and
`ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`,
`ecr:CompleteLayerUpload`, `ecr:PutImage` on the renderer repository. Keep its
existing source/build log permissions. Do not grant it R2 secrets or Batch submit.

Tasks need outbound HTTPS/DNS to R2, ECR, Secrets Manager and CloudWatch. Public IP
requires public subnets with an internet-gateway route, even though inbound access
is unnecessary. Verify `blynta-render-compute` is VALID/ENABLED and its queue is
ENABLED. Use compatible CPU/memory pairs and enough Fargate ephemeral disk for
short editing sources (staged inputs capped at 8 GiB; default task disk is 20 GiB).

## Build the immutable image with CodeBuild

Configure `blynta-renderer-build` with this repository as its source, root
`buildspec.yml`, an AWS-managed Linux x86_64 standard image, and **privileged Docker
mode enabled**. The build context is the repository root. Docker's file-specific
ignore file allows only backend source/build files and licensed fonts; `.env`,
`.git`, local storage and frontend artifacts never enter the context.

From a shell with your normal AWS SSO/IAM session (Bash examples):

```bash
export AWS_REGION=ap-south-1
SHA=$(git rev-parse HEAD)
BUILD_ID=$(aws codebuild start-build --project-name blynta-renderer-build \
  --source-version "$SHA" --query build.id --output text)
aws codebuild batch-get-builds --ids "$BUILD_ID" \
  --query 'builds[0].{status:buildStatus,logs:logs.deepLink}'
# Repeat batch-get-builds until SUCCEEDED; failures must be fixed before deployment.
aws ecr describe-images --repository-name blynta/ffmpeg_renderer \
  --image-ids imageTag="$SHA" --query 'imageDetails[0].imageDigest'
```

Commit the implementation before building a SHA. No `latest` tag is pushed.
The build checks AMD64 architecture and FFmpeg/FFprobe/filter/font preflight before
pushing. Local equivalent if Docker is installed:

```bash
docker build --platform linux/amd64 -f backend/Dockerfile.renderer -t blynta-renderer:test .
docker run --rm blynta-renderer:test node dist/src/batch-render/renderer.main.js --self-test
```

Copy `job-definition.template.json` to an untracked deployment file. Replace the
image SHA, endpoint/buckets and secret ARN references. Store the R2 secret as JSON
with keys `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` through your secure secret
manager workflow, never a committed file or CLI argument. The template selects
those JSON fields using Fargate 1.4.0. Register the reviewed definition manually:

```bash
aws batch register-job-definition --cli-input-json file://renderer-job-definition.json \
  --query '{arn:jobDefinitionArn,revision:revision}'
```

Registration creates a new revision; it does not enable the backend. Record the
old revision and set the new revision only in the staging smoke process first.

## Smoke test without publishing a customer clip

Use a private R2 source MP4 >=5 seconds with audio and landscape dimensions
(portrait cropping expects width >= height*9/16). Load staging Mongo/R2 secrets
into the shell environment through your normal secure workflow. Then:

```bash
cd backend
npm ci
npm run build
export RENDER_EXECUTION_MODE=aws_batch
export BATCH_RENDER_JOB_DEFINITION=blynta-render-job:REPLACE_REVISION
export BATCH_RENDER_ATTEMPTS=1
export BATCH_SMOKE_ID="renderer-$SHA-first"
node scripts/batch-render-smoke.cjs job-sources/REPLACE_STAGING_SOURCE.mp4
```

This uses the real adapter, Mongo claim, Batch task, progress, result and output
verification without creating/completing a product clip. It prints AWS job ID and
private output key; download that key through existing R2 tooling/signed downloads
and inspect audio, portrait crop and burned captions. Re-run with the same
`BATCH_SMOKE_ID`: the AWS job ID must stay unchanged. Use a different smoke ID for
each intentional new test. To inspect status/log stream:

```bash
aws batch describe-jobs --jobs REPLACE_JOB_ID \
  --query 'jobs[0].{status:status,reason:statusReason,container:container,attempts:attempts}'
aws logs tail /aws/batch/blynta-renderer --since 30m
```

Then enable the flag on **one isolated staging render/edit worker** with the
corresponding staging backend/queues. Exercise product jobs with multiple clips,
all caption presets and scripts, no captions, audio, edits with crop/zoom/speed,
text/image/emoji overlays, transitions and trimmed/mixed audio. Edited inputs still
pass existing ownership/ETag/memory validation; the backend still performs full
output decode before publication. Compare to the same local fixture. Montserrat
is included; Impact/Georgia use documented open-font substitutes unless licensed
files are supplied (see `backend/renderer-fonts/README.md`).

Failure checks: use a missing source key under a fresh smoke ID; require FAILED
and no accepted result. Cancel a queued and a RUNNING product job through the
existing API; require Batch cancellation/termination and no published clip. For
the standalone smoke, Ctrl+C propagates the abort; verify via DescribeJobs. Set a
short total deadline and confirm queued work terminates. Restart a staging worker
mid-task; its retry must attach to the recorded job ID. A task which uploads then
fails must never complete a clip, because the adapter requires SUCCEEDED too.

## Ambiguous submissions and reconciliation

Mongo collection `batchexecutions` persists `_id`, R2 prefix, deadline, state and
AWS job ID. Multiple workers can attach to one record. Bull retries reuse the
execution; Batch handles up to the configured number of attempts. Product manual
retry advances the clip retry timestamp/count or edit generation and thus creates
a fresh execution. Do not delete claims to force a retry.

AWS SubmitJob has no idempotency token. A lost response leaves UNKNOWN; a crash
during preparation/submission may leave SUBMITTING until the deadline reconciler
marks UNKNOWN. Both prevent resubmission. Inspect AWS jobs by deterministic name
`blynta-<Mongo _id>` with `aws batch list-jobs --job-queue blynta-render-queue
--filters name=JOB_NAME,values=blynta-REPLACE_ID` (include CLI pagination and all
statuses). Verify creation time, task key, queue and definition using DescribeJobs.
If exactly one matching job exists, an administrator may bind its job ID to that
record and set state SUBMITTED without extending the original deadline. If the
deadline passed, terminate it instead and use a new explicit product retry. If
zero/multiple matches or uncertain, investigate/terminate possible jobs first;
never blindly reset the claim. The reconciler continues to terminate overdue
known job IDs even while the feature flag is local. Keep at least one updated
backend worker running until outstanding remote work is drained.

Configure a private R2 lifecycle for `job-sources/batch/` after an agreed retention
period (e.g. seven days, longer than all queue/runtime/recovery windows). These
objects include transcripts, task inputs, progress and temporary outputs. They
are not customer publication keys. Retain Mongo execution records for audit;
only archive terminal records after application retry/retention windows. Do not
delete existing `job-sources/edits/` outputs with this lifecycle.

## Rollback

1. Set `RENDER_EXECUTION_MODE=local` on render/edit workers and restart them.
   No API/frontend/schema reversal is needed; existing local source caching works.
2. Cancel active remote product jobs through the API before restart where possible.
   Inventory remaining submitted IDs in `batchexecutions`, then cancel/terminate
   them explicitly. Keep the new reconciler running until all remote tasks stop.
3. Retry affected failed/cancelled clips/versions through existing authorized retry
   flows after remote tasks are terminal. Local rendering owns final publication.
4. If reverting the image, pin `BATCH_RENDER_JOB_DEFINITION` to the prior revision
   before future opt-in. Keep prior ECR SHA images; never overwrite a known tag.

No production rendering is enabled by build, job-definition registration or the
smoke script. Production enablement needs a separate deployment decision after
visual/media, IAM, network, cancellation and restart checks pass.

References: [SubmitJob API](https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html),
[Fargate job definitions](https://docs.aws.amazon.com/batch/latest/userguide/fargate-job-definitions.html),
[Batch secrets](https://docs.aws.amazon.com/batch/latest/userguide/specifying-sensitive-data-secrets.html).
