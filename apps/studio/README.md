# Blynta Studio

A separate Blynta frontend for desktop video editing, sharing Blynta identity, account billing, credits, notifications, and the UI package.

The folder structure matches `../app`: root-level `app`, `features`, `components`, `providers`, `config`, `lib`, and `types`. Routes stay thin and compose feature components. Generic controls and sign-in helpers come from workspace packages.

- [Folder structure](folder-structure.md)
- [Redesign architecture and UI verification](UI-AUDIT.md)
- [Setup, authentication, SSO requirements and prototype limits](SETUP.md)
- [Product foundation audit, implementation, validation, and remaining roadmap](PRODUCT-FOUNDATION.md)

```sh
# From the monorepo root
pnpm install --frozen-lockfile
pnpm --filter @blynta/studio dev
```

```sh
pnpm --filter @blynta/studio lint
pnpm --filter @blynta/studio typecheck
pnpm --filter @blynta/studio test
pnpm --filter @blynta/studio build
```

The Studio backend lives in `backend/src/studio`: persistent projects, project media uploads/imports, provider-backed AI edit proposals, transcript captions, and queued rendering. The workspace opens at `/home`; `/dashboard` remains the projects manager. `/media`, `/from-blynta`, `/usage`, and `/notifications` expose existing account and Studio data. Templates is a disabled Coming Soon item.

Studio operations do not yet have a product-aware credit ledger or export/AI completion notifications. My Media lists media attached to existing projects; arbitrary insertion into another project remains future work. Production builds require the existing `MAIN_APP_URL` to be a valid HTTPS main-app origin. No new environment variables or database migrations are required for this foundation.
