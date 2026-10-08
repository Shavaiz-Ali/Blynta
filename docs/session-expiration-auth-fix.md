# Session expiration and centralized authentication

## Production diagnosis — 8 October 2026

Public checks reproduced the failure on both `https://blynta.vercel.app` and `https://studio-blynta.vercel.app`. Their `/auth/start` generates correctly shaped authorization-code/S256 requests (43-character state and challenge; callback on the matching product origin). Both central `/authorize` requests returned **503** with “Invalid authorization request”. The deployed source maps backend availability/configuration failures to 503; the message misleadingly labels them invalid requests. The exact backend URL/service-binding failure requires Vercel runtime logs/settings, which were not available. The custom `app.blynta.com` and `studio.blynta.com` origins did not resolve from this environment. No deployed settings changed.

The historical expired callback cannot be attributed conclusively without its request/cookie trace. Confirmed hazards were one transaction cookie per product and one central pending cookie (parallel attempts overwrite state/verifier), and cookies created on a visited alias while the configured callback uses another host. Ten-minute transaction expiration, 60-second code expiration, changed secrets, replay and cookie restrictions also correctly cause rejection. The implementation fixes overwrite/callback-host hazards without weakening validation.

Main's local environment additionally has active Vercel-origin overrides after localhost values, while Auth/Studio/backend use localhost. Ignored environment files were not changed. Remove conflicting active overrides when choosing a local environment.

## Changes

- Protected Main/Studio routes start `/auth/start` directly. A server-overwritten header preserves pathname/query, including nested routes. Existing product `/login` and `/signup` already redirect in central mode and remain compatibility entry points; legacy UI is retained only behind the existing rollout-disabled setting. Admin retains its intentional independent credentials boundary.
- Shared session state opens one blocking `@blynta/ui` dialog, without close/Escape/outside dismissal. The current page remains visible behind the modal. A display-session boundary preserves identity/query keys without authorizing APIs; transports block authenticated requests after expiration and backend guards remain authoritative. The first expiration records the return route. Repeated 401s/clicks do not produce extra dialogs/navigation. No save guarantee is claimed.
- Main's shared Axios transport shares token lookup/401 refresh, retries once at most, and signals confirmed expiration globally. Public auth endpoints opt out. Studio workspace/editor/save/session-check requests use the shared fetch boundary. Studio no longer signs out automatically on 401. A 403 does not expire authentication.
- Every `/auth/start` creates fresh cryptographic state/verifier/S256. Encrypted product transactions and encrypted central pending requests are keyed by state; four outstanding attempts are retained per client/host. Login/signup/social continuation carries the transaction identifier. Success consumes only its matching cookie. Start canonicalizes to the configured callback host before setting the cookie.
- Product and central errors show branded recovery. Retry starts a new product `/auth/start`; a still-valid old transaction may supply only a safe destination, never a reused authorization code/state/verifier. External/protocol-relative/backslash/control-character destinations and auth-route loops fall back safely.
- Consumer backend outages preserve the encrypted credential, withhold the API token, and show distinct service recovery. Confirmed 401/absolute expiry invalidates the session. Admin remains fail-closed. Failure-category logs do not contain credentials/codes/verifiers.
- Exact callback/client validation, timing-safe state comparison, encrypted cookie validation, expiry, one-time code exchange and S256 remain enforced. Access/session tokens never enter URLs. Cookies remain host-only, Path=/, HttpOnly, SameSite=Lax, Secure with production `__Host-` names. Public deployed start responses confirmed these flags. No shared Domain or insecure cookie workaround is used.

## Backend and deployment

**No production backend source/API change.** The only backend file changed is `backend/test/sso-fixture.ts`, adding loopback-only synthetic outage injection, never registered by AppModule. That test change requires no backend deployment.

The current production 503 still requires repairing Auth's reachable identity backend or `BACKEND_SERVICE_URL`/`BACKEND_URL` configuration. Browser API origins must point to the reachable public API. No new environment variable is introduced.

For the currently reachable separate Vercel deployments, use:

```dotenv
AUTH_APP_URL=https://auth-blynta.vercel.app
MAIN_APP_URL=https://blynta.vercel.app
STUDIO_APP_URL=https://studio-blynta.vercel.app
CENTRAL_AUTH_ENABLED=true
SSO_CLIENTS={"blynta-main":["https://blynta.vercel.app/auth/callback"],"blynta-studio":["https://studio-blynta.vercel.app/auth/callback"]}
```

Register `SSO_CLIENTS` on the backend. Enable central auth on Main/Studio. Separate projects use their own `AUTH_URL`; a shared multi-service deployment must not supply one common `AUTH_URL`. Keep the existing independent `BLYNTA_*_AUTH_SECRET` values stable and consistent within each app's server/proxy. Resolve/attach custom domains and change origins/registrations together before using custom-domain examples in `vercel-services.md`. Runtime settings were not changed.

## Validation and limits

Seven focused tests pass: five simultaneous 401s/single flight; blocked subsequent actions; one fresh sign-in action/nested return; 403 isolation; valid/refreshed tokens; bounded retry; safe returns; optional-client compatibility; and anonymous auth endpoints.

The isolated HTTP SSO suite completed successfully before the final outage/type refinements. A subsequent run passed parallel transactions, both SSO directions/nested returns, actual expired encrypted transaction, state/tamper/missing/replay/CSRF/PKCE checks, signup/recovery/reset, Admin separation/role removal, and the new 503 credential-preservation/recovery test. It timed out during later logout checks while concurrent local checks overloaded the environment. The final full suite is not claimed complete.

Shared auth/API/UI, Main/Auth/Admin type checks passed; Studio's final check passed after updating its own Auth.js augmentation. Scoped package and Auth/Studio lint passed before the final small compatibility/type edits. Formatting/whitespace are checked before commit.

The branded recovery page was inspected in a browser. A live expiration-overlay interaction was not completed because subsequent localhost navigation failed/timed out. Real OAuth consent and authenticated production callback behavior remain unverified.

## Changed files

- Shared auth: `packages/auth/package.json`, `src/server.ts`, `proxy.ts`, `client.ts`, `types.ts`, `return-to.ts`, `session-state.ts`, `session-fetch.ts`, `session-expired.tsx`.
- Shared transport/UI: `packages/api-client/src/index.ts`, `packages/ui/src/index.ts`, `packages/ui/src/components/AuthRecovery.tsx`, `pnpm-lock.yaml`.
- Main: protected dashboard/jobs/my-clips page authentication redirects; root page/protected layout; `config/axiosClient.ts`, `features/auth/user.api.ts`, `providers/AppProviders.tsx`, `app/auth/recover/page.tsx`.
- Studio: protected layout; Studio/workspace API routes; `features/auth/components/ProtectedStudio.tsx`, `features/auth/session.ts`, `features/studio/api.ts`, `features/studio/dashboard/workspace-api.ts`, `providers/QueryProvider.tsx`, `types/next-auth.d.ts`, `app/auth/recover/page.tsx`.
- Central Auth: login/signup transaction continuation, `app/authorize/route.ts`, `app/continue/route.ts`, `app/product-logout/route.ts`, `app/auth/recover/page.tsx`, `lib/authorization.ts`.
- Tests/report: `backend/test/sso-fixture.ts`, `scripts/test-sso.mjs`, `scripts/tests/session-expiration.test.mjs`, root `package.json`, this report.
