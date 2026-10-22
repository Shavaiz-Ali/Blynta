# Credit management implementation and deployment

The subsequent billing UI/checkout changes and final verification results are documented in [billing-checkout-ui.md](billing-checkout-ui.md). That report supersedes the UI/checkout verification notes below; the accounting and migration policy here remain applicable.

## Audit and reuse

Blynta already had a transactional wallet cached on `User`, an append-only `CreditEntry` ledger, `CreditOperation` reservations, pricing snapshots, processing usage telemetry, Paddle event records, credit history UI, and a generation approval modal. These remain the single credit system.

The existing pricing policy is unchanged: `ceil(sourceSeconds / 300) + ceil(deliveredOutputSeconds / 60)`. An 81-minute source and six output minutes reserve 17 + 6 = 23 credits. Free clip targets remain up to six clips; paid targets remain up to nine. Trusted metadata preflight runs before downloading the source; workers verify the downloaded source against the approved budget before expensive processing. The clip product currently accepts video URLs; this change does not add a separate file-upload path.

Existing job creation reserves first, saves a parent job second, and dispatches through a durable retry intent. Existing BullMQ/AWS execution leases, cumulative settlement, retry generations, and recovery remain in use. No changes to queues, R2 storage, Batch infrastructure, or subscription price mappings are required.

## Behavior

- New accounts receive 30 Free credits once, with account insertion and the grant ledger entry committed together. Local and social signup use the same service. Repeated signup cannot grant to an existing account.
- Free credits never renew. The old monthly Free grant scheduler and grant method are removed. Cancellation changes the plan without refilling or confiscating the wallet.
- Monthly paid plan defaults are Pro: 50 credits / $12 and Business: 200 credits / $39. Paddle remains authoritative for prices; the display prices and existing subscription price IDs are preserved.
- Subscription grants require `transaction.completed` and a mapped subscription price, payment ID, subscription ID, and verified billing period. Subscription lifecycle events update entitlements without granting. Duplicate payments/cycles cannot grant twice. An upgrade adds only the difference between the allocation already granted for that cycle and the new allocation. Downgrades do not remove credits.
- Existing annual price mappings are preserved. Allocations follow the verified billing cycle as before; this change does not introduce calendar-month grants between annual payments. Review annual entitlements separately before advertising a monthly allocation for annual products.
- Free, subscription, and purchased credits share one non-expiring spendable pool. Grant metadata identifies their source/payment/cycle. Charges consume the common pool; source-specific expiry and FIFO buckets are not introduced.
- The balance API exposes available, reserved, recorded grants, lifetime consumed usage, plan allocations, renewal information, and payment credits owed. Historical grants before the ledger existed cannot be reconstructed: migrated opening holdings are the grant baseline, while existing lifetime consumption is retained. Recorded grants can therefore be lower than lifetime consumed usage on migrated accounts.
- Estimates retain existing API fields and add `availableCredits`, `reservedCredits`, `estimatedSourceCredits`, `estimatedOutputCredits`, `maximumReservation`, `remainingAfterReservation`, `hasEnoughCredits`, `creditsNeeded`, and `canProceed`. Negative hypothetical remaining values indicate a shortfall; they never represent a negative wallet. Active account and payment-debt checks also affect `canProceed`.

## Settlement and payment reversal policy

Job settlement charges source analysis once only when at least one clip is delivered, plus actual delivered output duration. No delivered output means no charge. Partial success charges delivered work and releases the rest. Retries bill only incremental delivered output within the original authorization. Cancellation/failure waits for active execution leases before releasing unused credits. Existing recovery scans durable job state, redispatches interrupted work, settles terminal jobs, and releases orphaned reservations after the existing grace period.

Payment refunds differ from platform service refunds. Service refunds use the existing owned-charge validation and compensating positive ledger entries. Approved Paddle refunds, credits, and chargebacks reverse credits attributed to their original payment. Partial reversals use the ratio of verified adjusted money to the transaction total, rounded up to whole credits, capped at the net credits granted by that payment. Tax-only adjustments are not separately exempted from this proportional policy. Pending/rejected adjustments have no wallet effect.

A payment reversal removes available credits first. Credits already consumed or held become `creditDebt`; running holds are preserved. New reservations, including retry holds, are blocked while debt remains. Future grants, service refunds, and released holds recover debt through separate immutable adjustment entries. Chargeback/credit reversals restore the original adjustment once, repay any debt first, and permit subsequent legitimate refunds to reverse the restored credits again. Chargeback warnings have no credit effect until an actual chargeback arrives.

Paddle events are signature-verified using the original raw body. Reconstructed JSON is rejected. Missing event IDs fail processing. Payment/adjustment keys remain durable in the ledger even after the existing processed-event TTL expires. Failures return a retryable webhook response. Account-link failures are retried instead of silently losing grants. An adjustment arriving before its payment grant waits for the completed-payment webhook and returns a retryable error without fabricating a grant. Unknown unrelated products do not get credit entitlements from custom checkout data. Verified completed-payment timestamps before a legacy opening are rejected if the payment has no migrated audit marker, requiring audit reconciliation instead of silently granting again.

Paddle's documented approval and adjustment event behavior is covered by [adjustment.updated](https://developer.paddle.com/webhooks/adjustments/adjustment-updated/) and [adjustment.created](https://developer.paddle.com/webhooks/adjustments/adjustment-created/).

## Backend files

- `backend/src/billing/credit-config.ts`: centralized validated plan allocations and credit-pack catalogue.
- `backend/src/billing/credits.service.ts`: new-account initialization, safe opening entries, richer balances/estimates, payment reversal/debt recovery, dispute restoration.
- `backend/src/billing/billing.service.ts`: real one-time Paddle checkout, payment-customer ownership, verified pack grants, approved adjustments, subscription allocation configuration and cancellation preservation.
- `backend/src/billing/billing.controller.ts`: authenticated/rate-limited pack listing and checkout, adjustment webhook routing, raw-body/event-ID enforcement.
- `backend/src/users/users.service.ts`: local/social account creation through the transactional ledger.
- `backend/src/users/schemas/user.schema.ts`: shared 30/50/200 defaults and the two new fields below.
- `backend/src/jobs/credits-recovery.service.ts`: removes monthly Free grants; keeps existing reservation recovery.
- `backend/scripts/migrate-credit-ledger.ts`, `backend/package.json`: idempotent migration and TypeScript-first resolution. The repository contains an old source-adjacent `user.schema.js`; `--prefer-ts-exts` ensures the migration uses the maintained TypeScript schema.
- `backend/.env.example`: credit allocation and real pack-price configuration placeholders.

## Frontend and shared files

- `apps/app/features/billing/components/CreditPacks.tsx`: one purchase UI within the existing Billing page; real checkout mutation, disabled unconfigured products, explicit configuration errors, loading/error states.
- `apps/app/features/billing/components/BillingPage.tsx`: one-time Free copy, backend plan allocations, purchase section, grant/consumption totals and payment debt.
- `apps/app/features/billing/queries.ts`: pack queries/checkout; balance changes invalidate profile/history; removes independent history polling.
- Dashboard `GenerationConfirmation.tsx` and `HeroInput.tsx`: remaining spendable balance, other reserved work, authoritative admission including the approval recheck, shared insufficient-credit actions.
- `apps/app/components/layout/AppHeaderRight.tsx`, dashboard `StatsBar.tsx`, profile `ProfilePlanCard.tsx`: live wallet balance and corrected Free renewal copy.
- Dashboard `JobsCard.tsx`: removes stale five-credits-per-month copy.
- `packages/ui/src/components/InsufficientCredits.tsx`: explicit shortfall plus upgrade and buy-credit links, reusable by both products.
- `packages/ui/src/components/AppProductHeader.tsx`: Free credits shown as one-time; no Free renewal date.
- `packages/types/src/billing.ts`: backward-compatible response fields.
- App shell test fixtures: provide the new live balance hook and existing workspace CSS module to the component harness.

The UI uses existing shared components and Tailwind. It grants nothing from checkout redirects. Existing job-terminal and checkout callbacks invalidate credit/profile queries. Balance polling is five seconds while holds exist and thirty seconds otherwise, pauses in background under TanStack defaults, and refetches on focus. There is no existing credit push/event transport in the app; external subscription/administrative changes use this bounded fallback. This is eventual UI refresh, not instantaneous server push.

## Database changes and migration

New optional/defaulted User fields:

- `freeCreditPolicy`: `one-time-v1` on new accounts only, used to distinguish a signup grant from a legacy opening entry.
- `creditDebt`: nonnegative safe integer, default zero, for already-spent refunded payment credits.

No new wallet, ledger, payment, or reservation collections. Existing unique ledger/operation/usage indexes remain required. The legacy `freeCreditGrantAt` field remains readable for compatibility but is no longer scheduled or populated. The migration removes existing values without touching wallet balances, reservations, consumption, subscription identifiers, or payment records. Already-initialized accounts keep their ledger. Noninitialized accounts get a single opening entry for their existing available/reserved holdings. Existing completed-payment audit records become zero-balance ledger markers with their historical allocations and available billing-cycle references. They prevent regranting after event TTL expiry, preserve known cycle allocations, and allow refunds to reverse historical grants without changing balances during migration. Missing legacy payment audit records require manual reconciliation before a retry/refund can proceed. There is deliberately no automatic 25-credit top-up or reset for existing Free users.

Deployment order:

1. Back up MongoDB. Stop all old API/worker instances that can run the monthly Free scheduler or mutate balances; do not run old/new schedulers together.
2. Use a replica set or sharded cluster. From `backend`, with its existing `MONGO_URI` configured, inspect the dry-run:

   ```sh
   npm run migrate:credit-ledger
   ```

3. Review `accountsWithoutOpening`, `freeRenewalsToDisable`, and `historicalPaymentAuditRows`, then apply:

   ```sh
   npm run migrate:credit-ledger -- --apply
   ```

4. Deploy the updated API and workers together. Startup checks transaction support and required unique indexes even if new processing is paused; payments and account grants still need safe accounting. An unprepared database fails startup with migration instructions.
5. Set `BILLING_CREDITS_V2=true` consistently on API and workers to permit new processing and pack purchases. `false` pauses admission, not existing reservation recovery or subscription accounting.
6. Verify one new Free signup, one insufficient-credit estimate, one completed/failed/partial job, and a sandbox subscription/pack purchase and refund before production traffic.

The script defaults to dry-run, is safe to repeat, and never changes Paddle products/prices. This implementation did not run the migration against an application database or deploy changes.

## Environment and Paddle setup

Retain existing `MONGO_URI`, Redis/queue settings, media/R2/AWS settings, and:

| Variable                                                    | Purpose                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `BILLING_CREDITS_V2`                                        | Enable new processing/pack admission after migration                                                                                       |
| `BILLING_FREE_CREDITS`                                      | Signup credits, default 30; never renewed                                                                                                  |
| `BILLING_PRO_CREDITS`                                       | Verified subscription cycle allocation, default 50                                                                                         |
| `BILLING_BUSINESS_CREDITS`                                  | Verified subscription cycle allocation, default 200                                                                                        |
| `BILLING_PRICING_JSON`                                      | Existing optional versioned processing rates; unchanged                                                                                    |
| `PADDLE_API_KEY`, `PADDLE_ENV`, `PADDLE_WEBHOOK_SECRET`     | Existing Paddle server credentials/environment/signing secret                                                                              |
| `PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_BUSINESS`           | Existing subscription IDs; monthly aliases and annual mappings remain supported                                                            |
| `PADDLE_PRICE_ID_CREDITS_25`, `_50`, `_100`                 | Real active one-time Paddle prices for the default packs                                                                                   |
| `BILLING_CREDIT_PACKS_JSON`                                 | Optional replacement array of `{ "id": "pack-id", "credits": 25, "priceId": "real Paddle price ID" }`; omit to use the default three packs |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV` | Existing frontend Paddle checkout configuration; rebuild after changing public variables                                                   |
| `BILLING_TEST_MONGO_URI`                                    | Dedicated replica-set URI for integration tests only; never use a production database                                                      |

Create actual one-time credit-pack prices in the matching Paddle environment. No prices or product IDs are invented. Keep IDs unique across packs and separate from subscription prices. Configure the approved checkout domain/default payment link for the existing app payment route. The backend validates active/non-recurring pack prices before checkout. Missing pack IDs keep purchase buttons disabled and identify the missing variable. Pack grants use the configured allocation at webhook handling: keep price IDs and quantities stable while pending payments/webhooks reference them. Use new product/pack IDs for future allocation changes, after draining pending checkouts and webhook retries.

Subscribe the existing signed webhook destination to `transaction.completed`, subscription lifecycle events, and **both** `adjustment.created` and `adjustment.updated`. Checkout redirects never prove entitlement. Verify sandbox duplicate deliveries, approvals, and chargeback reversal payloads using Paddle's environment before switching credentials to production.

## Verification

Added backend tests cover configurable allocations/products, atomic signup and rollback, one-time Free initialization, migration preservation including reserved holdings, historical payment markers and old-event rejection, the 81-minute estimate, insufficient spendable credits, duplicate pack grants/adjustments, partial/full refunds, chargeback debt, debt recovery on release and later purchases, dispute restoration and a subsequent refund, real checkout construction, missing/recurring products, ownership, completed-only grants, approved-only adjustments, adjustment-before-payment retry, unknown price rejection, and raw-body/signature rejection.

Existing tests continue to cover concurrent reservations, no negative balances, cumulative partial settlements/retries, duplicate completion, subscription-cycle deduplication/upgrades/renewals, validated service refunds, orphan/failed-work recovery, source metadata verification, and AWS/local render retry behavior. Added UI assertions check remaining credits, explicit shortfall, buy-credit routing, disabled missing configuration, and a configured purchase button calling checkout.

Verification on this implementation:

| Check                                                                   | Result                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `npx jest --runInBand billing credits-recovery --silent`        | 118 passed; 3 Mongo integration tests skipped                                                                                                                       |
| Backend `npx jest --runInBand jobs-download.controller --silent`        | 9 HTTP integration tests passed; required localhost access outside the sandbox                                                                                      |
| Existing render processor regression suite during broader lifecycle run | Passed                                                                                                                                                              |
| Root `npm run test:billing-ui`                                          | 12 passed                                                                                                                                                           |
| App shell component regression suite                                    | 17 passed; two unchanged Studio toolbar/viewport assertions fail against the current Studio UI                                                                      |
| Backend `npm run typecheck` and `npm run build`                         | Passed                                                                                                                                                              |
| App `npm run typecheck`                                                 | Passed                                                                                                                                                              |
| ESLint on changed app components/queries                                | Passed                                                                                                                                                              |
| `git diff --check`                                                      | Passed                                                                                                                                                              |
| Backend lint on affected billing/users/tests                            | Fails unsafe-`any`/async-mock rules; the existing files and test adapter/mocks have a substantial backlog, and this change does not claim a clean backend lint gate |

The dedicated Mongo replica-set tests require `BILLING_TEST_MONGO_URI` and were skipped because it was absent. A full live Paddle checkout/webhook round trip, migration rehearsal, and real Mongo concurrency run remain deployment checks, not claims made by unit mocks. No production migration, checkout, refund, or deployment was performed.

Local configuration inspection found `PADDLE_PRICE_ID_CREDITS_25`, `PADDLE_PRICE_ID_CREDITS_50`, `PADDLE_PRICE_ID_CREDITS_100`, and the optional replacement catalogue unset in `backend/.env`. Set real Paddle products/prices before enabling purchases. No credential values were displayed or changed.
