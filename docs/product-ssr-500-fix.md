# App and Studio SSR session context failure

## Cause and evidence

`ProductSessionBoundary` reads `current.status` after calling `useSession()`.
pnpm resolved different physical `next-auth/react` modules for the application
providers and `packages/auth` because their Next.js/React peer dependency
variants differ. Each module creates its own `SessionContext`. Consequently the
shared boundary received no context despite a provider in the root layout.
Auth.js only reports its missing-provider error outside production; in
production `useSession()` returns undefined and the boundary throws on `.status`.

An authenticated request to the unmodified Studio production build reproduced
HTTP 500 with both a healthy and disconnected synthetic backend. The local
production stack was `_1nawmw6._.js:1:6256`, digest `2002887705`. Its source map
identifies `packages/auth/src/session-expired.tsx`, `ProductSessionBoundary`.
The bundle also shows separate Auth.js module IDs for Studio's `ProtectedStudio`
and the shared boundary. App independently resolves a different Auth.js module
from `packages/auth` as well. Both applications pass authenticated HTTP SSR
regressions after using the shared entry point.

The reported deployed chunk `packages_199sfgh._.js:1:5206`, digest `3346774654`,
was not available locally. No deployed source map or Vercel project credentials
were available, so that exact deployed offset has not been verified. The stack
above comes from a real local production build, not the development renderer.
The reproduced failure does not require an EC2 outage; an outage may expose the
route, but it is not necessary to cause this context failure.

## Changes

- `packages/auth/src/react.ts` and its package export provide one Auth.js client
  module for App and Studio providers, hooks, sign-in and sign-out. The App and
  Studio client consumers now import this entry point. Shared `client.ts` and
  `session-expired.tsx` use the same module.
- `packages/auth/src/session-read.ts` distinguishes an explicit null session
  from network, timeout, malformed response and HTTP failures. Auth.js's normal
  `getSession()` swallows fetch errors into null; App's token resolver now uses
  the strict reader. The expiration dialog confirms session loss before
  expiring. Studio's redundant expiration watcher was removed, leaving the
  shared boundary to perform that confirmation.
- `packages/api-client/src/index.ts` normalizes malformed HTTP error envelopes
  (including gateway HTML) and arbitrary rejection values without throwing
  another TypeError. Network/non-401 HTTP failures do not expire or refresh a
  session. Existing 401 refresh and confirmed expiration behavior remain.
- Root scripts expose `test:product-ssr` and include strict session-reader tests
  in `test:session-expiration`.

The encrypted per-product cookies, backend revocation validation, centralized
SSO, OAuth state, PKCE S256, callback checks and existing UI remain in place.
Server session validation retains credentials during consumer identity outages,
sets `authError: service_unavailable`, and removes stale bearer access tokens.
Studio's server API/session guards return 503 during that condition.

## Validation

Passed:

```sh
pnpm --filter @blynta/app build
pnpm --filter @blynta/studio build
node --test scripts/tests/product-ssr.test.mjs scripts/tests/session-expiration.test.mjs scripts/tests/identity-client.test.mjs scripts/tests/product-session-read.test.mjs
pnpm --filter @blynta/auth typecheck
pnpm --filter @blynta/api-client typecheck
pnpm --filter @blynta/auth lint
pnpm --filter @blynta/api-client lint
```

The 41 tests include real `next start` HTTP requests with synthetic encrypted
product cookies for both applications: healthy identity service, disconnected
backend, HTTP 403/429/500/502/503, and confirmed 401 revocation. Outages retain
the user session without an access token, produce HTTP 200 protected SSR, and
do not redirect to sign-in. Confirmed revocation still redirects. Unit tests
cover invalid upstream payloads, session-endpoint failures, retry/expiration
semantics and safe identity error classification.

The installed pnpm 11 attempted automatic dependency reinstall before scripts;
validation used `pnpm_config_verify_deps_before_run=false` to run against the
existing installed workspace. App initially failed to download its unchanged
Google Fonts under the network sandbox; its build passed with network access.
Studio used `MAIN_APP_URL=https://app.blynta.com` for its required build setting.

## Deployment

Redeploy App and Studio from the fix commit. Auth and Admin also import the
changed shared packages (including the API error normalizer), so rebuild and
redeploy those projects as well. Web and the backend do not consume these
packages and do not require deployment for this fix.

Do not apply the repository's draft six-service Vercel configuration as a
production migration: `docs/vercel-services.md` explicitly says it has not been
deployed. Preserve the existing projects and environment/callback mappings.
No `.vercel/project.json` links were present for App or Studio, and Vercel CLI
62.2.0 `whoami` reported logged out. Deployment and retrieval of actual deployed
server bundles are blocked until the existing Vercel account/project access is
available. A Git push may trigger configured Git deployments, but that is not
evidence of a successful production rollout. Verify production deployment
status, protected routes, revocation and backend-outage behavior after rollout.
