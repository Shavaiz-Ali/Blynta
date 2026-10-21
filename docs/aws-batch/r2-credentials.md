# Renderer R2 credentials: diagnosis and deployment

## Credential path and root cause

`renderer.main.ts` calls `runRenderer()` without starting a Nest application.
`runRenderer()` defaults to `new ConfigService()` and `new R2Service(config)`.
Nest ConfigService reads `process.env` by default. It does not fetch Secrets
Manager, load the EC2 worker's `.env`, or discover a secret by its name. ECS must
inject the two selected secret fields before starting Node.

The only R2 S3 client used by the Batch renderer is in
`backend/src/storage/r2.service.ts`. It supplies **explicit Cloudflare credentials**:

| Config / environment name | Client option                 |
| ------------------------- | ----------------------------- |
| `R2_ACCESS_KEY_ID`        | `credentials.accessKeyId`     |
| `R2_SECRET_ACCESS_KEY`    | `credentials.secretAccessKey` |
| `R2_ENDPOINT`             | HTTPS S3-compatible endpoint  |
| fixed `auto`              | S3 region for R2              |

The old code used `config.get(name, '')`; the fallback does not overwrite injected
values. Absent variables became empty strings, and explicit empty values stayed
empty. These were passed to S3Client, producing R2's zero-length access-key error.
The message proves the application used an empty access key; without inspecting
the deployed definition/secret, it does not identify which mapping or field is
missing. Missing JSON-key references or execution-role permissions can instead
cause ECS initialization errors before the application starts.

There is no fallback to `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or the AWS
task-role credential chain for R2. The separate `BatchClient` in
`batch-render.service.ts` deliberately uses the AWS default credential chain/EC2
instance role for SubmitJob/DescribeJobs/cancellation. Keep that separation.

The other R2 S3 client initializations are in `youtube/youtube.processor.ts`,
`scripts/audit-clip-import.cjs`, and `scripts/studio-r2-cors.cjs`. Each reads R2-named
credentials; none is called by the standalone renderer, and none was modified.

R2Service now validates both credential values before constructing S3Client.
Missing, empty, non-string, whitespace-only and surrounding-whitespace values
throw a value-free `UnrecoverableError`. The renderer exits 2, so the existing
Batch exit rule stops deterministic retries. Diagnostics redact configured R2
credentials before applying the existing media sanitization. Image self-tests
remain offline and require no real credentials; the build preflight verifies that
empty credentials are rejected.

## Exact secret fields and job-definition mapping

The secret `blynta/renderer/r2-credentials` must contain a JSON object with string
fields named exactly `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, containing the
Cloudflare R2 S3 access-key ID and secret access key. These are not an AWS IAM key
pair, a Cloudflare account ID, or a Cloudflare API bearer token. Do not paste
values into chat, a job-definition environment array, source code, or build args.

From an authorized AWS shell, resolve the **actual full secret ARN**, including
its generated suffix, without retrieving or printing the values:

```bash
export AWS_REGION=ap-south-1
SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id blynta/renderer/r2-credentials --query ARN --output text)
```

Use these entries in **`containerProperties.secrets`**, not `environment`:

```json
[
  {
    "name": "R2_ACCESS_KEY_ID",
    "valueFrom": "<FULL_SECRET_ARN>:R2_ACCESS_KEY_ID::"
  },
  {
    "name": "R2_SECRET_ACCESS_KEY",
    "valueFrom": "<FULL_SECRET_ARN>:R2_SECRET_ACCESS_KEY::"
  }
]
```

Substitute the full ARN returned above. The trailing `::` selects the JSON key
and the default current secret version. If the stored JSON uses different field
names, the JSON-key segment must match those names while the injected environment
names remain exactly as above. Do not map the entire JSON object to either name.
Remove duplicate/blank credential entries from `containerProperties.environment`.
The existing repository job-definition template already uses the correct syntax.

Keep `R2_BUCKET_NAME=blynta`, `R2_SOURCE_BUCKET_NAME=blynta`, the existing HTTPS
`R2_ENDPOINT`, and `R2_PUBLIC_DOMAIN` absent/empty. Keep Fargate platform 1.4.0 or a
supported later version for JSON-key injection.

The **execution role** `blyntaBatchExecutionRole` needs
`secretsmanager:GetSecretValue` on this secret ARN. Add `kms:Decrypt` on its KMS
key only when a customer-managed KMS key is used. Preserve its ECR/log permissions.
The renderer task role is not the ECS secret-injection role. The EC2 backend role
continues authenticating AWS Batch operations; the backend does not need to fetch
the task's secret or copy credentials into SubmitJob overrides.

## Inspect safely

Set `CURRENT_DEF` to the definition ARN/revision from the failed job; image tag
`v2` is not a job-definition revision. This prints mapping metadata and any
plaintext credential **names only**, never their values:

```bash
CURRENT_DEF='blynta-render-job:REPLACE_CURRENT_REVISION'
aws batch describe-job-definitions --job-definitions "$CURRENT_DEF" \
  --query "jobDefinitions[0].{definition:jobDefinitionArn,image:containerProperties.image,executionRole:containerProperties.executionRoleArn,platform:containerProperties.fargatePlatformConfiguration.platformVersion,secrets:containerProperties.secrets,plaintextCredentialNames:containerProperties.environment[?name=='R2_ACCESS_KEY_ID'||name=='R2_SECRET_ACCESS_KEY'].name}" \
  --output json
```

An operator authorized to read the secret can validate its fields without
displaying the values. Do not use shell tracing, AWS `--debug`, `tee`, or print the
raw SecretString. This pipeline prints booleans only, and suppresses JSON error
details that might contain content:

```bash
set -o pipefail
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" \
  --version-stage AWSCURRENT --query SecretString --output text |
python3 -c '
import json, sys
try:
    data = json.loads(sys.stdin.read())
    if not isinstance(data, dict): raise ValueError()
except Exception:
    print("Secret must be a JSON object; values omitted")
    sys.exit(1)
names = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
valid = {name: isinstance(data.get(name), str) and bool(data[name].strip())
         and data[name] == data[name].strip() for name in names}
key_length_ok = valid[names[0]] and len(data[names[0]]) == 32
print(json.dumps({"nonemptyFields": valid, "accessKeyIdIs32Characters": key_length_ok}))
sys.exit(0 if all(valid.values()) and key_length_ok else 1)
'
```

This verifies field shape, not permission to read R2 objects. Never share secret
values; share only these booleans and mapping metadata if investigation continues.

## Deploy without changing active jobs

1. Fix missing/incorrect mappings or empty secret fields through the existing
   secure administration workflow. Correct injection can unblock image `v2`
   without an image rebuild; its existing ConfigService already reads the right
   environment variables. The new fail-fast validation and redaction **do require
   rebuilding the renderer image**. Use a new immutable Git-SHA tag, not an
   overwrite of `v2`.
2. Build the committed fix with the existing CodeBuild workflow in
   [single-bucket-deployment.md](single-bucket-deployment.md). Require
   `renderer_storage_preflight_passed` with `missingCredentialsRejected: true`.
   No credential is needed by CodeBuild or Docker and no runtime `.env` is copied.
3. Clone `CURRENT_DEF` into a private deployment file, preserving roles, resource
   requirements, networking, logging and timeout/retry settings. Set the rebuilt
   image/digest and correct secret mappings. An exact jq patch, after the main
   runbook has prepared `DEPLOY_DIR` and `IMAGE`, is:

   ```bash
   aws batch describe-job-definitions --job-definitions "$CURRENT_DEF" \
     --query 'jobDefinitions[0]' > "$DEPLOY_DIR/previous.json"
   jq --arg image "$IMAGE" --arg arn "$SECRET_ARN" '
     {jobDefinitionName,type,platformCapabilities,parameters,containerProperties,
      retryStrategy,timeout,propagateTags,tags}
     | with_entries(select(.value != null))
     | .containerProperties.image = $image
     | .containerProperties.environment = ((.containerProperties.environment // [])
         | map(select(.name != "R2_ACCESS_KEY_ID" and .name != "R2_SECRET_ACCESS_KEY")))
     | .containerProperties.secrets = (
         ((.containerProperties.secrets // [])
           | map(select(.name != "R2_ACCESS_KEY_ID" and .name != "R2_SECRET_ACCESS_KEY")))
         + [{name:"R2_ACCESS_KEY_ID",valueFrom:($arn+":R2_ACCESS_KEY_ID::")},
            {name:"R2_SECRET_ACCESS_KEY",valueFrom:($arn+":R2_SECRET_ACCESS_KEY::")}])
   ' "$DEPLOY_DIR/previous.json" > "$DEPLOY_DIR/next.json"
   NEW_REV=$(aws batch register-job-definition \
     --cli-input-json "file://$DEPLOY_DIR/next.json" --query revision --output text)
   ```

   Ensure the two bucket environment entries are still `blynta`. Inspect the new
   definition with the same safe metadata query before testing. Existing revision
   references and active jobs do not change when a new revision is registered.

4. Use the isolated `batch-render-smoke.cjs` command in the main runbook with the
   new definition and an owned existing source video. It verifies Batch success,
   result identity, and the uploaded R2 output size without deleting objects or
   publishing a product clip. Do not rerun AI or bulk-retry customer jobs.
5. After success, pin the EC2 worker's existing
   `BATCH_RENDER_JOB_DEFINITION=blynta-render-job:<NEW_REV>` and apply the normal
   drained PM2 rollout. Keep the EC2 worker's already-working R2 credentials and
   AWS IAM role unchanged. Do not copy the task secret into new plaintext env vars.
   Injected secret values are snapshots: changing a secret does not update an
   already-running Fargate task; new submissions fetch the current fields.

No AWS deployment, IAM change, secret update, or live secret read is performed by
this code change. Live mapping/field inspection remains an operator verification.

Reference: [AWS Batch secret injection and JSON-key ARN syntax](https://docs.aws.amazon.com/batch/latest/userguide/specifying-sensitive-data-secrets.html).
