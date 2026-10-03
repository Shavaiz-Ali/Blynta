# Deployed logout redirect diagnosis

## Evidence and exact responsible code

Read-only production checks found both `https://blynta.vercel.app/signed-out`
and `https://studio-blynta.vercel.app/signed-out` returning HTTP 200 with the old
"Central sign-in is still available" page. Studio `/auth/logged-out` and central
Auth `/product-logout?from=studio` returned HTTP 404. Public Auth.js provider
metadata used the correct hostnames, with no observed cross-app AUTH_URL override.

The screenshot shows Main (`blynta.vercel.app`) and "Signed out of Blynta App".
The same obsolete page was independently confirmed at Studio's public hostname.
The live sites therefore do not serve the current route implementation. Local
commit `7a6e9f3` already removed the two signed-out pages and introduced the new
routes. The deployed Git SHA/project configuration could not be read with the
available tools, so the reason that deployment selected older output is unverified.

The preceding implementation in commit `c61a25f` had these exact logout actions:

- `apps/studio/components/common/UserDropdown.tsx`: `signOut({ redirectTo: "/signed-out" })`.
- `apps/app/features/dashboard/components/UserDropdown.tsx`: `signOut({ callbackUrl: "/signed-out" })`.
- Page text came from the respective `app/signed-out/page.tsx` files. Both files
  remain deleted; no signed-out page has been recreated.

## Corrected navigation and override checks

Both buttons now call `logoutProduct` in `packages/auth/src/client.ts`:

1. Set a local logout-in-progress guard before Auth.js updates client session state.
2. POST through Auth.js signOut with `redirect: false`, `/auth/logged-out` as the
   requested callback, and Auth.js CSRF protection.
3. Existing product signOut event posts backend `sso/logout` with `scope: product`;
   Auth.js removes only that product's session cookie. Backend policy is unchanged.
4. Force full browser navigation to the local `/auth/logged-out`, ignoring stale
   redirect URLs returned by Auth.js.
5. The product route uses configured `AUTH_APP_URL` to redirect to
   `/product-logout?from=studio` or `from=main` on central Auth.
6. Central Auth clears pending authorization state and renders
   `/login?mode=product-logout&from=studio` or `from=main`. It never authorizes or
   returns to a product until the user explicitly chooses Continue.

Studio's second handler was in `ProtectedStudio.tsx`: an unauthenticated-session
effect redirected to `/login?callbackUrl=...`, which initiates consumer SSO. It
now suppresses competing navigation during product logout. A session-loss
broadcast in another Studio tab navigates to the central logout landing instead
of restarting SSO. Expired-session cleanup uses the same logout helper.
Ordinary anonymous entry into a protected product still
uses the existing login/SSO policy.

The product Auth.js redirect callback translates cached clients' `/signed-out`
callbacks into `/auth/logged-out`. Product Proxy also redirects direct old
`/signed-out` navigation before its authentication checks. `/signed-out` is now
only a compatibility redirect, with no UI and no authorization issuance.
Central Auth has no login Proxy redirect. Global logout remains a separate
central action and consumer UI no longer mentions Admin. No Admin authentication,
session, cookie or backend policy was changed.

## Files changed in this correction

- `apps/app/features/dashboard/components/UserDropdown.tsx`
- `apps/studio/components/common/UserDropdown.tsx`
- `apps/studio/features/auth/components/ProtectedStudio.tsx`
- `apps/auth/app/logout/page.tsx`
- `packages/auth/package.json`
- `packages/auth/src/client.ts`
- `packages/auth/src/server.ts`
- `packages/auth/src/proxy.ts`
- `scripts/test-sso.mjs`
- `scripts/tests/product-logout.test.mjs`
- `docs/auth-boundaries.md`
- `docs/logout-redirect-fix.md`

## Local validation

- Production builds passed for Auth, Main and Studio.
- Typechecks passed for shared auth, Main, Studio, Auth and Admin.
- Focused local HTTP integration checks passed for both product logout flows,
  sibling/central/Admin session preservation, revoked product API access,
  stale `/signed-out` callbacks and bookmarks, central landing refresh without
  automatic authorization, and explicit product re-entry.
- Three client tests passed for logout/navigation ordering, failed cleanup,
  and session loss in another tab without restarting SSO.
- Changed code passed Prettier checks. Scoped ESLint had no errors; Main's
  existing unused `MoonIcon` import remains a warning.
- Integration accounts were synthetic; live production login/logout was not
  exercised and these changes were not deployed from this task.

## Deployment verification

Deploy the updated Main, Studio and Auth applications from the corrected commit
to the projects serving the actual public hostnames. Local builds cannot change
an older Vercel artifact. No new environment variable is required; the existing
AUTH_APP_URL must identify central Auth in each deployment environment.

Before testing logout, verify Studio `/auth/logged-out` returns a redirect to
central Auth and central `/product-logout?from=studio` returns a login redirect,
rather than 404. Main/Studio `/signed-out` must now redirect rather than render
the old page. Test both products with a valid sibling and independent Admin
session; refresh the central landing and ensure the logged-out product stays
unauthenticated until Continue is selected.
