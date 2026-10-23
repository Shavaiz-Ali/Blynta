# Credit Management cleanup and plans API deployment

## Current outcome

The UI cleanup and local verification are complete. **The production 404 is not resolved yet: the newer backend has not been deployed.** A trusted production connection is required to finish that step.

On 23 October 2026 at 15:03 PKT (10:03 UTC), read-only requests to `https://13-234-63-132.sslip.io` returned:

| Request                        | Result                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                  | 200; running revision `cf58e7965c77a8915ba3a1413047cae7901714f7`, built 22 October 2026 at 16:25 UTC, source clean |
| `GET /billing/plans`           | 404, `Cannot GET /billing/plans`                                                                                   |
| `GET /billing/checkout-config` | 401, `Unauthorized`                                                                                                |

The old `cf58e79` controller has checkout-config and credit-packs but no plans route. The already-pushed `1404039c8657653a5e2240fe59ac55350e168947` includes `@Get('plans')` in `@Controller('billing')`, delegation to `BillingService.listPlans()`, and BillingController registration in BillingModule. AppModule imports BillingModule. There is no global API prefix in `main.ts`. The frontend billing endpoint is `/billing/plans`; the shared API client uses the configured backend origin and unwraps the standard response envelope. The source API contract already agrees.

This is a stale backend deployment, not a missing controller or a reason to change the client to `/api/billing/plans`. Production health identifies the older running artifact; an existing neighboring billing route reaches authentication correctly. Remote Nginx/PM2 configuration has not been independently inspected: direct SSH using strict host-key verification stopped because this machine has no trusted host key for the IP. No host-key check was bypassed, remote service restarted, or production environment changed.

The old local `backend/dist` was stale too. Rebuilding it now produces the intended controller route. The new `test:billing:routes:compiled` script traverses compiled AppModule imports and verifies BillingModule/controller registration and GET metadata for plans, credit-packs and checkout-config. It explicitly does not certify a running deployment.

## UI changes

- Removed the visible Credit purchases subheading and the long introductory payment paragraph. Credit Management remains the single section heading above the unchanged shared tabs.
- Existing cards now read `25 Credits`, `One-time purchase`, real formatted price, `Buy Credits`. Unavailable packs show one muted `Unavailable` line and a disabled button. Each button retains a credit-specific accessible label. No fake prices or product configuration were added.
- Removed the history toolbar explanation and table footer paragraph. History now flows directly from filters to unchanged AppTable rows to unchanged pagination.
- Moved holds/releases, Recorded status and payment/renewal explanations into existing How credits work help content. Removed the repeated payment paragraph at the bottom of Billing.
- Failed plan loading shows a small inline muted state with a contextual query retry. Stale catalog prices are hidden and upgrades disabled when the catalog query reports an error.

Activity, shared AppTable/row/pagination, shared tabs, subscription card classes, checkout integration and credit accounting are unchanged.

## Deployment steps

Use the existing trusted SSH/SSM deployment connection and its existing checkout/release procedure. The backend must contain **at least `1404039`**; restarting `cf58e79` alone cannot add the route. Once connected:

1. Identify the API process and checkout using the existing safe diagnostic: `node backend/scripts/inspect-ai-deployment.cjs` from the repository root. It reports filtered PM2 paths/build identity and Nginx upstreams without printing environment secrets. Confirm that the API process uses the checkout being updated. The repository's canonical configuration names it `blynta-api` with `backend/dist/src/main.js`.
2. In that clean deployment checkout, fetch and fast-forward the intended branch to the reviewed release containing the endpoint. Preserve `.env`; do not reset a dirty checkout or overwrite host-specific settings.
3. From its `backend` directory, install/build and verify the compiled route before restarting:

```sh
npm ci
npm run build
node -e 'require("reflect-metadata"); const assert = require("node:assert/strict"); const { BillingController } = require("./dist/src/billing/billing.controller.js"); const { PATH_METADATA, METHOD_METADATA } = require("@nestjs/common/constants"); const { RequestMethod } = require("@nestjs/common"); assert.equal(Reflect.getMetadata(PATH_METADATA, BillingController), "billing"); assert.equal(Reflect.getMetadata(PATH_METADATA, BillingController.prototype.plans), "plans"); assert.equal(Reflect.getMetadata(METHOD_METADATA, BillingController.prototype.plans), RequestMethod.GET); console.log("Built GET /billing/plans verified");'
```

The fuller `npm run test:billing:routes:compiled` check is available once this follow-up's script/package change is included in the deployed release. The inline check above also works with the already-pushed `1404039` release.

4. Restart the confirmed API process using the existing deployment lock/release procedure. For the canonical PM2 name, the command is `pm2 restart blynta-api`. Do not restart unrelated workers to add this API route. No Nginx path rewrite, new global prefix or database migration is required by the route change.
5. Verify the **running** release and route through the public upstream:

```sh
curl --fail --silent --show-error https://13-234-63-132.sslip.io/health
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://13-234-63-132.sslip.io/billing/plans
```

Health must report the deployed revision; the unauthenticated plans request must return **401**, not 404. If it remains 404, inspect the filtered process cwd/script, active listener and proxy upstream before another restart. The route check must run against the artifact loaded by that listener.

6. With a valid existing consumer session, reload Billing and verify its authenticated `GET /billing/plans` returns **200** with `{ success: true, data: [...] }`. Alternatively, provide an existing access token to a read-only HTTP client via its secure environment/input facility; never print or commit it. Validate actual prices/availability and then open/close the Pro and Business checkout overlays. This authorized production response has not yet been obtained here.

## Authoritative catalog and checkout verification

The existing plans response contains stable plan IDs, configured credit allocations, availability, amount in minor units and currency. Labels are presentation metadata. Paid prices come from actual active monthly Paddle mappings; unavailable mappings fail closed. Credit packs retain their existing separate endpoint. Sensitive Paddle credentials stay on the backend. No duplicate plans endpoint or frontend catalog workaround was added.

The freshly compiled BillingService was exercised read-only against the configured sandbox Paddle account:

| Plan     |     Credits | Price          | Availability          |
| -------- | ----------: | -------------- | --------------------- |
| Free     | 30 one-time | USD 0          | Enabled               |
| Pro      |          50 | USD 12 monthly | Active Paddle mapping |
| Business |         200 | USD 39 monthly | Active Paddle mapping |

Both real sandbox overlays opened through the existing frontend mutation/SDK path with the correct Pro/Business order summaries. A synthetic verification customer and unpaid checkout transactions were used. Both overlays were closed without payment. The isolated wallet remained a fixture; this does not establish production Mongo/webhook delivery. The preview script accepts `BILLING_PREVIEW_EMAIL` to avoid reusing an archived fixture customer; production code is unaffected.

Local one-time pack IDs are unset and `BILLING_CREDITS_V2` is not enabled in the local backend environment. Actual service catalog results therefore correctly disable packs. Real pack checkout cannot be certified until valid one-time Paddle price IDs and the ledger environment are configured. Neither configuration was changed automatically. The existing pack mutation and verified-webhook/ledger behavior remain covered by regression tests; no new grants occur merely from catalog loading, checkout creation or failure.

## Files and checks

| Files                                                              | Purpose                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `apps/app/features/billing/components/CreditPacks.tsx`             | Concise pack hierarchy and fail-closed unavailable state                                                |
| `apps/app/features/billing/components/CreditHistory.tsx`           | Remove explanatory copy/footer; retain filters, rows and pagination                                     |
| `apps/app/features/billing/components/HowCreditsWork.tsx`          | Consolidate explanations in existing help                                                               |
| `apps/app/features/billing/components/BillingPage.tsx`             | Compact catalog retry, stale-data checkout protection, remove duplicate footer payment text             |
| `apps/app/scripts/preview-billing.cjs`                             | Optional synthetic verification email                                                                   |
| `scripts/tests/billing-ui.test.mjs`                                | Updated content assertions and failed-catalog/stale-price/retry regression                              |
| `backend/src/billing/billing-plans-http.spec.ts`                   | Real JWT guard/strategy with isolated user/session fixtures; 401 vs authenticated 200/envelope contract |
| `backend/scripts/check-billing-routes.cjs`, `backend/package.json` | Built-artifact route registration check and command                                                     |
| This document                                                      | Root cause, evidence, deployment runbook and remaining verification                                     |

Results: **25/25 frontend tests**, **25/25 focused backend tests**, Main App/backend TypeScript, targeted frontend/new-backend-test lint, Main App production build, backend build and compiled billing-route check pass. The HTTP tests require localhost networking; their first sandbox run was blocked by local socket permissions, and the network-enabled rerun passed. Shared UI and Activity source diffs are empty. Browser screenshots in ignored `.test-results/` include `billing-clean-packs.jpg`, `billing-clean-history.jpg`, `billing-clean-history-dark.jpg`, and both checkout order summaries. Production route evidence and the real sandbox service catalog are saved as JSON there as well.

Still required: trusted deployment access, rebuilding/restarting the production API at the newer revision, authenticated production catalog verification, and configured credit packs plus a deployed verified-payment-to-ledger check. **Do not treat these local results as a fixed production 404.**
