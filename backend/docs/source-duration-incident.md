# Source duration authorization incident — October 9, 2026

Job `6ac8c8e15feea2543bffc322` failed before transcription. Read-only job/operation/ledger inspection established:

| Value                         | Evidence                                                          |
| ----------------------------- | ----------------------------------------------------------------- |
| Estimated and approved source | 3,233 seconds in job and operation                                |
| Approved combined output      | 540 seconds; paid target up to nine clips                         |
| Downloaded source             | 3,233.461 seconds, supplied EC2 ffprobe output                    |
| Pricing snapshot              | `2026-10-v1`: source 300 seconds/credit, output 60 seconds/credit |
| Maximum reservation           | 20 credits: 11 source + 9 output                                  |
| Final settlement              | 0 charged, 20 released, 0 held                                    |
| Repeated failure              | Worker log `retryCount:2`, unchanged approval                     |
| Host checkout                 | `5fcf872`; API and worker both reported 37 minutes uptime         |

The strict `duration > sourceSeconds` check rejected a 0.461-second metadata precision discrepancy. It did not indicate insufficient credits: both source durations round to 11 source credits. The source check ran before persisting measured metadata, and fresh/cache updates could overwrite precise duration with platform metadata.

## Fix and boundaries

Clip validation accepts a positive discrepancy of **less than one second**, only when the original approved duration is a whole second, both source durations have the same billing units under the operation's saved pricing, and actual source plus the **entire original output allowance** still fits the original authorized credits. The four-hour hard limit remains. Exact approvals and shorter sources still pass. Studio's strict duration policy remains.

A fractional change crossing a pricing boundary (300 → 300.001 seconds with 300 seconds/credit) fails, even if unused output credits could cover it. A full extra second or larger discrepancy also fails even if its rounded source price is unchanged. This is a metadata precision rule, not an increased budget or an automatic authorization adjustment.

Every prepared source, including cache/resume, is inspected. Its precise duration is used for downstream processing and settlement; evidence is retained before rejection. Source authorization errors extend BullMQ's `UnrecoverableError`, survive processor/cache error handling, and stop automatic retries. Existing terminal failure publication/reconciliation settles unused reservations. Manual retry rejects the same failure before claiming/re-reserving.

The failed-job UI offers **Review new credit estimate**. `POST /jobs/estimate` may receive an owned failed job's `reviewJobId`; it verifies the same source and authorization failure and uses the greater of fresh metadata and saved measured duration, rounded up. Client-supplied measured durations are not accepted. This only quotes. Existing confirmation displays and submits the exact returned source/output authorization, credits and pricing version with a new operation ID. A new job starts only after explicit approval; the old operation, ledger and approval are unchanged. Insufficient credit approval remains blocked with an upgrade option. Old failures lacking saved measurements can be reviewed using current metadata; subsequent worker validation still enforces the financial ceiling.

## Release verification and rollout

The supplied checkout and PM2 uptimes show no obvious mixed release. They do **not** prove the running compiled artifact or process environment. The proven root cause is present in `5fcf872` regardless of that unresolved host detail. `/health` has no release identifier. The deployment procedure in `unified-billing.md` and `scripts/restart-media-worker.cjs` uses one canonical worker, but cannot guarantee matching running builds by itself.

After approval to deploy, drain processing and pause admission; use the existing deployment lock. Build the same checkout once; verify API and worker execute `dist/src/main.js` and `dist/src/worker.js` from that backend directory. Record the revision and artifact checksums, restart API and canonical worker from that build, refresh their environment, and compare only `BILLING_CREDITS_V2` and pricing configuration without exposing secrets. Check process start times after the build, authenticated billing `enabled:true`, and the returned pricing version. Deploy the matching frontend recovery UI. No new environment variable, pricing change, index or ledger migration is introduced by this fix; keep the existing V2 setup.

Use a dedicated test account/source for the post-release smoke test: reserve before processing, compare approved and measured source diagnostics, deliver output, then verify charge does not exceed approval, unused credits release and duplicate completion creates no additional charge. Genuine overage should reach terminal failure on its first attempt, release unused credit, block manual retry and require a fresh confirmation. Do not charge, alter or automatically retry the historical incident job.

## Local validation

Regression coverage exercises exact/fractional durations, pricing boundary crossings, true overages, saved snapshot/credit ceilings, Studio strictness, processor fresh/cache paths, real installed BullMQ retry decisions, manual retry rejection, server-owned recovery quotes, ledger settlement idempotency/release, and frontend review/explicit confirmation/upgrade behavior. Run focused backend Jest tests for `source-authorization`, `jobs-source-budget`, `credits.service`, `job-failure`, `credit-pricing`, `credit-lifecycle`, `credits-recovery`, `jobs-cancellation`; run `node --test scripts/tests/billing-ui.test.mjs`, backend build and main-app typecheck. Dedicated Mongo replica-set and live Redis/production end-to-end checks remain separate rollout gates; these local tests do not claim those integrations were exercised.

No production code/configuration, job, balance or ledger was modified during this investigation.

Final local results: **125 backend tests passed across 10 suites; nine frontend checks passed; backend production build and main-app typecheck passed**. Frontend lint and focused backend lint passed. The remaining backend lint diagnostics in the existing billing fixture, JobsService and VideoDownloadService were compared with `HEAD`; no new diagnostics were introduced there. Diff whitespace checks passed. The full backend suite and dedicated Mongo/live Redis integrations were not rerun for this incident.
