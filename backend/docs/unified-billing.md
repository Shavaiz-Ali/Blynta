# Unified billing, credits, and Studio

Implementation and rollout guide. V2 is **disabled by default**. The October 8 follow-up below inspected specific live records read-only; these fixes have not been deployed or activated.

## Architecture

`CreditsModule` is the shared accounting boundary for the API, AI Clips workers, Studio, referrals, Paddle, and admin tools. Available credits and held credits live on the same User account. MongoDB transactions commit immutable ledger entries, account deltas, and operation state together. Unique operation IDs and ledger keys enforce idempotency. Admission reserves a bounded estimate; durable delivery settles a cumulative charge; failures release unused holds. Customer-facing responses omit internal usage metrics and audit metadata.

The ledger is append-only through the application model. Corrections use new refund or adjustment entries. Production database permissions should restrict direct ledger writes; model middleware is not a substitute for database access control.

## Database and migration

New collections: `creditentries` (opening, grant, reserve, charge, release, refund, adjustment), `creditoperations` (authorization, immutable pricing snapshot and input fingerprint, held/charged totals, retry generation, persisted AI result, cumulative delivered outputs), and `processingusages` (operation/attempt/stage measurements). Unique indexes protect ledger keys, operation IDs, and usage samples. History indexes support user/date/product/type filters.

User gains `creditsReserved`, `creditLedgerInitialized`, and `freeCreditGrantAt`. Jobs gain credit operation/budget fields and renewable worker execution leases. Studio exports and transcription assets reference their operation. Existing cached available balances, plan identifiers, Paddle products/prices/subscriptions, and legacy job records are preserved.

Run from `backend`:

```powershell
npm run migrate:credit-ledger
npm run migrate:credit-ledger -- --apply
```

The first command is read-only and reports accounts lacking an opening entry. Apply creates indexes, then transactionally creates one opening entry per account and marks it initialized. Rerunning is safe. It preserves existing balances and monthly dates; it does not retroactively charge old jobs or change subscriptions. No bulk migration runs during application startup. New accounts are initialized lazily through the accounting service after activation.

## Pricing and delivery policy

Initial snapshot `2026-10-v1`:

| Operation | Credits |
| --- | --- |
| AI Clips source processing | ceil(actual source seconds / 300), once per operation with delivered output |
| AI Clips delivery | ceil(total cumulative delivered clip seconds / 60) |
| Studio cloud export | ceil(ceil(saved timeline extent seconds / 60) × studio modifier), initially modifier 1 |
| Studio AI proposal | 1 per delivered proposal |
| Studio caption transcription | ceil(asset source seconds / 300), only when usable captions are delivered |
| Editing, trimming, arranging, local previews, cached captions, JSON editing-plan download | Included |

A 60-minute source plus eight 45-second delivered clips costs 12 + 6 = 18 credits. Rounding aggregates delivered output across clips rather than independently rounding every clip. Timeline duration includes gaps and overlapping tracks only once, using the latest clip end.

AI Clips admission uses metadata preflight (without downloading the video) to establish the source budget, then asks the user to confirm that budget and the maximum output duration. New submissions are refused when V2 is disabled; there is no flat-rate admission fallback. Metadata is checked before download/provider work. Unknown, invalid, or over-budget source duration is refused. The render manifest keeps whole highlights within the approved output budget. Final charges use eligible delivered clips only. Nothing delivered means zero charge and full release, even if provider work incurred internal cost. Partial jobs charge source once plus delivered output and unlock the remainder. Clip and parent retries reuse the original operation/snapshot, reserve only its remaining authorization, and add only incremental charges. Delivered output records survive clip deletion. A different job/export/proposal is a new authorized operation.

Studio reserves before queue dispatch. Exports bill after a durable uploaded MP4 and persisted completed status. Repeated queue delivery reuses the export record. LLM proposal results are persisted before settlement and replayed without another generation. Caption preparation is a separately identified operation; the proposal is submitted again after captions complete. No charge exceeds the original authorization. Pricing changes require a new version; in-flight operations retain their snapshot.

## Subscription policy

Existing Free 5/month, Pro 50/month, Business 200/month and Paddle price IDs remain in place. Under V2, verified `transaction.completed` subscription payments add credits rather than replacing balances. `transaction.paid`, lifecycle/status updates, failed payments, scheduled cancellation/resume do not refill the account. Payment keys grant once; cycle keys prevent another full allocation for the same subscription period. A paid upgrade tops up only the difference in that cycle; a downgrade does not confiscate previously granted credits. Cancellation/pausing reverts paid entitlements to Free and preserves available/held credits. Past-due accounts retain their existing plan during the existing grace policy; no new allocation is made without a completed payment.

Billing dates come from Paddle billing periods, with a subscription API lookup when a completed payment lacks a period. A missing verified period fails processing so Paddle can retry. Free allocations use the persisted monthly schedule and an idempotent cycle entry. Recovery grants one due allocation and advances to the next future date; it does not mint multiple months of credits after a long outage. Credits carry over and do not expire under this policy.

Webhook acknowledgment follows durable processing. Processing errors return 503 and are not marked processed. Credit allocation remains idempotent if the API dies after a grant but before recording webhook completion. The existing subscription state/audit writes are separate from the ledger transaction; out-of-order subscription-state reconciliation should be verified in the Paddle sandbox before rollout.

## APIs and frontend

Authenticated shared endpoints:

- `GET /billing/credits`: available, reserved, plan, allowance, verified next renewal, pricing, supported entitlements.
- `POST /billing/credits/estimate`: bounded source/output estimate.
- `POST /jobs/estimate`: authenticated, rate-limited YouTube/Vimeo metadata preflight; returns the verified source budget and authoritative credit breakdown. Unknown metadata refuses admission rather than inventing a cost.
- `GET /billing/credits/history?page=1&limit=20&product=studio&type=charge`: paginated, owned history.
- `GET /billing/credits/transactions/:id`: owned, sanitized entry.
- Existing job creation now requires UUID, source/output budgets, authorized amount, and pricing version when V2 is enabled.
- Studio `POST /studio/projects/:id/render-estimate` and `/ai/estimate`; confirmed existing render/proposal routes accept the same authorization contract.
- Admin customer `/credits` exposes balances, reservations, ledger consistency, history, and measured usage; adjustments and `/refunds` require admin authorization and record actor/reason metadata.

Main Billing & Plan retains its existing three plan cards, adds accurate shared-credit guidance and history, and removes unsupported Studio/team/branding/watermark claims. Creation and export dialogs estimate before confirmation and show insufficient credits. Main and Studio headers/profile/dashboard use available and held credits without interpreting a balance as monthly consumption. Balance polling refreshes cross-app changes. Studio account proxies preserve authentication and narrowly expose billing reads. Checkout return screens wait for verified payment rather than claiming that credits were already granted. Duplicate network retries retain the same authorization for identical work.

Shared billing types are in `packages/types`; insufficient-credit UX is in `packages/ui`. Studio supports its existing 720p/1080p MP4 cloud exports; basic editing remains free. Pricing is enforced server-side.

## Recovery, usage, and administration

Media worker reconciliation runs each minute in bounded cursor batches. It finishes interrupted terminal settlements, redelivers persisted queue intent, releases orphaned admissions, and handles failed exports/transcription. Execution leases and BullMQ active job state protect active processing from stale-hold release. AI results are durable; missing results are released after the provider timeout margin. AI publication and settlement require the claimed execution token and retry generation. Recovery checks that same ownership and absence of a result inside the accounting transaction; reopening clears old ownership. Ledger/account audits use a transaction snapshot and emit consistency errors without silently rewriting balances.

Actual SDK token usage, transcription audio duration, FFmpeg CPU/wall time, and uploaded output bytes are recorded where measurable. Distinct samples retain UUID identifiers. Completed samples are immediately persisted and placed in the existing Redis retry outbox (`billing:usage:pending`); the existing recovery cron replays pending records idempotently. Final enrichment never replaces customer accounting. Redis persistence/replication is an operational requirement. A crash before the first durable acknowledgment, or simultaneous MongoDB/Redis failure, can still lose telemetry; no zero-loss guarantee is claimed. Optional configured rates produce estimated USD costs. Missing measurements/rates remain unknown. Internal cost recording failures are logged without failing customer processing. Actual wall-clock runtime never determines customer credits. `BILLING_COST_WARNING_USD` can flag expensive attempts. Admin details show raw provider measurements and known estimates; invoice-level infrastructure charges and reliable revenue/cost margins require additional authoritative invoice/revenue inputs and are not fabricated.

## Environment and production rollout

- `MONGO_URI`: existing connection; transactions require a replica set or sharded cluster.
- `BILLING_CREDITS_V2=false`: admission flag, identical on all API/media worker instances.
- `BILLING_PRICING_JSON`: optional complete snapshot `{ "version":"2026-10-v1", "sourceSeconds":300, "outputSeconds":60, "studioSeconds":60, "studioModifier":1, "aiCredits":1 }`.
- `BILLING_COST_RATES_JSON`: optional rates by `provider/model` or stage, using input/output USD per million tokens, audio USD per minute, CPU USD per hour. Supply actual contracted rates; example values are not verified prices.
- `BILLING_COST_WARNING_USD`: optional positive per-attempt estimate alert threshold.
- `BILLING_TEST_MONGO_URI`: isolated local/sandbox replica set for opt-in database tests. These tests create/drop a random test database; never use a production URI.
- Studio `NEXT_PUBLIC_BLYNTA_URL`: main application origin for supported billing links.
- Existing Redis, Paddle webhook/API/price settings, provider keys, and object-storage configuration remain required.

1. Back up the database and validate recovery access. Provision a non-production replica set, Redis, object storage, and Paddle sandbox.
2. Deploy compatible code with V2 disabled on every API and media worker. Run the opt-in Mongo tests and sandbox scenario matrix below.
3. Enter a maintenance window for billable admission, Paddle/admin credit writes, and referral processing. Stop old API/worker binaries, drain active legacy work, and ensure nothing can change balances outside the ledger during migration.
4. Run migration dry-run, review counts and current balances, then explicitly apply. Verify unique indexes, opening entries, preserved balances/subscriptions, and ledger audits. No destructive job backfill is required.
5. Deploy/restart API and media workers with V2 enabled together, then update/reopen clients. Verify estimate → reserve → processing → durable delivery → settlement → history in both products using one shared account.
6. Verify failure/cancellation/partial output/retry/crash/Redis outage; replay duplicate Paddle payment and subscription lifecycle events; verify upgrade/downgrade/renewal/past-due/cancel behavior and webhook retries.
7. Monitor `billing.transaction.failed`, `billing.reconciliation.failed`, `billing.ledger.inconsistent`, `billing.usage.persist.failed`, stale holds, queue intent, and high-cost logs. Wire these structured events into the deployment's monitoring system.
8. Roll back admission by setting V2 false in the compatible release. Keep the new reconciliation worker running so existing holds settle. Initialized users cannot use legacy direct deduction. Do not restore the old binary or reset balances; use compensating entries for corrections.

## Verification and remaining gates

October 8 follow-up verification:

- Focused billing, recovery and authenticated download/metadata controller tests: **77 passed, 0 failed, 3 skipped**.
- Full backend suite: **357 passed, 2 failed, 3 skipped**. Failures remain in unchanged `app.controller.spec.ts` (missing DatabaseConnection provider) and notification read-status behavior.
- Billing UI render tests: **4 passed**.
- Backend production build, main app typecheck, and focused accounting/recovery lint: passed after the final code changes.
- Main app, Studio and admin typechecks passed again for this follow-up. Shared UI/types checks also passed during the original integration.

The three real MongoDB tests in `credits.mongo.spec.ts` remain unexecuted without a dedicated `BILLING_TEST_MONGO_URI`: concurrent AI Clips/Studio reservations and duplicate settlement; subscription cycle/upgrade idempotency; ledger update/delete rejection. Mocked transaction tests are not evidence of replica-set behavior. The configured production database was inspected read-only and supports transactions; it was not used for destructive tests.

Authenticated browser → queue → storage → Paddle sandbox scenarios and visual/responsive browser QA remain rollout gates. Existing standalone Studio editor tests previously failed to resolve `@blynta/auth/client` from their temporary directory; passing typechecks do not replace that test.

## October 8 incident investigation and focused fixes

### A. Root cause and verified limits

Affected job: `6ac7d47f0203cb83c6e452d1`, created `2026-10-08T17:35:59.111Z`, completed. Persisted source duration is **3237.661 seconds**, with one completed **48-second** clip. It has no credit operation ID, operation snapshot/authorization/hold/charge, or matching ledger entries. A matching activity records `credit.deduct` with amount **1**. The inspected account has available balance **198**, with no initialized-ledger marker or reserved balance. No ledger exists to reconstruct an authoritative before/after settlement balance; 199→198 is consistent with the activity but is not established as a historical balance snapshot.

This establishes that the job used legacy flat-rate billing. Under the agreed formula its durations cost `ceil(3237.661 / 300) + ceil(48 / 60) = 11 + 1 = 12`. Exactly 3000 seconds plus 45 seconds costs 11. No historical job or balance was modified.

The prior repository admission fallback called `UsersService.deductCredit()` when V2 was disabled, and the frontend displayed “1 credit per job” in that state. This matches the incident. The precise live feature flag, deployed revision, compiled worker build and PM2 restart state remain unverified without host access; an old build versus the flag-off fallback cannot be distinguished from the records alone.

Read-only HTTP checks found `/billing/credits` returning **401**, rather than the previously reported 404, and `/health` returning **200** with the database connected. That confirms route availability at the time of inspection, not V2 activation. MongoDB `hello` confirmed a replica set. Ledger indexes, including the unique key index, exist; this does not establish a completed account migration or prove every operation/usage index exists.

Reproduce the read-only diagnostic from `backend` with `npx ts-node scripts/inspect-credit-job.ts 6ac7d47f0203cb83c6e452d1`. It prints only selected job/account/accounting fields and topology/index facts, not connection secrets or payment data.

### B. Actual billing integration

`HeroInput` → authenticated `JobsController.estimate()` → existing `VideoDownloadService.fetchVideoMetadata()` → shared `CreditsService.estimate()` → user authorization → `JobsService.createJob()` → `CreditsService.reserve()` → durable job/queue intent. Metadata retrieval has a bounded timeout, restricted public platform URLs and no video download.

Workers enter `JobsService.runMediaExecution()`, renew execution leases and assert the measured source fits the authorized budget before analysis. Render manifests enforce output limits. `JobsService.finalizeCredits()` aggregates eligible completed/uploaded clip durations with remembered delivered outputs, calculates `eligibleClipPrice()` using the original operation snapshot, and calls `CreditsService.settle()`. Settlement uses a transaction with conditional state checks to commit the account, ledger and operation together. No delivery costs zero; partial delivery charges source once plus actual combined output, releasing the remainder. Retry reuses the operation and charges only the cumulative increment.

`useCreateJob` refreshes account/billing queries even on uncertain network outcomes; terminal polling transitions refresh them again. Existing cancellation/retry invalidations and balance polling remain.

New Clips admission has no legacy one-credit call. The deprecated helper remains for compatibility, with no current production call sites. Legacy subscription/account writers remain available only for pre-migration flag-off accounts and must be stopped during migration. Existing legacy jobs are not backfilled or retrospectively charged.

### C. Safeguards in real flows

| Safeguard | Assessment | Mechanism and remaining limit |
| --- | --- | --- |
| Concurrent spending | Implemented | `reserve()` conditional available/held updates inside `transaction()`; shared by Clips and Studio. Real replica-set concurrency test remains a gate. |
| Duplicate deductions | Implemented | Stable operation IDs, unique ledger keys, cumulative `settle()`, durable delivered outputs and retry reuse. |
| Failures/abandoned holds | Implemented in code; operational verification pending | Actual worker cron `CreditsRecoveryService.recover()`, terminal settlement, orphan release, queue intent replay, active BullMQ checks and expired execution leases. AI ownership fencing now covers stale result/failure/recovery races. Requires healthy workers, Redis and MongoDB; it cannot release holds during a prolonged outage. |
| Multiple samples and durability | Partially implemented | UUID samples already existed. Immediate persistence and Redis replay now reduce crash loss without duplicate rows. A crash before acknowledgment or both stores failing can still lose analytics. |
| Database validation | Partially implemented | Runtime enums, required fields, safe integers, signed deltas, validated immutable pricing, update validators and document authorization invariants. Service transactions enforce cross-field accounting. Direct driver writes bypass Mongoose; collection validators were not installed without a compatibility audit. |
| Atomic accounting | Implemented | `transaction()` encloses balance, ledger and operation changes; retry activation checks financial authorization atomically. Parent/queue writes use existing durable intent and reconciliation. |
| Ledger integrity | Partially implemented | Existing immutable fields/query guards retained; modified document saves, document deletion and mutating bulk writes now rejected. Refunds/adjustments append compensating entries. Native collection/admin writes require database access controls. |

### D. Focused code changes

- `jobs.service.ts`, `jobs.controller.ts`, `create-job.dto.ts`, `video-download.service.ts`: refuse disabled admission, metadata estimate and bounded retrieval.
- Main `HeroInput.tsx`, job query hooks and shared billing types: remove the flat-rate label, show source/output estimate, reserve/final-charge distinction and refresh authoritative balances.
- `credits.service.ts`, `usage-context.ts`, `metered-ai.ts`, transcription service and recovery cron: execution fencing, immediate distinct usage persistence and bounded idempotent replay using existing Redis/recovery infrastructure.
- `credit.schemas.ts` and user schema: runtime validation and additional ledger write guards. Studio cached proposals retain validated response shape.
- Focused pricing, service, lifecycle, controller, recovery and UI tests; one read-only incident diagnostic.

### E. Exact activation and verification procedure

These are operator steps, not actions performed by this task. Do not activate production until the dedicated database tests and sandbox scenarios pass.

1. Commit/review this follow-up and record its exact hash as `FIX_COMMIT`. On the deployment host, check `git rev-parse HEAD` and `git merge-base --is-ancestor 0669798 HEAD`, then `git merge-base --is-ancestor "$FIX_COMMIT" HEAD`. Repeat for the deployed frontend release. The ancestor check alone does not prove the process loaded that build.
2. Inspect PM2 without printing secrets:

   ```sh
   pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.stringify(JSON.parse(s).map(p=>({name:p.name,status:p.pm2_env.status,script:p.pm2_env.pm_exec_path,started:p.pm2_env.pm_uptime,billingFlag:p.pm2_env.BILLING_CREDITS_V2??"check dotenv on host"})),null,2)))'
   ```

   Confirm canonical `blynta-api` uses `backend/dist/src/main.js` and exactly one `blynta-worker` uses `backend/dist/src/worker.js`. Inspect dotenv locally for the billing flag/pricing only; do not export all environment variables. Check compiled artifacts with `rg 'Usage-based billing is not active|executionToken|billing:usage:pending' dist/src` after building; compare their timestamps to process start times. Check `RECONCILE_IN_WORKER=true` and the canonical worker role from `ecosystem.config.js`.
3. In a sandbox, set a dedicated replica-set `BILLING_TEST_MONGO_URI`, then run `npm run test:billing -- --runInBand` from `backend`. These tests drop their generated test database. Never supply the production URI. Exercise authenticated metadata → authorization → queue → durable delivery → settlement, partial/cancel/failure/retry/crash and Paddle duplicate/renewal scenarios.
4. Back up production. Enter a maintenance window, drain legacy processing and stop every balance writer (API, billing webhooks, referrals, admin actions and relevant workers). Keep V2 false. From `backend`, run `npm run migrate:credit-ledger`, review the report, then explicitly run `npm run migrate:credit-ledger -- --apply`. Verify opening entries match preserved balances and unique indexes: `creditentries.key`, `creditoperations.operationId`, `processingusages.(operationId,attemptId,stage)`.
5. Before activation, audit existing credit documents through the current models' `validate()` in a read-only cursor, and verify nonnegative integer user balances. Stop on incompatible data and arrange reviewed corrections; do not automatically rewrite history. No collection validators are installed by this release. Consider MongoDB collection validation only after this audit and migration compatibility review.
6. Configure identical `BILLING_CREDITS_V2=true` and pricing on every compatible API/worker: `{"version":"2026-10-v1","sourceSeconds":300,"outputSeconds":60,"studioSeconds":60,"studioModifier":1,"aiCredits":1}`. Configure Redis persistence/replication and permit `HSET`, `HSCAN`, `HDEL` for the usage outbox. Use a reviewed MongoDB role allowing ledger reads/inserts but no ledger update/delete; give operations/accounts their necessary transactional permissions and keep index/migration administration separate. Do not apply these roles blindly to shared collections.
7. Under the host's existing deployment lock, build with `npm run build`; restart `blynta-api` using `pm2 startOrRestart ecosystem.config.js --only blynta-api --update-env`. After draining processing, use `node scripts/restart-media-worker.cjs` to remove legacy duplicate aliases and start one canonical worker. Verify all other billing writers loaded compatible code/config, save PM2 state and confirm startup index/topology checks passed. Then deploy the main frontend with the correct backend origin; redeploy Studio if its server proxy requires the matching release. The metadata route must be reachable through that origin.
8. Authenticated checks: `/billing/credits` reports `enabled:true`; `/jobs/estimate` reports a metadata-derived duration and source/render credit breakdown; one confirmed job has an operation and reserve entry before processing, then actual charge/release entries and zero held amount at terminal settlement. Confirm source/combined-output duration arithmetic, matching pricing version, account audit consistency, frontend balance/history refresh and exactly one recovery worker. Test Studio on the same balance. Do not use the historical incident job for retroactive charging.
9. Monitor transaction/reconciliation/ledger/usage failures and stale reservations. To stop new admission, set V2 false in this compatible release and restart its processes; keep recovery enabled to settle existing operations. Do not roll back to a legacy balance-writing binary or reset balances.

### F. Readiness

Focused implementation checks pass, and production data establishes the incident's legacy billing path. Production activation remains blocked on a dedicated replica-set test run, sandbox end-to-end scenarios, migration/compatibility review, actual host build/config verification and authenticated frontend QA. No production deployment, flag change, migration application, permission change or historical deduction was performed.

Paddle references: [completed transactions](https://developer.paddle.com/webhooks/transactions/transaction-completed/), [subscription retrieval](https://developer.paddle.com/api-reference/subscriptions/get-subscription/), [proration](https://developer.paddle.com/concepts/subscriptions/proration/).


October 9 clip-generation follow-up: new Clips defaults authorize output for six Free or up to nine paid clips, at most 60 seconds each and bounded by source length. Small requested budgets are rejected explicitly; metadata preflight caps short-source output to its duration. These are reservation ceilings; final source/combined-delivered-output pricing is unchanged. See `media-processing-report.md` for caption dependencies, count diagnostics and tests.

October 9 creation UX follow-up: `POST /jobs/estimate` now accepts a supported source URL without `maxOutputSeconds`. The controller chooses the existing backend plan policy, caps output to the verified source duration, and delegates pricing and available balance to `CreditsService.estimate()`. Explicit output budgets remain supported and validated for existing callers. The frontend displays the returned allowance, breakdown and maximum charge, then submits those exact values only after approval. Insufficient balances block approval rather than silently reducing the existing minimum clip policy or increasing authorization. Reservation and settlement still enforce their existing financial safeguards.

`GET /billing/credits` additionally returns `clipExample`, calculated by the existing `clipPrice()` with the active pricing snapshot for a 30-minute source and three minutes of output. The shared How Credits Work dialog displays this example and server-provided rates; it contains no independent frontend pricing calculation. The new frontend requires the compatible estimate endpoint. No additional environment variables, ledger migrations or pricing changes are required by this UX follow-up.
