# Blynta platform

Five independently deployable Next.js applications share a pnpm/Turbo workspace. The existing NestJS backend keeps its npm workflow.

| Application | Package | Local port | Production host |
| --- | --- | --- | --- |
| `apps/web` | `@blynta/web` | 3004 | blynta.com |
| `apps/app` | `@blynta/app` | 3000 | app.blynta.com |
| `apps/studio` | `@blynta/studio` | 3002 | studio.blynta.com |
| `apps/admin` | `@blynta/admin` | 3001 | admin.blynta.com |
| `apps/auth` | `@blynta/identity` | 3003 | auth.blynta.com |

Use the package manager pinned by `package.json`:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup:auth
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
pnpm format:check
pnpm --filter @blynta/studio test
pnpm test:sso
pnpm test:startup
```

Build or run one application with `pnpm --filter @blynta/studio build` or `pnpm --filter @blynta/studio dev`. Shared packages export TypeScript source; each Next app transpiles its workspace dependencies.

Formatting uses the root Prettier configuration and pinned dependency. Run `pnpm format` to format source/configuration files, or `pnpm format:check` to check them. Backend files keep their existing single-quote convention. Generated output, recovery snapshots, environment files and lockfiles are excluded. VS Code workspace settings select the Prettier extension and enable formatting on save.

Run the backend separately from `backend`: `npm ci`, `npm run start:dev`, `npm run build`, `npm run typecheck`, `npm run lint:check`, and `npm test -- --runInBand`. Its normal API port is 5001. Keep its existing MongoDB, Redis, queues and environment configuration.

Keep the backend running in a second terminal with `pnpm dev:backend` from the repository root. `pnpm dev` starts frontend apps only. Central sign-in requires the backend, MongoDB and Redis; an unavailable backend now shows a service error instead of an incorrect email/password warning. Run `pnpm test:auth-errors` to verify credential rejection, configuration errors, rate limits and service outages stay distinguishable without leaking credentials into error details.

For initial local Auth setup, `pnpm setup:auth` configures ignored `.env.local` files in Auth, App, Studio and Admin with the handoff URLs, backend URLs and Auth secrets. It enables central authentication in the three product apps and adds the matching bridge secret, local callback registry and required origins to the existing development `backend/.env`, preserving existing database/JWT settings and valid Auth secrets. Re-running setup preserves the generated secrets. Restart the frontend apps and backend after setup. Production configuration and OAuth provider credentials must be supplied through deployment settings.

App-specific environment files stay inside each app. Merge the placeholders in `.env.example` and `backend/.env.sso.example` into local/private deployment configuration. Each app needs its own `AUTH_SECRET`. The backend and central identity server share `SSO_BRIDGE_SECRET`; never expose it or OAuth client secrets through `NEXT_PUBLIC_*` variables. Examples enable `CENTRAL_AUTH_ENABLED=true`. The backend rejects unlinked legacy JWTs by default; `ALLOW_LEGACY_AUTH_TOKENS=true` is only for an explicit temporary legacy rollout, whose tokens cannot receive SSO logout guarantees. Legacy product configuration is loaded only when central authentication is disabled.

Local setup preserves central OAuth credentials and fills missing ones from Main's existing private environment. Configure the Google and Facebook callbacks at central Auth before live provider verification. See [Phase 1 authentication report](docs/auth-phase-1.md) for cookie/token ownership, test results, retained compatibility code and deployment checks.

`pnpm test:sso` uses synthetic accounts, isolated ports 3100–3103/5101, real Next/Auth.js/Nest code and in-memory persistence. It does not access real users or provider accounts. It writes ignored diagnostic logs to `.test-results/` and cleans up its child servers.

See [migration report](docs/migration-report.md) for the architecture, security decisions, validation results and manual deployment/provider settings; [course correction](docs/course-correction.md) records the work preserved and relocated.
