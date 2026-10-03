# Phase 1: centralized authentication

## Trace of the implementation before Phase 1 changes

The repository has three relying products and one identity frontend. No folder restructuring is required.

| Product | Client ID       | Origin setting   | Default destination | Integration files                                                                                                                                                                                        |
| ------- | --------------- | ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main    | `blynta-main`   | `MAIN_APP_URL`   | `/dashboard`        | `apps/app/auth.ts`, `apps/app/proxy.ts`, `apps/app/app/(auth)/login/page.tsx`, `apps/app/app/auth/start/route.ts`, `apps/app/app/auth/callback/route.ts`, `apps/app/app/api/auth/[...nextauth]/route.ts` |
| Studio  | `blynta-studio` | `STUDIO_APP_URL` | `/dashboard`        | Equivalent files under `apps/studio`                                                                                                                                                                     |
| Admin   | `blynta-admin`  | `ADMIN_APP_URL`  | `/`                 | Equivalent files under `apps/admin`; `apps/admin/app/(main)/layout.tsx` additionally gates administrator access                                                                                          |

1. The product proxy reads its local Auth.js session. An unauthenticated protected request redirects to product `/login?callbackUrl=<relative original destination>`.
2. The product login page redirects to `/auth/start` when central authentication is enabled.
3. `packages/auth/src/server.ts:startAuthorization` generates random state and a PKCE verifier, stores a ten-minute transaction cookie, and redirects to central `/authorize` with the client ID, exact callback, state and S256 challenge.
4. `apps/auth/app/authorize/route.ts` reads central Auth.js identity. Without identity it stores a pending authorization cookie and redirects to central `/login` or `/signup`.
5. `apps/auth/features/auth/components/LoginForm.tsx` submits to the central credentials provider in `apps/auth/auth.ts`. That provider calls Nest `POST /auth/sso/login` through `packages/auth/src/identity-client.ts`. Nest validates the existing user/password and creates a Redis identity session. Google/Facebook providers also live in `apps/auth/auth.ts`; their verified upstream identity is sent through the protected backend social bridge and converted into an identity session.
6. Login uses browser navigation to `/continue`. `apps/auth/app/continue/route.ts` resumes `/authorize`, or starts a Main transaction for standalone login.
7. Central `/authorize` calls `backend/src/auth/sso.controller.ts` and `sso.service.ts`. Nest validates the explicit client/callback registry and creates a 60-second random, hashed, PKCE-bound authorization code associated with the central identity and user.
8. Central redirects with code and state to the product callback. `finishAuthorization` validates the product transaction before calling the shared `blynta` Auth.js provider.
9. The product server exchanges code + verifier with Nest `/auth/sso/token`. Redis compare-and-delete allows only one successful exchange. Nest returns a child product session linked to the identity root and a five-minute API JWT.
10. Product Auth.js encrypts the opaque session credential into its host-only cookie and redirects to the validated original relative destination. Public session JSON contains user information and the short-lived API JWT, never the opaque credential.
11. Session reads consult Nest `/auth/sso/session`; API requests validate the JWT session hash and current user state. Backend `AdminGuard` remains authoritative.

The three products follow this same flow; their IDs, origins, callback routes and default destinations differ. Client ID `blynta-main` is retained to avoid changing the working registry merely to rename it `blynta-app`.

## Gaps found before changes

- Product transaction cookies contained plain JSON rather than authenticated encryption.
- Central authorization requests were validated by the backend only after login.
- Recovery and OTP updates used `undefined` to clear stored fields and did not atomically guard concurrent consumption.
- Old `/forgot-password?token=...` links reached a request-link screen rather than the reset form.
- Product legacy configuration was imported even when central auth was enabled.
- Provider button discovery queried the backend without intersecting centrally configured OAuth credentials.
- Coverage did not include the complete recovery, callback-state and missing-verifier matrix.

## Scope

Only authentication, its tests, environment examples and this report are in scope. UI/theme/types deduplication, product business logic, repository structure and backend package manager are unchanged.

## Final ownership and flow

The traced flow is retained. Product transactions are now Auth.js-encrypted JWE cookies, and central `/authorize` validates the registered request through Nest `/auth/sso/validate-request` before storing a pending request or showing login. Invalid clients/callbacks never produce a product redirect. Upstream service failures produce a service failure rather than an invalid-password message.

- **Auth app:** password and social sign-in; signup and OTP UI; standalone `/verify-email`; forgot/reset screens; `/authorize`; `/continue`; explicit `/logout`; provider discovery that intersects backend enabled providers with central private credentials. Signup resumes the original authorization after verification and credential login. Standalone login starts a Main transaction.
- **Auth package:** server-only handoff/session integration, state/PKCE creation, encrypted transaction storage and validation, code exchange, safe return paths, identity-service transport, shared Auth.js session/revocation callbacks. It contains no embedded application secrets, product UI or Admin authorization rules. `createProductAuth`, `startAuthorization`, `finishAuthorization`, `safeReturnTo`, `configuredUrl` and `sessionCallbacks` remain the APIs; no cosmetic renaming was needed.
- **Products:** unique client/origin configuration, redirect-only entry pages while central auth is enabled, start/callback routes, Auth.js handlers, session providers/readers, protected routes and logout. Product `/api/auth/providers` exposes only `blynta`, the code-exchange provider. Studio's legacy account-auth proxy returns 404 in central mode.
- **Backend:** existing users/passwords/provider linking, signup/verification/recovery, trusted social bridge, Redis identity/product sessions, grant issuance/exchange/revocation, JWT validation and trusted Admin authorization. Nest remains independent and uses npm.

## Authorization code, PKCE, state and redirect guarantees

Codes contain 32 cryptographically random bytes (43 base64url characters). Only SHA-256 code hashes are Redis keys. Records expire after 60 seconds and bind the client ID, exact callback, user, central identity root, S256 challenge and state. Exchange validates the verifier and all bindings, then compares/deletes the exact Redis record atomically with Lua. Concurrent exchange produces at most one success; replay and expired codes fail. Child sessions cannot outlive the root.

Product state and verifier each contain 32 random bytes. The verifier stays inside a ten-minute encrypted HttpOnly product transaction cookie. Only its SHA-256 challenge travels to Auth. Callback state is compared with `timingSafeEqual` after authenticated cookie decryption and transaction-expiry/client validation. The verifier is posted server-to-server to Nest. Missing/wrong state, tampered cookies, missing/wrong verifier and replay fail.

`SSO_CLIENTS` is an explicit client-to-callback registry. Matching uses exact array inclusion, never prefixes or wildcards. Production callbacks require HTTPS, without userinfo, query or fragment. Local HTTP is allowed only for explicit localhost/127.0.0.1 development callbacks. App origin settings likewise reject non-origin URLs. Client `blynta-main` is retained consistently across code and registry.

Original product destinations stay inside the encrypted product transaction, rather than becoming trusted central query parameters. `safeReturnTo` accepts relative paths and rejects external, protocol-relative, backslash/control-character and encoded redirect forms. Main/Studio default to `/dashboard`; Admin defaults to `/`.

Auth.js supplies credential/OAuth CSRF protections; product callback state and PKCE protect the SSO handoff. CORS is a separate browser access policy, not CSRF protection. Server-action logout and Auth.js POST signout are used; GET logout renders a confirmation form without revoking identity.

## Cookie/session inventory

All custom cookies have **no Domain attribute**, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Development HTTP cookies omit Secure. Production names use `__Host-`; deletions explicitly retain Secure/Path so browsers accept them.

| Cookie basename                  | Purpose                                                                | Lifetime/rotation                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `blynta-identity-session`        | Central Auth.js encrypted identity credential                          | Auth.js maximum age seven days; encrypted cookie may be reissued, but Redis absolute root expiry is not extended |
| `blynta-blynta-main-session`     | Main encrypted product credential                                      | Same cookie maximum age; backend child expiry is capped at root expiry                                           |
| `blynta-blynta-studio-session`   | Studio encrypted product credential                                    | Same                                                                                                             |
| `blynta-blynta-admin-session`    | Admin encrypted product credential                                     | Same                                                                                                             |
| `blynta-<client-id>-transaction` | Encrypted state/verifier/client/callback/original destination          | Ten minutes; new authentication replaces it; successful exchange clears it                                       |
| `blynta-authorization`           | Central pending validated request across password/signup/OAuth screens | Ten minutes; successful authorization clears it; no password/verifier/session credential inside                  |

Auth.js additionally manages its host-scoped CSRF, callback-url, OAuth state and PKCE cookies. Their names/options follow the installed Auth.js defaults; CSRF uses its production host prefix and OAuth state/PKCE artifacts have short library-controlled lifetimes. They are distinct from the product authorization transaction. No `.blynta.com` domain session cookie was introduced.

| Auth.js auxiliary cookie    | Production name                      | Purpose/lifetime                                                |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `authjs.csrf-token`         | `__Host-authjs.csrf-token`           | POST CSRF double-submit protection; browser-session cookie      |
| `authjs.callback-url`       | `__Secure-authjs.callback-url`       | Same-origin Auth.js continuation target; browser-session cookie |
| `authjs.state`              | `__Secure-authjs.state`              | OAuth state; fifteen minutes, consumed at callback              |
| `authjs.pkce.code_verifier` | `__Secure-authjs.pkce.code_verifier` | Google upstream PKCE; fifteen minutes, consumed at callback     |

These installed-library defaults also omit Domain and use Path=/, HttpOnly, SameSite=Lax and production Secure. Products use the custom encrypted session cookie instead of the default `authjs.session-token`. Nonce/WebAuthn defaults exist in Auth.js but these flows do not enable WebAuthn or explicitly request an upstream nonce check.

Redis identity/product credentials are 32 random bytes; only their hashes are stored as keys. Opaque credentials live in encrypted HttpOnly Auth.js cookies and server-to-server request bodies, not public session JSON. Session records have a seven-day absolute expiry. Every session read checks the backend, current user activity and linked root revocation. Access tokens are five-minute signed JWTs containing a session hash; API validation checks that session and current database role/activity.

There is **no separate Blynta refresh token**. The opaque server credential renews the short-lived API JWT on session reads; it does not extend root lifetime. Provider access/refresh tokens are not copied into product sessions or redirect URLs. Authorization code/state alone are allowed in SSO callback URLs. Password reset links carry a separate single-use recovery token; compatibility preserves that existing format.

Backend JWT validation now rejects tokens without a session hash by default. `ALLOW_LEGACY_AUTH_TOKENS=true` is an explicit temporary rollout escape hatch; such old tokens cannot receive central logout/revocation guarantees. Local setup sets it false. The existing login/social/verification compatibility endpoints still issue their legacy token shape; enabling that escape hatch is therefore a deliberate weaker migration mode, not the production recommendation.

## OAuth and account identity

Google/Facebook providers are configured only in central Auth when central mode is enabled. Auth.js handles upstream exchanges; Google uses PKCE/state and verified-email checks, Facebook uses state. Protected backend social endpoints require the private bridge secret. Existing provider-ID lookup takes precedence; otherwise an existing email is linked instead of creating a second account. Unit checks cover both providers' existing-user linking and prior-provider identity precedence.

Missing central private provider credentials are filled from Main's existing ignored private environment by local setup; valid central values are preserved. No real credential values were added to tracked files. Provider tokens are not persisted as Blynta refresh tokens. Facebook must return an email compatible with the backend DTO; a missing email fails rather than fabricating an identity.

### Manual provider dashboard settings

| Provider | Development callback                               | Production callback                                  |
| -------- | -------------------------------------------------- | ---------------------------------------------------- |
| Google   | `http://localhost:3003/api/auth/callback/google`   | `https://auth.blynta.com/api/auth/callback/google`   |
| Facebook | `http://localhost:3003/api/auth/callback/facebook` | `https://auth.blynta.com/api/auth/callback/facebook` |

These are upstream provider callbacks, distinct from product `/auth/callback` URLs. Google requires the requested redirect URI to match its authorized configuration ([Google web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server)). Configure central Auth's origin in the provider dashboard and any development test-user restrictions. In Facebook, configure its login callback allowlist and email permission; development availability remains subject to the provider dashboard's permitted settings. Preserve old callbacks until the legacy rollout is retired. No provider dashboard was modified automatically.

## Password recovery and verification

New reset mail uses `AUTH_APP_URL` and `/reset-password?token=...`. Original backend mail used `FRONTEND_URL/reset-password?token=...`; Main now retains that redirect-only compatibility route. Main/Studio forgot-password token links are also preserved: central `/forgot-password?token=...` redirects to the reset screen. Studio's existing reset route redirects centrally.

Reset tokens remain bcrypt-hashed in the existing MongoDB fields, expire after one hour, and require atomic compare-and-update against the same hash and unexpired timestamp. Password replacement and `$unset` consumption happen together. Concurrent requests have one winner; already-issued bcrypt reset links remain valid until their existing expiry. Reset revokes identity/product Redis sessions for the user. No user-schema/password-hash migration occurred. The legacy bcrypt reset-token lookup remains a bounded-by-live-artifacts scan and is a future performance consideration, not silently rewritten here.

OTP codes remain bcrypt-hashed with ten-minute expiry. Correct verification atomically sets verified status and unsets the matched code/expiry. Wrong, expired and replayed codes fail. Signup OTP and standalone central `/verify-email` consume backend verification. Reset responses do not reveal whether an email exists. Tests capture mail only in an isolated fixture; real delivery still requires the configured mail worker/provider.

## Admin and logout behavior

Admin's product session does not grant an Admin role. Its layout checks trusted session role, and the backend checks the current user plus `AdminGuard`. Normal users authenticate successfully and are denied Admin; an admin fixture is allowed. Roles in client data or stale JWT fields are not authoritative.

All current Auth.js signout actions in Main, Studio, Admin and Auth use **global logout for that central identity root**. The initiating cookie is cleared and the backend root is revoked. Sibling cookies may physically remain until their next read, but their sessions and issued API JWTs immediately fail root/session checks. Independent browser/device identity roots are not revoked by this action. Password reset revokes all roots for the user. Backend supports product-only revocation, but no separate product-only UI action was introduced.

## Rate limits, CORS and environment

Redis atomic counters expire after 60 seconds. Current IP/path limits are 30 for account endpoints, 300 for provider discovery, 600 for SSO endpoints and 3000 for SSO session reads. Endpoints containing an email also have ten account/path attempts per minute. Signup, login, recovery, reset, verification/resend, social bridge and code exchange controllers are guarded. Provider callback work upstream remains under Auth.js state/PKCE and provider controls; backend identity/social exchanges are rate limited. Production ingress IP/proxy behavior and shared Auth-server traffic require deployment load verification; arbitrary forwarded-IP headers were not trusted automatically.

Backend CORS uses explicit configured origins, rejects wildcards/non-origin URLs, and now allows HTTP only for localhost development; production requires HTTPS. Credentials remain enabled with exact origins only. Include Auth for browser signup/recovery and product origins with direct browser API clients; add Studio/Web only when their actual browser calls require it. Server-to-server handoff does not require a browser CORS grant.

Examples enable central product auth. Configure each app's own `AUTH_URL`/unique `AUTH_SECRET`, central/product origin variables and server `BACKEND_URL`; public API base URLs contain no secrets. Backend and Auth alone share `SSO_BRIDGE_SECRET`; upstream OAuth secrets stay in Auth. Local setup is idempotent, preserves valid secrets and database/JWT configuration, enables the product handoff and rejects legacy unlinked JWTs. Production URLs must use HTTPS; backend identity transport rejects unsafe URLs and refuses upstream redirects that could forward credentials.

The current local review found reused Auth keys. Setup now preserves unique keys and replaces duplicates (including reuse of the bridge/backend JWT key) with independent random values. Four distinct app keys and byte-for-byte idempotence were verified. Product cookies encrypted with replaced keys require reestablishment through SSO. Production secrets must likewise be independent; no private values appear in this report.

## Legacy retention

No legacy implementation was deleted before the live-provider matrix was complete. Product `auth.ts` now dynamically imports legacy configuration only when central auth is disabled; enabled products do not initialize independent password/OAuth providers. Product login/signup/recovery compatibility URLs redirect centrally. Studio's legacy account proxy is disabled in central mode.

Remaining `legacy-auth.ts`, `features/legacy-*`, legacy-only forms/queries/provider variables and Studio's disabled account proxy are the post-verification removal candidates. Product Auth.js handlers/start/callback/protection remain necessary and must not be removed with them. Removal waits for actual provider consent/callback and deployed recovery-mail checks, followed by full rebuild. No Phase 2 UI/theme/types cleanup was started.

## Verification results and limits

Verification used synthetic accounts in an isolated Nest fixture and four actual Next development servers. No real account was changed or mail sent. The real Redis check used a unique temporary key namespace and removed its own keys afterward.

| Check                                                       | Result                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend SSO/recovery security tests                         | 26 passed across two suites, including code/session expiry, atomic concurrent exchange, replay, OTP/reset consumption, social account linking and legacy-token rejection         |
| Shared identity transport tests                             | 12 passed; unsafe URL/configuration, outage, malformed response and backend error classification covered                                                                         |
| Real configured Redis                                       | Passed atomic exchange/replay, expired-code rejection and linked-session revocation                                                                                              |
| Google and Facebook with configured development credentials | Sign-in initiation passed; correct central callback and upstream state observed; Google S256 PKCE observed. Actual consent and returned provider identity were not verified      |
| Local environment setup                                     | Four independent Auth keys verified; second run preserved files byte-for-byte                                                                                                    |
| Main, Studio, Admin and Auth production builds              | All four passed using direct Next build commands; direct execution with network access resolved the wrapper's Google Fonts download failure                                      |
| Backend build and TypeScript                                | `npm run build` and `npx tsc --noEmit` passed                                                                                                                                    |
| Auth/shared auth frontend lint                              | Passed, with five existing unused-variable warnings in central forms                                                                                                             |
| Changed backend auth lint                                   | Passed                                                                                                                                                                           |
| Full relevant frontend lint                                 | Five of seven tasks passed. Main retains 38 existing errors/35 warnings; Admin retains one existing hooks error/six warnings. These unrelated product issues were not suppressed |
| Full backend tests                                          | 113 passed, two failed across 18 suites: AppController's missing DatabaseConnection test provider and NotificationsService's read-status assertion                               |
| Authentication formatting                                   | Prettier passed for central Auth, shared auth, product auth entries, changed backend auth/recovery and integration scripts                                                       |
| Repository-wide formatting                                  | 39 files currently fail, including unrelated Studio/backend work. Phase 1 did not reformat those systems                                                                         |

Production builds and synthetic HTTP tests demonstrate application integration, not production-provider or email-delivery sign-off.

### Complete HTTP authentication matrix

Final `pnpm typecheck` passed all nine workspace tasks after the complete HTTP run. Six tasks were cached; the three changed product tasks ran successfully. Backend build/typecheck and all four authentication-related production builds also passed.

`node scripts/test-sso.mjs` passed against Main, Studio, Admin and Auth plus the isolated Nest backend. It verifies:

- Password login from Main and Studio; standalone central login continuing to Main; an existing central identity entering the other product without another credential prompt.
- Original Studio editor path and query preservation; external return URLs replaced by a safe fallback.
- Product routes exposing only the central code-exchange provider and protecting unauthenticated requests.
- Missing/wrong callback state, tampered encrypted transactions, missing/consumed transactions and manipulated callbacks rejected; Auth.js credential CSRF enforcement.
- Ordinary users denied by both Admin UI and backend AdminGuard; an administrator permitted by trusted backend data.
- Signup, one-time OTP verification, central session handoff, non-enumerating recovery responses, original Main reset links and forgot-password token compatibility, concurrent reset with one winner, replay rejection, new-password login and reset session revocation.
- Invalid registered callbacks rejected before login and with an existing identity; missing/wrong PKCE verifier rejected, correct verifier accepted and exchanged code replay rejected.
- Logout separately from Main, Studio, Admin and Auth revoking linked product sessions and already-issued API JWTs; protected products return to login; a revoked central cookie permits a fresh sign-in.

The harness received a null session after logout as expected; its assertion was corrected to accept that signed-out response. One rerun encountered stale Next development cache/lock metadata, and a subsequent clean run passed. Readiness now requires HTTP 200 rather than accepting a 404. Generated development types are cleaned after owned test servers exit to avoid partial Windows shutdown artifacts contaminating later builds. These were verification harness/cache issues, not evidence of a successful provider callback.

HTTP logs are in `.test-results/phase1-http-sso.log`; frontend/backend build, lint, formatting and test logs are alongside it. No production deployment was performed.

## Required review and deployment checks

1. Complete Google and Facebook consent/callback in a browser using permitted development accounts; confirm the existing account is reused and the requested product destination resumes. Dashboard callback settings are listed above. Provider initiation alone does not prove these steps.
2. Exercise actual signup OTP and reset email delivery through the deployed mail worker, including an already-issued legacy link. Fixture tests preserve the original link formats and hashes but do not test delivery infrastructure or existing production records.
3. Verify HTTPS cookie issuance/deletion, exact production `SSO_CLIENTS`/CORS origins, independent secrets, Redis availability and ingress IP/rate-limit behavior in the deployment. Keep `ALLOW_LEGACY_AUTH_TOKENS=false` for session revocation guarantees.
4. After those checks pass, remove obsolete product credential/OAuth implementations and their unused variables/imports, retain useful redirect-only compatibility routes, and rebuild. **No legacy implementation was deleted in Phase 1** because the live-provider/mail gate is still outstanding.
5. Resolve the existing general lint/test failures separately. Consider an indexed recovery-token lookup in a later compatible migration; this phase preserves existing bcrypt recovery artifacts.

The approved monorepo structure and backend npm workflow are retained. Stop here for Phase 1 review; no shared UI/theme/types cleanup follows automatically.
