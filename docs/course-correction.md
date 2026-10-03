# Architecture correction: preserving the migration

## A. Reusable as-is

The extracted main-app components in `packages/ui`, shared PKCE/SSO helpers in `packages/auth`, backend identity/code/session services, authoritative AdminGuard checks, and security tests remain useful. Existing users and bcrypt hashes are unchanged. Before the correction, all four product/auth production builds passed and 26 focused security/AdminGuard tests passed.

## B. Reusable with relocation

`frontend` becomes `apps/app`; the actual Studio directory `blynta-studio` becomes `apps/studio`; `admin` becomes `apps/admin`; the new `auth` becomes `apps/auth`; the existing marketing application `landingpage` becomes `apps/web`. Routes, public files, local environment files, product features, and editor components are preserved as whole applications.

## C. Needs modification

Workspace importer paths, CSS source scanning, Amplify roots/build commands, app package names, development scripts, deployment documentation, and the integration harness must reference the new paths. The duplicate pnpm native-build policy entry needs repair. Shared auth/API contracts justify a small `@blynta/types` package; duplicated main/auth HTTP infrastructure justifies `@blynta/api-client`. Existing lint errors and the interrupted fixture run require follow-up verification.

## D. Obsolete

The flat frontend workspace entries and old Amplify `frontend` root are obsolete. Root app copies are kept only during verification and removed after their relocated sources build. Old standalone npm lockfiles are archived after the pnpm lockfile resolves, rather than discarded. No source, local environment files, or completed shared work is blindly reverted.

## Backend boundary

The backend stays operationally independent with its existing npm lockfile, Nest/BullMQ workers, and native dependencies. Moving it into pnpm is unnecessary for this architectural change and would add a separate dependency migration. Run its build/tests from `backend` with npm. All frontend apps and frontend packages use the root pnpm lockfile and Turbo.
