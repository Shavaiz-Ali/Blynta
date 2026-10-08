# Unified billing, credits, and Studio

Implementation and rollout guide. This change is **disabled by default** and has not been deployed or exercised against production services.

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

AI Clips admission uses a user-confirmed maximum source duration and output duration. Metadata is checked before download/provider work. Unknown, invalid, or over-budget source duration is refused. The render manifest keeps whole highlights within the approved output budget. Final charges use eligible delivered clips only. Nothing delivered means zero charge and full release, even if provider work incurred internal cost. Partial jobs charge source once plus delivered output and unlock the remainder. Clip and parent retries reuse the original operation/snapshot, reserve only its remaining authorization, and add only incremental charges. Delivered output records survive clip deletion. A different job/export/proposal is a new authorized operation.

Studio reserves before queue dispatch. Exports bill after a durable uploaded MP4 and persisted completed status. Repeated queue delivery reuses the export record. LLM proposal results are persisted before settlement and replayed without another generation. Caption preparation is a separately identified operation; the proposal is submitted again after captions complete. No charge exceeds the original authorization. Pricing changes require a new version; in-flight operations retain their snapshot.

## Subscription policy

Existing Free 5/month, Pro 50/month, Business 200/month and Paddle price IDs remain in place. Under V2, verified `transaction.completed` subscription payments add credits rather than replacing balances. `transaction.paid`, lifecycle/status updates, failed payments, scheduled cancellation/resume do not refill the account. Payment keys grant once; cycle keys prevent another full allocation for the same subscription period. A paid upgrade tops up only the difference in that cycle; a downgrade does not confiscate previously granted credits. Cancellation/pausing reverts paid entitlements to Free and preserves available/held credits. Past-due accounts retain their existing plan during the existing grace policy; no new allocation is made without a completed payment.

Billing dates come from Paddle billing periods, with a subscription API lookup when a completed payment lacks a period. A missing verified period fails processing so Paddle can retry. Free allocations use the persisted monthly schedule and an idempotent cycle entry. Recovery grants one due allocation and advances to the next future date; it does not mint multiple months of credits after a long outage. Credits carry over and do not expire under this policy.

Webhook acknowledgment follows durable processing. Processing errors return 503 and are not marked processed. Credit allocation remains idempotent if the API dies after a grant but before recording webhook completion. The existing subscription state/audit writes are separate from the ledger transaction; out-of-order subscription-state reconciliation should be verified in the Paddle sandbox before rollout.

## APIs and frontend

Authenticated shared endpoints:

- `GET /billing/credits`: available, reserved, plan, allowance, verified next renewal, pricing, supported entitlements.
- `POST /billing/credits/estimate`: bounded source/output estimate.
- `GET /billing/credits/history?page=1&limit=20&product=studio&type=charge`: paginated, owned history.
- `GET /billing/credits/transactions/:id`: owned, sanitized entry.
- Existing job creation now requires UUID, source/output budgets, authorized amount, and pricing version when V2 is enabled.
- Studio `POST /studio/projects/:id/render-estimate` and `/ai/estimate`; confirmed existing render/proposal routes accept the same authorization contract.
- Admin customer `/credits` exposes balances, reservations, ledger consistency, history, and measured usage; adjustments and `/refunds` require admin authorization and record actor/reason metadata.

Main Billing & Plan retains its existing three plan cards, adds accurate shared-credit guidance and history, and removes unsupported Studio/team/branding/watermark claims. Creation and export dialogs estimate before confirmation and show insufficient credits. Main and Studio headers/profile/dashboard use available and held credits without interpreting a balance as monthly consumption. Balance polling refreshes cross-app changes. Studio account proxies preserve authentication and narrowly expose billing reads. Checkout return screens wait for verified payment rather than claiming that credits were already granted. Duplicate network retries retain the same authorization for identical work.

Shared billing types are in `packages/types`; insufficient-credit UX is in `packages/ui`. Studio supports its existing 720p/1080p MP4 cloud exports; basic editing remains free. Pricing is enforced server-side.

## Recovery, usage, and administration

Media worker reconciliation runs each minute in bounded cursor batches. It finishes interrupted terminal settlements, redelivers persisted queue intent, releases orphaned admissions, and handles failed exports/transcription. Execution leases and BullMQ active job state protect active processing from stale-hold release. AI results are durable; missing results are released after the provider timeout margin. Reopened AI attempts use their new execution timestamp. Ledger/account audits use a transaction snapshot and emit consistency errors without silently rewriting balances.

Actual SDK token usage, transcription audio duration, FFmpeg CPU/wall time, and uploaded output bytes are recorded where measurable. Optional configured rates produce estimated USD costs. Missing measurements/rates remain unknown. Internal cost recording failures are logged without failing customer processing. Actual wall-clock runtime never determines customer credits. `BILLING_COST_WARNING_USD` can flag expensive attempts. Admin details show raw provider measurements and known estimates; invoice-level infrastructure charges and reliable revenue/cost margins require additional authoritative invoice/revenue inputs and are not fabricated.

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

Final local verification:

- Focused billing/product/retry/render/recovery/admin suite: **111 passed, 0 failed, 3 skipped**.
- Full backend suite: **342 passed, 2 failed, 3 skipped**. Both failures are in unchanged health-controller and notification-read tests.
- Billing UI render tests: **3 passed**.
- Backend production build: passed.
- Main app, Studio, admin, shared UI, and shared types typechecks: passed.
- Focused lint checks for the new accounting/recovery code and main/Studio billing surfaces: passed.
- Standalone Studio editor script: failed on its pre-existing temporary-folder authentication module resolution.

 Pricing, transactional rollback/concurrency/idempotency, paid cycle top-ups, bounded refunds, actual Studio admission/queue recovery, actual AI Clips cumulative finalization, worker recovery, existing render/retry/Studio/Paddle/admin behavior, and customer history states have automated coverage. Replica-set tests are opt-in and skipped without `BILLING_TEST_MONGO_URI`.

The local environment has no running MongoDB/Redis replica set or provider sandbox, so live authenticated browser → API → queue → storage → Paddle flows and production deployment are **unverified**. Do not enable V2 in production until the sandbox matrix passes. The broad backend suite has pre-existing health-controller database-injection and notification-read failures. The existing standalone Studio editor runner cannot resolve `@blynta/auth/client` in its temporary folder; this is separate from passing Studio typechecking and backend Studio tests. Full visual/responsive browser QA remains a rollout gate.

Paddle references: [completed transactions](https://developer.paddle.com/webhooks/transactions/transaction-completed/), [subscription retrieval](https://developer.paddle.com/api-reference/subscriptions/get-subscription/), [proration](https://developer.paddle.com/concepts/subscriptions/proration/).
