# Blynta Studio

A separate Blynta frontend for desktop video editing, with existing Blynta authentication and local prototype editor state.

The folder structure matches `../app`: root-level `app`, `features`, `components`, `providers`, `config`, `lib`, and `types`. Routes stay thin and compose feature components. Generic controls and sign-in helpers come from workspace packages.

- [Folder structure](folder-structure.md)
- [Redesign architecture and UI verification](UI-AUDIT.md)
- [Setup, authentication, SSO requirements and prototype limits](SETUP.md)

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

No Studio backend, video processing, AI service, or render service is included.
