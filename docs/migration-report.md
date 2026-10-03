# Blynta architecture migration report

## 1. Final directory tree

```text
Blynta/
├── apps/
│   ├── web/       # Existing marketing application
│   ├── app/       # Existing main product
│   ├── studio/    # Existing Studio and editor
│   ├── admin/     # Existing Admin
│   └── auth/      # Central identity UI/server
├── packages/
│   ├── ui/        # @blynta/ui
│   ├── auth/      # @blynta/auth
│   ├── types/     # @blynta/types
│   └── api-client/# @blynta/api-client
├── backend/      # Existing independent Nest/npm project
├── scripts/test-sso.mjs
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
└── amplify.yml
```

## 2. Existing work preserved

The corrected migration reused the extracted main UI, central Auth application, shared PKCE/session helpers, backend authorization-code service and security tests. Existing app sources, public assets, local environment files, routes and configuration were carried forward as whole applications. Studio was initially untracked; its editor and existing work were preserved. No destructive Git reset, account migration or password rehash was performed.

## 3. Applications relocated

`frontend → apps/app`, `blynta-studio → apps/studio`, `admin → apps/admin`, `auth → apps/auth`, and the actual existing `landingpage → apps/web`. Marketing is a real application. Product features remain in their applications: jobs/billing/YouTube in Main, editor/timeline/preview/AI in Studio, and administration in Admin. Ports retain Studio 3002, with Main 3000, Admin 3001, Auth 3003 and marketing 3004.

## 4. Shared packages

`@blynta/ui` contains reusable design implementations. `@blynta/auth` exports server authentication helpers. `@blynta/types` contains small stable contracts: AuthUser, UserRole, ProductId and ApiEnvelope. `@blynta/api-client` is justified by repeated Axios infrastructure in Main, Admin and Auth: token resolution, envelope/error normalization and one bounded retry after a 401. Product endpoints remain local. A config package was omitted because existing app-specific Next/ESLint versions do not justify extra shared configuration.

## 5. Shared UI extraction

Existing Main implementations were extracted rather than redesigned: AppButton/AppLinkButton, AppInput, AppTextarea, AppCard and its sections, AppSelect, AppDialog, AppDropdown, AppPopover, AppTabs, AppSpinner, AppSteps and OtpInput. Generic existing Base UI/shadcn primitives include sheet, tooltip, avatar, badge, scroll-area, skeleton, popover and dropdown-menu, with useful App aliases. Main theme tokens are shared through `@blynta/ui/styles/theme.css`. Product-specific wrappers and Studio editor components stay local. Small compatibility additions preserve Admin/Studio prop contracts. Feature imports generally use `@blynta/ui`.

## 6. Shared authentication code

`@blynta/auth/server` exports product Auth.js configuration, authorization start/callback helpers, safe return-path validation, backend transport and session callbacks. It contains no login application, provider secrets or embedded backend credentials. Imports are used by server modules and route handlers. Product-specific navigation, providers and feature hooks remain in their apps.

## 7. Central Auth application

`apps/auth` retains Main's split-panel layout, branding, form components, validation, Google/Facebook entry buttons and OTP signup experience. It owns `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/authorize`, `/continue` and Auth.js server routes. Pending authorization survives signup and upstream OAuth through a short-lived host-only HttpOnly cookie. Existing account records/password hashes and recovery endpoints are reused.

## 8. Backend changes

Changes are confined to identity/authentication, session validation, rate limiting, CORS/environment configuration and the recovery mail URL. Redis stores hashed opaque session credentials and short-lived hashed grants. Existing MongoDB UsersService and bcrypt validation remain authoritative. Login/social flows reject inactive users. JWT validation checks current database identity/role and session revocation; AdminGuard remains authoritative. Password reset revokes SSO sessions. Public social identity assertions now require a trusted server bridge header. No media pipeline, jobs, billing, storage or queue redesign was performed.

## 9. SSO architecture

Products redirect to central `/authorize`, preserving a safe local destination in their own transaction cookie. Central login establishes an identity with Nest. The central server issues a bound authorization code through Nest and redirects to the registered product callback. The product server exchanges that code with its PKCE verifier, establishes its own Auth.js session, and returns to the saved route. An existing central identity permits another product session without entering credentials again. This is a first-party protocol, not a general OIDC identity provider.

## 10. Cookie/session strategy

Each production app has an independent encrypted Auth.js cookie and secret. Cookies use HttpOnly, Secure, SameSite=Lax, Path=/ and `__Host-` names, without a shared Domain attribute. Long-lived opaque backend session credentials stay in encrypted server session cookies and are excluded from public session JSON. Existing browser API integration receives a short-lived five-minute access JWT. Backend sessions have a fixed seven-day lifetime; child sessions expire with their root identity. Global logout revokes the root and all sibling product sessions, including issued access tokens through their session reference. Explicit product-only revocation is supported. No refresh token is placed in a URL or browser storage.

## 11. Authorization codes and PKCE

Authorization codes have 60-second TTLs, 32 random bytes, exact client/callback binding and S256 PKCE. Grants store only hashes/identity references, not reusable credentials. Atomic Redis compare-and-delete prevents concurrent or repeated redemption. Browser state and verifier remain in a product host-only transaction cookie for up to ten minutes. State comparisons are timing-safe. Relative return paths reject external/protocol-relative URLs, backslashes and encoded/control-character variants. Redirects contain code/state only. Production requires HTTPS and exact callbacks; loopback HTTP exceptions apply only outside production.

Protocol references: [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) and [PKCE](https://www.rfc-editor.org/rfc/rfc7636.html).

## 12. OAuth changes

The central Auth.js **server** handles upstream Google/Facebook authorization, provider callback validation and token exchange. Verified identities cross the authenticated server-to-server Nest bridge; Nest owns users and platform sessions. Google requires state, PKCE and a verified email; Facebook requires state. OAuth client secrets are server-only environment variables in the central identity deployment, never client JavaScript or shared package values. This uses the existing Auth.js integration rather than adding a second Nest provider implementation. Legacy product provider configurations are retained only for staged fallback until real provider flows are verified.

## 13. CORS and authorization

Backend CORS keeps explicit ALLOWED_ORIGINS and rejects malformed origin configuration. Local examples list the actual four product/identity origins. Production must list exact HTTPS origins; no wildcard cookie access was introduced. Authentication does not grant Admin authorization: live database roles and AdminGuard enforce it. Auth.js supplies its credential/signout CSRF checks; product state/PKCE protects cross-app callbacks. Authentication endpoints also have Redis IP/account rate limits.

## 14. Environment and build configuration

All frontends/shared packages use `apps/*` and `packages/*` workspace entries and a single root pnpm lockfile. Backend retains its operational npm lockfile and worker workflow. App environment files stay local to their app; placeholders are explicitly allowed through gitignore. Next transpiles workspace source packages, Tailwind scanning accounts for the extra directory level, and Turbo hashes app environment files and auth/build configuration. Each app supports dev/build/start/lint/typecheck and an individual build filter.

## 15. Retired root applications

After replacement builds and runtime checks, obsolete root app directories are moved to ignored `.migration/originals/` recovery storage. They are excluded from the workspace and are not deployment/source roots. This preserves original local environment files and untracked work without leaving active root app duplicates. Verified standalone frontend npm lockfiles are retained with that recovery snapshot and removed from active `apps/`; only the root pnpm lock and independent backend npm lock are active.

## 16. Duplicate components

Duplicate generic implementations were replaced by shared package imports or thin compatibility re-exports. Some local adapters remain where product props/layout differ. Legacy auth screens and provider configuration remain for rollout compatibility; deleting those before production OAuth verification would violate the requirement to preserve working paths. Studio editor features and marketing components are intentionally not forced into a generic package.

## 17. Production builds

All five apps pass their final Turbo production build with clean pnpm-managed package dependencies: Main, Studio, Admin, Auth and marketing. Backend Nest build passes. Shared packages export source and are built by their consumers, rather than declaring misleading empty build tasks.

## 18. Verification

| Check | Result |
| --- | --- |
| Frontend/shared typecheck | 9/9 tasks pass |
| App production build | 5/5 pass |
| Production startup | All five app pages render successfully (HTTP 200) |
| Backend build and typecheck | Pass |
| Studio existing editor/auth tests | Pass |
| Focused backend SSO/AdminGuard security tests | 26 tests pass |
| Full backend Jest suite | 96 pass, 2 fail across 15 suites |
| Frontend/shared lint | 7/9 tasks pass; Main and Admin have existing failures |
| New backend SSO/guard/fixture lint | Pass |
| Full backend lint | Existing broad unsafe-type/formatting backlog remains; not a passing gate |
| Isolated HTTP SSO integration | Real Next/Auth.js/Nest routes with synthetic users and in-memory persistence pass |

The full backend test failures concern an unchanged notification read-status expectation and an unchanged health test lacking its DatabaseConnection mock. Their production/test files were not changed by this migration. Main lint reports 38 errors; Admin reports one error in its existing mobile hook. Backend full lint initially reported 1128 errors/106 warnings before focused formatting/type fixes; that initial count is not a final passing result. No unrelated lint/test errors were hidden or resolved through global rule relaxation.

HTTP integration covers startup of all four auth/product apps and Nest, Studio login with a saved query, Studio→Main and Main→Studio SSO, Main login, signup/OTP verification/handoff, ordinary Admin denial in both frontend and backend, privileged Admin access, callback/return tampering, invalid callback registration, global logout/revocation and fresh sign-in after revocation. Focused unit tests cover code/session expiry, replay/concurrent exchange, wrong PKCE/client/callback, inactive users, role changes, rate limits, bridge checks and reset revocation. Browser cookies are modeled by host/path; tests exercise real HTTP redirects and Auth.js CSRF rather than static compilation alone. They do not exercise actual Google/Facebook accounts, production TLS cookies or real MongoDB/Redis.

## 19. Remaining verification and rollout

Run real Google/Facebook flows with configured providers, real MongoDB/Redis integration and deployed HTTPS cookie behavior before enabling central auth for production. Complete the existing lint/test backlog in separate scoped work. The staged examples deliberately retain `CENTRAL_AUTH_ENABLED=false`; local integration explicitly enables it and verifies the central flow. Legacy removal should follow successful provider/production verification. A live deployment was not performed by this task.

## 20. Manual deployment/provider configuration

1. Create independent deployments for `apps/web`, `apps/app`, `apps/studio`, `apps/admin` and `apps/auth`. Install from the repository root with the pinned pnpm version. Use a filtered Turbo build, e.g. `pnpm exec turbo run build --filter=@blynta/studio`; publish that app's `.next` output.
2. Configure independent AUTH_SECRET values, each app's AUTH_URL, backend URL and exact AUTH_APP_URL/MAIN_APP_URL/STUDIO_APP_URL/ADMIN_APP_URL. Put SSO_BRIDGE_SECRET only in the backend and trusted server deployments. During legacy fallback, legacy provider servers also require that bridge secret; remove it there after central cutover. Never use NEXT_PUBLIC variables for secrets.
3. Configure backend SSO_CLIENTS with `blynta-main → https://app.blynta.com/auth/callback`, `blynta-studio → https://studio.blynta.com/auth/callback`, `blynta-admin → https://admin.blynta.com/auth/callback`. Use a separate explicit localhost registry for development. Set exact backend ALLOWED_ORIGINS and AUTH_APP_URL for recovery mail links.
4. Register Google `https://auth.blynta.com/api/auth/callback/google` and Facebook `https://auth.blynta.com/api/auth/callback/facebook` in their provider consoles. Local callbacks use `http://localhost:3003/api/auth/callback/{provider}`. Enable the providers in the existing backend provider settings and set their server credentials in Auth. Keep old callbacks during staged rollout; retire them after live verification.
5. For the existing Amplify deployment, set AMPLIFY_MONOREPO_APP_ROOT to `apps/app`. The repository build spec runs from `/`, uses the filtered Main build and publishes `apps/app/.next`. Its prebuild copies `.amplify.npmrc` to the deployment root for Amplify's documented hoisted linker, without changing local pnpm dependency layout. Configure other Amplify apps with their corresponding roots/filter/artifact paths. Ensure the build image supports pinned pnpm and Next (Node 22 or newer). AWS settings must be changed in the console; no cloud deployment/settings mutation was performed.
6. After the live checks pass, set CENTRAL_AUTH_ENABLED=true on Main/Studio/Admin and verify both cross-app directions, Admin denial, logout and recovery again. Then remove the retained legacy auth implementation in a separate follow-up.

Amplify configuration follows [AWS monorepo build settings](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html). The hoisted deployment installation still needs verification in Amplify's Linux build/runtime; local builds verified the normal pnpm workspace installation.
