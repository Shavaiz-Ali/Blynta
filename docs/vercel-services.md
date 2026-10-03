# Vercel services deployment

The root `vercel.json` defines one Vercel project with six services. Configure the
Vercel project's root as this repository, not an individual app. `packages/auth`
is a shared TypeScript library, not a Next.js application or deployable service.

The current routing draft preserves the production frontend hosts documented in
the repository. Confirm the API host and the public exposure of all services
before deployment.

| Service | Public host | Paths | Internal callers |
| --- | --- | --- | --- |
| web | blynta.com, www.blynta.com, unmatched deployment hosts | All | None |
| app | app.blynta.com | All, including /dashboard and /api/auth/* | None |
| admin | admin.blynta.com | All, including /login and /api/auth/* | None |
| auth | auth.blynta.com | All, including /authorize and /api/auth/* | None |
| studio | studio.blynta.com | All, including /editor/* and /api/studio/* | None |
| backend | api.blynta.com (proposed) | All, including /auth/* and /billing/* | app, admin, auth, studio |

Attach the five subdomains and the website domains to the **same** Vercel project.
Host rewrites preserve request paths, frontend assets, OAuth callbacks, and API
route ownership. There are no prefix mounts in this configuration. The backend
uses its existing routes without an `/api` prefix; a public API request is
`https://api.blynta.com/users/me`. The final catch-all goes to Web.

## Runtime bindings

Each of App, Admin, Auth, and Studio declares a backend binding which injects
`BACKEND_SERVICE_URL`. **Do not set that variable yourself**, in Vercel settings,
`.env` files, build commands, or Turbo configuration. Server authentication and
Studio's API proxy read it at request time, with `BACKEND_URL` and existing public
URL variables retained for ordinary local development. Internal URLs may use
HTTP; the identity transport still requires HTTPS for manually configured
production backend URLs.

Public browser API clients use `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_BACKEND_URL`, both set to `https://api.blynta.com`. These are public
build-time values and must never contain a binding URL. Backend calls do not run
at module initialization. Provider discovery runs inside a route function.
Product Proxy checks encrypted cookies locally; the protected server layouts
and Auth.js route functions perform session revocation validation and refresh
over the binding. The NestJS API continues to authorize bearer tokens.

Auth handoff URLs and Studio navigation are browser redirects rather than
server-to-server calls, so they use public origins, not bindings. Web has no
backend calls. The backend does not call any frontend over HTTP.

## Shared project environment

Configure these values in Vercel for the appropriate deployment environment:

```dotenv
ENABLE_EXPERIMENTAL_COREPACK=1
CENTRAL_AUTH_ENABLED=true
AUTH_APP_URL=https://auth.blynta.com
MAIN_APP_URL=https://app.blynta.com
ADMIN_APP_URL=https://admin.blynta.com
STUDIO_APP_URL=https://studio.blynta.com
NEXT_PUBLIC_SITE_URL=https://blynta.com
NEXT_PUBLIC_APP_URL=https://app.blynta.com
NEXT_PUBLIC_BLYNTA_URL=https://app.blynta.com
NEXT_PUBLIC_STUDIO_URL=https://studio.blynta.com
NEXT_PUBLIC_API_URL=https://api.blynta.com
NEXT_PUBLIC_BACKEND_URL=https://api.blynta.com
FRONTEND_URL=https://app.blynta.com
SSO_CLIENTS={"blynta-main":["https://app.blynta.com/auth/callback"],"blynta-studio":["https://studio.blynta.com/auth/callback"]}
ALLOWED_ORIGINS=https://app.blynta.com,https://studio.blynta.com,https://admin.blynta.com,https://auth.blynta.com
ALLOW_LEGACY_AUTH_TOKENS=false
```

Supply **four independent random secrets** as `BLYNTA_APP_AUTH_SECRET`,
`BLYNTA_ADMIN_AUTH_SECRET`, `BLYNTA_STUDIO_AUTH_SECRET`, and `BLYNTA_AUTH_SECRET`.
The server and Proxy use the matching secret for each app. Existing `AUTH_SECRET`
and `NEXTAUTH_SECRET` remain fallbacks for local development. Do not set a shared
`AUTH_URL` or `NEXTAUTH_URL`: Auth.js should infer the request origin on Vercel,
since each app has a different hostname.

Also supply the existing backend database, Redis, JWT, storage, billing, and mail
settings and `SSO_BRIDGE_SECRET`. Configure OAuth credentials and the central
Auth callbacks `/api/auth/callback/google` and `/api/auth/callback/facebook`.
Keep credentials out of `NEXT_PUBLIC_*` variables. Update the YouTube redirect
URI and Paddle webhook URL to the API host while preserving their existing route
paths. Workers must share the same backend database, Redis, and storage settings.

Preview deployments need their own attached hostnames, matching host rewrites,
public build-time URLs, and SSO callback registry; bindings automatically target
the matching deployment, but browser redirects do not. A raw `*.vercel.app` URL
currently serves Web only. Do not point preview browser authentication at
production origins.

## Build and local verification

Frontend services install the root pnpm workspace using the pinned package
manager and build their own Next.js application. Set
`ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the root `packageManager` pin
instead of its default pnpm version (see
[Vercel package managers](https://vercel.com/docs/package-managers)). Backend uses its separate npm
lockfile (`npm ci`, `npm run build`). Enable access to files outside each service
root if the project settings restrict it, since frontends import `packages/*`.

Use a current Vercel CLI from the repository root:

```sh
vercel dev -L
```

This runs all services and injects bindings. CLI 62.2.0 accepts this services
configuration but explicitly warns that `has` conditions are ignored during
development. Consequently, a Host header cannot verify the production host
rewrites under this CLI. Validate those rules on a preview deployment with
attached preview domains and matching environment/callback configuration.
Existing `pnpm setup:auth`/`pnpm dev` remains the separate-port development
workflow, but does not exercise Vercel routing.

## Persistent workers

The existing BullMQ jobs, Studio renders, mail, activities, notifications, and
YouTube workers are persistent processes, not HTTP services. Keep them on a
separate persistent worker host using the existing backend worker commands and
`ecosystem.config.js`; this configuration does not deploy them. FFmpeg and
download tools belong on that worker host. The API only enqueues work on Redis.
The legacy YouTube processor is disabled in the API when running on Vercel;
the dedicated YouTube worker module still runs it (`npm run
start:worker:youtube:prod` from `backend`). This is required because a
Vercel function cannot reliably keep polling a queue after requests finish.

This configuration has not been deployed. Verify service builds, public routing,
SSO/revocation, webhooks, and worker processing before production cutover.

## Validation of this change

All five frontend production builds, workspace type checks, backend type
checking, shared Auth linting, formatting checks, and 13 identity transport
tests passed. Vercel CLI 62.2.0 detected all six services and accepted the
configuration under `vercel dev -L`. Local host conditions were not exercised
because the CLI ignores them. The full SSO regression did not complete:
development startup requests timed out and cached development routes returned
404s. Production builds passed after cleaning malformed generated development
types. Full SSO and host routing still require preview verification.

Admin always uses credentials-only authentication, independently of CENTRAL_AUTH_ENABLED. Its backend session is not linked to the consumer root. Normal product logout is local; central logout affects App/Studio. Admin OAuth callbacks are disabled. See [authentication boundary audit](auth-boundaries.md) for deployment and validation.
