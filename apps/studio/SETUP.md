# Running Blynta Studio

Run from the monorepo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @blynta/studio dev
```

Studio runs on http://localhost:3002. Its environment files stay in `apps/studio`.
Use an independent AUTH_SECRET, the existing backend URL, and the origins in
`.env.example`. Do not copy another product's session secret.

## Central authentication

Set CENTRAL_AUTH_ENABLED=true after configuring `apps/auth` (port 3003), the
existing Nest backend (port 5001), and exact registered product callbacks. Studio
redirects to central identity with state and S256 PKCE, then redeems a one-time
code through its server callback. Each product has its own host-only HttpOnly
session cookie. A shared Domain cookie or shared Auth.js secret is unnecessary.
The same existing Blynta user records and bcrypt hashes are used across products.

Signup, OTP verification, recovery and Google/Facebook UI live in `apps/auth`.
Register social callbacks on the Auth origin, not Studio. Provider secrets stay
in trusted server environment configuration. Backend sessions, current user
roles and AdminGuard enforce revocation and authorization.

The example flag remains false for staged production rollout; the retained
legacy forms/providers provide compatibility until real OAuth flows have been
verified. Old BLYNTA_AUTH_ORIGIN/domain-cookie settings describe that legacy
implementation and are not the central SSO configuration.

See [migration report](../../docs/migration-report.md) for deployment environment
settings, callback registration and verification limitations. The mail worker
uses AUTH_APP_URL for centralized recovery links when configured.

## Prototype boundaries

- Project metadata and edit plans are stored in this browser, scoped to user ID.
- Two clearly labeled sample projects use a static visual, not real sample video.
- Uploaded files play locally when the browser supports their codecs. They are
  not uploaded or saved as file contents. Reattach them after a full refresh.
- Manual timeline move, trim, split, duplicate, delete, selection, snapping, zoom,
  undo/redo, playback, mute, visibility, aspect ratios and property edits use
  frontend state. Space, S, Delete, Ctrl/Cmd Z and Ctrl/Cmd K skip text inputs.
- AI opens in a nonmodal shadcn Sheet with preserved conversation history and
  reviewed Apply/Discard/Undo actions. Project or selected-clip context supports
  trimming and volume, plus project-wide vertical format and sample captions.
  Captions are not transcriptions.
- URL imports, transitions/effects/brand libraries and video rendering are clearly
  marked as future functionality. Export currently downloads project JSON.
- Auth/dashboard are responsive. The editor shows an intentional larger-screen
  message below 768px. Tablet media/properties panels can be toggled independently.

## Checks

```sh
pnpm --filter @blynta/studio lint
pnpm --filter @blynta/studio typecheck
pnpm --filter @blynta/studio test
pnpm --filter @blynta/studio build
```

The editor checks cover immutable edits, undo/redo, source offsets during splitting,
synchronized trims, invalid AI commands, selected-clip isolation, secure return URLs, and caption timing. Browser checks cover
auth validation, canvas ratios, AI Apply/Undo, splitting, and mobile editor state.
Successful live sign-in and email delivery still require a running Blynta backend
and a real test account. No account was created or reset during implementation.
