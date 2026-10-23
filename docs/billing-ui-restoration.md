# Original billing UI restoration

## Source and scope

Restored the actual `apps/app/features/billing/components/BillingPage.tsx` implementation from **`a6c85c4`**, the parent of `cf58e79`. This is a selective presentation restoration, not a commit/directory revert.

The original header/description, `PageContent` container, horizontal credit summary, three subscription cards, plan accents, pricing, badge placement, Upgrade button classes, responsive grid, and “One balance across Blynta” section are retained. The “How credits work” button remains in its original position. Required differences: Free reads **30 one-time credits**, has no next monthly allocation, and displayed available/reserved balances come from the existing wallet API (unavailable data shows a dash, not an invented balance). Pro remains 50/month at $12; Business remains 200/month at $39.

Purchases and history are accessible through small secondary links opening the existing shared dialog. Existing `#buy-credits` links also open it. History retains its shared selects, filters, table and pagination. A successful pack overlay load closes the secondary dialog so its modal focus trap does not obstruct Paddle.

## Files changed

- `apps/app/features/billing/components/BillingPage.tsx`: restored original presentation; wallet data, original Upgrade buttons, secondary credit dialog and compact retry action.
- `apps/app/features/billing/components/HowCreditsWork.tsx`: original rate-card padding/background/typography using shared card primitives; one-time/verified-renewal copy preserved.
- `apps/app/features/billing/components/CreditPacks.tsx`: optional callback to close the containing dialog once Paddle checkout opens; existing purchase logic retained.
- `apps/app/features/billing/components/PaddleProvider.tsx`: checkout failures use the existing toast system with a stable toast ID. No new integration, redirect or permanent error banner.
- `apps/app/scripts/preview-billing.cjs`: isolated Git-baseline and missing-token preview modes, plus the router fixture needed by the restored page. All generated output stays ignored under `.test-results/`.
- `scripts/tests/billing-ui.test.mjs`: restored layout/data expectations and secondary-dialog/Upgrade regression coverage.

**No backend, schema, migration, ledger, credit estimation, reservation, consumption, refund, purchase API, SSO, sidebar, theme, global layout or unrelated page was changed.** The existing 30-credit signup policy and verified/idempotent Paddle accounting remain intact.

Shared UI reused: `AppButton`, `AppCardRoot`/`AppCardContent` (the existing `AppCard` primitive exports), `AppBadge`, `AppSkeleton`, `AppDialog`; history continues using `AppSelect`, `AppPagination`, and shared `Table` primitives. Card defaults that would change the original spacing, clipping or inherited typography are overridden with the original classes. No duplicate wrapper, native select, custom pagination or new stylesheet was introduced.

## Paddle diagnosis and required deployment configuration

The previously reported `_ptxn` redirect depended on Paddle.js initializing on the destination. The preserved explicit-overlay implementation already avoids that redirect dependency. The new reported **missing `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`** error is raised before SDK initialization or transaction creation when the browser build contains no client-side token. Changing UI code cannot supply a genuinely absent deployment token.

Local inspection confirms a configured sandbox `test_` client token, sandbox backend environment, backend API credential, and subscription price IDs. Credential values were not printed, replaced or committed. The explicit public environment is optional locally and inferred/validated from the token plus backend environment. Vercel opened at its sign-in page, so the actual project environment values could not be inspected. The reported browser error establishes that the affected build lacked the token; it does not prove what is currently saved in Vercel settings or whether the deployment is stale.

For the Vercel project serving **blynta.vercel.app**:

1. Open **Project → Settings → Environment Variables**.
2. Set **`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`** to the actual active **client-side token** from Paddle **Developer Tools → Authentication → Client-side tokens** for the same account/environment as the backend. For sandbox use the existing intended `test_` token; for live use the intended `live_` token. Do not paste `PADDLE_API_KEY`, a webhook secret, or a price ID.
3. Set **`NEXT_PUBLIC_PADDLE_ENV`** to `sandbox` or `production` to match that token and the deployed backend's `PADDLE_ENV`, API credentials and price IDs. The current local backend uses sandbox; the deployed backend must be checked before selecting live values.
4. Apply the variables to **Production**, and to **Preview** if checkout is tested on preview deployments. A local ignored `.env.local` does not configure Vercel.
5. Open **Deployments**, select the latest intended app deployment and **Redeploy**, rebuilding after the variables have been saved. Do not promote an old artifact built without the token. Next.js embeds `NEXT_PUBLIC_*` at build time; changing runtime settings alone cannot repair that browser bundle.
6. Confirm the rebuilt app no longer reports the missing token; sign in, click the original Upgrade button, and verify the Paddle overlay uses the matching environment. Retain the existing approved checkout domain/default payment link and signed webhook configuration. Verify real webhook-to-wallet updates before live transactions.

References: [Vercel environment variables](https://vercel.com/docs/environment-variables), [Next.js public variables at build time](https://nextjs.org/docs/pages/guides/environment-variables), and [Paddle client-side tokens](https://developer.paddle.com/paddle-js/about/client-side-tokens/).

## Verification

- Billing UI regression tests: **18 passed**. Coverage includes real server-balance retention, Free renewal suppression, subscription/pack explicit opening, environment validation, retry/timeout, verified-only success, shared history filtering/pagination, and secondary dialog actions.
- App TypeScript, targeted ESLint on the four billing components, and production build (including page generation) passed. `git diff --check` passed. Backend tests/build were not repeated because no backend files changed.
- Git baseline preview uses the original page file fetched with `git show a6c85c4:...`, rather than a recreation. Browser comparison checks original card geometry, colors, borders, typography and responsive behavior with the same dependencies/theme tokens.
- At the same desktop viewport the plan cards matched the Git baseline in width (392px), height (360.1px), padding (24px), corner radius (16px), colors, borders, shadow and title font. Removing the old inline history removes its page scrollbar; normal auto-centering can consequently shift with scrollbar presence. No global scrollbar/layout changes were introduced.
- Browser checks passed at desktop 1440×1000, tablet 768×1024 and mobile 390×844 in light/dark themes, including the credit-help dialog and contained history-table scrolling. Shared product filtering and pagination reached page 2 successfully. No frontend runtime errors were logged in the configured preview.
- The **restored original Pro and Business buttons** each opened the real Paddle sandbox overlay, showing $12/month and $39/month. Both were closed without another payment submission; the fixture plan/balance remained unchanged. This checks the current button-to-SDK flow locally, not the deployed configuration.
- A separate missing-token preview reproduced the error as a toast, left Upgrade enabled after failure, showed no permanent page alert/banner and opened no payment iframe. No token was substituted. Credit packs remain disabled when their real prices are unconfigured, as before.
- The earlier user-completed Pro sandbox purchase remains documented in [billing-checkout-ui.md](billing-checkout-ui.md). It was a real Paddle sandbox transaction with a fixture wallet, not a production webhook/database verification. No additional payment submission is required to restore the presentation, and no new live payment was submitted.

This change does not set Vercel variables, redeploy production, change Paddle products/prices, or run a database migration. The deployed checkout cannot be claimed repaired until the missing public token is configured in a fresh build and checked while signed in.
