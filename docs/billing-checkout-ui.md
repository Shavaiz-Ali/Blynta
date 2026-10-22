# Billing UI and Paddle checkout verification

Implemented 2026-10-22. This extends the credit-ledger work documented in [credit-management.md](credit-management.md).

## Root cause and evidence

The old upgrade mutation navigated to Paddle's transaction checkout URL, which points back to the app with `_ptxn`. That URL is a payment-link entry point, not a hosted payment form by itself: Paddle.js must initialize on the destination and open checkout. The old provider silently returned when the public token was missing, cached its initialization promise even after failure, and exposed no actionable initialization/opening error. It also combined Paddle's `_ptxn` auto-open behavior with a manual open. These defects allowed a valid transaction to leave the customer on an ordinary billing page without a checkout overlay or a retry path.

The production-specific trigger (deployed public environment, domain approval, CSP, or script failure) was **not established**: the deployed page required sign-in, and local verification was selected instead. No claim is made that a particular Vercel secret or Paddle domain setting was wrong. Local inspection found a sandbox client token and sandbox backend credentials; the optional explicit public environment was absent. A read-only Paddle API audit confirmed that the configured Pro and Business products and monthly prices were active, at USD 12 and USD 39 respectively. Invalid subscription prices were not the cause in this environment.

The replacement was verified beyond transaction creation:

- Clicking the production Pro UI opened the real Paddle sandbox payment form.
- The user submitted the test payment. Paddle displayed **“Your transaction has been completed successfully.”**
- A server-side read of that transaction returned `status: completed`, `environment: sandbox`.
- Clicking Business opened its real USD 39/month Paddle sandbox checkout in the selected dark theme. Closing it left the fixture plan/balance unchanged.

The browser preview deliberately used an isolated fixture wallet and no MongoDB connection. It did not grant credits or fake a verified payment. The status endpoint correctly returned `verified: false`, and the UI reported verification pending. A deployed, signed-webhook-to-real-wallet round trip remains a release check.

## Changes

| Area                  | Files                                                                                   | Result                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Billing layout        | `apps/app/features/billing/components/BillingPage.tsx`                                  | Compact overview, subscription cards, packs, history and credit help. Server balance, granted/consumed totals and refund debt remain authoritative. Free has no renewal date. Paid plan changes use the existing customer portal.                                                     |
| History               | `CreditHistory.tsx` in the same folder                                                  | Shared selects, table and pagination; filters reset pagination; payment/job references; recorded ledger status; contained horizontal table scrolling.                                                                                                                                 |
| Packs                 | `CreditPacks.tsx`                                                                       | Real Paddle unit prices, currency formatting, disabled unavailable packs, shared checkout flow. Configuration variable names are kept out of customer copy.                                                                                                                           |
| Help                  | `HowCreditsWork.tsx`                                                                    | Existing shared dialog and cards; source/output rates, reservations, returns and verified renewal behavior.                                                                                                                                                                           |
| Checkout lifecycle    | `PaddleProvider.tsx`, `apps/app/features/billing/paddle-client.ts`, `paddle-context.ts` | One SDK integration; validated environments; retryable initialization with timeout; explicit transaction overlay; light/dark; loaded/failed/closed/confirming/verified states.                                                                                                        |
| Queries/cache         | `apps/app/features/billing/queries.ts`, `cache.ts`                                      | Existing authenticated Axios and TanStack Query; initialize before creating a transaction; await overlay load; refresh wallet/profile/history after verification; explicit client boundary.                                                                                           |
| Backend checkout      | `backend/src/billing/billing.service.ts`, `billing.controller.ts`                       | Return transaction ID and environment; validate monthly subscription/one-time pack prices; owned status endpoint; checkout configuration endpoint; verified means completed payment plus durable ledger entry.                                                                        |
| Concurrency           | `backend/src/billing/schemas/customer.schema.ts`                                        | Optional customer checkout lease and separate pending subscription/pack IDs and keys. Concurrent requests serialize, retries reuse unpaid transactions, a different unpaid plan cancels the prior transaction, and existing subscriptions cannot start another subscription checkout. |
| Accounting references | `backend/src/billing/credits.service.ts`                                                | Grant/history rows expose related payment IDs without exposing arbitrary ledger metadata. Existing signed-webhook/idempotent accounting remains centralized.                                                                                                                          |
| Diagnostics           | `backend/scripts/audit-paddle-checkout.cjs`                                             | Read-only environment/product/price audit with no credential values or customer payloads in output. Run from `backend`: `node scripts/audit-paddle-checkout.cjs`.                                                                                                                     |
| Local preview         | `apps/app/scripts/preview-billing.cjs`                                                  | Isolated UI fixture using production components/provider and, only with `--sandbox-checkout`, real sandbox Paddle. Never mounts an auth-bypass route in the application or connects to the wallet database.                                                                           |
| Tests                 | `scripts/tests/billing-ui.test.mjs`, `backend/src/billing/credit-purchases.spec.ts`     | Environment, retry, overlay, resume, verified-only success, price/ownership, concurrency and pending-transaction regressions.                                                                                                                                                         |

Shared UI reused: `AppButton`, `AppCardRoot/Header/Title/Description/Content/Footer`, `AppBadge`, `AppSkeleton`, `AppSelect`, `AppPagination`, shared `Table` primitives, and the existing `AppDialog` wrapper through `HowCreditsWork`. The app's `PageContent`, Tailwind utilities and semantic theme tokens provide spacing and colors. No new styling library, duplicate select/dialog/pagination, or billing stylesheet was added. SSO/auth routes were preserved.

## Checkout behavior

The authenticated backend returns `{ transactionId, environment, checkoutUrl? }`. `checkoutUrl` remains for compatibility; upgrades and packs now call `Paddle.Checkout.open({ transactionId, settings: { displayMode: 'overlay', theme } })` directly. Loading ends on Paddle's `checkout.loaded`, with a bounded failure timeout and a retry path. Diagnostics exclude API credentials, tokens and payment details.

The provider captures a refresh `_ptxn` before SDK initialization to prevent auto-open/manual-open duplication. Explicit opens mark the transaction as already handled before updating Next's search params. Refresh checks transaction ownership/status: draft/ready reopens; paid/completed/billed verifies without reopening payment. Closing a completed checkout preserves pending verification and its resume URL. A completed SDK callback alone grants nothing and displays no success. The server must see both a completed Paddle transaction and its durable `payment:<transactionId>` ledger grant; only then are success and refreshed entitlements shown. Verification polls are bounded and can be retried without paying again.

The customer schema additions are optional. No balance migration is needed for those fields. The separate credit-ledger migration, one-time Free signup policy, historical payment markers, and rollback/deployment ordering are documented in [credit-management.md](credit-management.md). Existing accounts are never reset or automatically topped up; new Free accounts receive 30 once, Pro 50/month and Business 200/month.

## Environment and Paddle dashboard

| Variable                                          | Required configuration                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `PADDLE_ENV`                                      | `sandbox` or `production`, explicitly validated.                                                                                                |
| `PADDLE_API_KEY`                                  | Server-only credential for that environment.                                                                                                    |
| `PADDLE_WEBHOOK_SECRET`                           | Server-only signing secret for that destination/environment.                                                                                    |
| `PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_BUSINESS` | Real active monthly subscription prices. Existing mappings/aliases remain.                                                                      |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`                 | Paddle client-side token: `test_` for sandbox, `live_` for production. Never an API key or price ID. Rebuild after changes.                     |
| `NEXT_PUBLIC_PADDLE_ENV`                          | Optional explicit public environment; when set it must match the client token and backend. Set explicitly per deployment for clarity.           |
| `PADDLE_PRICE_ID_CREDITS_25`, `_50`, `_100`       | Real active one-time prices for credit packs; these are currently unset locally.                                                                |
| `BILLING_CREDIT_PACKS_JSON`                       | Optional replacement catalogue of `{ id, credits, priceId }`; do not change allocation mappings while related payments/webhooks remain pending. |
| `BILLING_CREDITS_V2`                              | Enable only after the safe ledger migration; required for pack admission.                                                                       |
| `MONGO_URI`                                       | Application Mongo replica set/sharded cluster with required indexes and transaction support.                                                    |
| `BILLING_TEST_MONGO_URI`                          | Dedicated test replica set, never production. Required for the skipped Mongo tests.                                                             |

Before production:

1. Configure the real app domain/default payment link in the matching Paddle account and complete applicable live-domain approval. Keep the billing route able to load Paddle.js and handle transaction links. Confirm the exact deployed client token and backend environment; a local sandbox success does not validate live settings.
2. Create/configure real one-time pack products and prices. No price amount or product ID was invented, and no Paddle catalogue was changed. Unconfigured packs remain disabled. Verify their real checkout before enabling them.
3. Configure a publicly reachable signed webhook destination at the backend's `/billing/paddle/webhook` route (including any deployed API prefix). Subscribe to `transaction.completed`, subscription lifecycle events, `adjustment.created`, and `adjustment.updated`. Preserve raw request bytes for signature validation.
4. Check deployed CSP/content blockers allow Paddle's official SDK, checkout frame and required network resources. The current local browser successfully loaded them; deployed policy was not inspected behind authentication.
5. Rehearse the ledger migration/backups as documented, deploy API/workers consistently, and rebuild the frontend with matching public variables.
6. Complete an authenticated sandbox subscription and pack payment against the real backend/webhook/database. Confirm plan, wallet and history refresh; redeliver the signed completion event and confirm no duplicate allocation. Exercise cancellation, declined payment, refresh during checkout and refund before switching to live credentials.

Official integration references: [Paddle.js initialization](https://developer.paddle.com/paddle-js/about/include-paddlejs/), [explicit checkout open](https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/), [transaction checkout](https://developer.paddle.com/build/transactions/pass-transaction-checkout/), [default payment link](https://developer.paddle.com/build/transactions/default-payment-link/), and [sandbox testing](https://developer.paddle.com/sdks/sandbox/).

## Verification results

- Real Paddle Pro sandbox overlay and user-completed test purchase: passed; backend confirms transaction completed.
- Real Business sandbox overlay, dark theme and close/cancel behavior: passed. No Business payment submitted.
- Browser layouts at 1440×1000, 768×1024 and 390×844: no page-level horizontal overflow. Light/dark rendering, shared product filter, pagination and mobile credit-help dialog checked. History's wide table scrolls within its container. Local fixture has no SSR hydration path; the actual app production build covers the client/server compilation boundary.
- Billing UI tests: 17 passed, including missing/mismatched environment, SDK failure/timeout retry, explicit subscription/pack overlay, retained existing balance, Free renewal suppression, shared filters/pagination, search-param duplicate-open prevention and verified-only success.
- Backend billing/recovery suite: **124 passed, 3 Mongo tests skipped**. The dedicated Mongo replica-set URI was not configured. The final focused credit-purchase suite passed **17/17**, including the subsequently added regression allowing a canceled subscriber to start a new checkout without reopening its completed payment.
- App production `npm run build`: passed, including TypeScript and page generation. Initial sandbox build could not fetch the existing Google Fonts and exposed a missing billing client boundary; boundary fixed, network-enabled build passed.
- Backend production build: passed.
- App and backend `npm run typecheck`: passed after the final checkout changes.
- Changed billing frontend ESLint: passed. Prior broader app-shell checks had two unrelated Studio toolbar/viewport assertion failures; backend lint has the existing unsafe-any/mock backlog described in the credit-management report.

No production deployment, application database migration, live charge, or live refund was performed. A real pack purchase, real Mongo concurrency tests and signed-webhook-to-wallet browser round trip remain unverified because the required configuration/database session was not available.
