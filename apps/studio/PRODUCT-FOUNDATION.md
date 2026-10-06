# Studio product foundation — implementation report

The existing Studio design, project cards, editing workspace, identity, and storage remain the foundation. The main app is the visual reference for shared chrome. This work does not introduce Studio pricing, a separate wallet, or a separate notification platform.

1. **Existing Studio functionality discovered — WORKING NOW.** The Studio backend already provides persistent projects, rename/delete/duplicate, revision-aware saves, project assets, signed R2 upload/playback, Blynta clip imports with source references, transcript captions, provider-backed AI proposals, and queued MP4 exports. AI proposals support trimming, aspect ratio, and volume. Silence removal and generative media are not implemented.

2. **Existing backend systems reused.** Studio projects/assets and rendering retain their existing module. Shared `users/me`, Notifications, Activities, billing/Paddle, storage/R2, jobs/source media, and Redis/BullMQ remain authoritative. `packages/auth` continues handling identity/session/logout; `packages/api-client` remains shared transport for existing consumers. Studio retains its established server-side API proxy pattern, keeping access tokens out of browser requests. `packages/types` already defines product IDs such as `blynta-main` and `blynta-studio`.

3. **New information architecture.** Workspace: Home and Projects. Create: Blynta AI and disabled Templates. Library: My media and From Blynta. Account / Usage: Credits / Usage and Notifications. Back to Blynta and compact workspace identity remain at the sidebar bottom. The shared account menu provides Profile, Billing & Plan, Appearance, and logout; Studio additionally links Back to Blynta. The old account Settings action was removed because no Settings page exists.

4. **Home — WORKING NOW.** `/` redirects to `/home`. Home owns Quick Create (blank project, upload video, From Blynta), the compact Blynta AI entry, four recent projects with View all, and project-based captions, resize, and export discovery. Loading, failure/retry, and first-project states use existing project data and components.

5. **Projects changes — WORKING NOW.** `/dashboard` remains the project manager, preserving the redesigned cards/table, search, source filtering, sort, grid/list toggle, prefetch, rename, delete, and duplicate behavior. Quick Create and Recent Projects now belong to Home, removing duplicate discovery content.

6. **Media/library integration — WORKING NOW with a deliberate boundary.** `/media` lists existing Studio asset records in pages of 24, with All / Uploads / From Blynta filters, title, type, duration, processing status, source group, date, and a stored thumbnail when available. Cards open the owning project. Upload uses the existing new-project upload flow. The listing includes only owned assets attached to existing owned projects; orphan references retained after project deletion are excluded. No R2 files are copied or deleted. Signed thumbnails are response-only and never canonical identity. Records shared across duplicated projects remain project references. Arbitrary insertion of a library asset into a different project is future work.

7. **Credit architecture discovered/used.** The account User owns `plan`, `creditsBalance`, `totalCreditsUsed`, and `creditsResetAt`. Existing plan configuration defines Free/Pro/Business allowances. Paddle grants/renews credits through the existing subscription flow; main-app jobs use the existing account deduction path. Studio reads the actual account balance and reset field, without claiming those credits are charged by Studio operations. Missing balances show a dash/error rather than a fake zero. Studio does not invent a monthly allowance denominator. Recorded credit Activities appear on `/usage`; these are account events, not a complete transaction ledger. A product/operation-aware usage ledger and Studio entitlement/rate enforcement require future backend work.

8. **Notification architecture discovered/used — WORKING NOW for account notifications.** The shared Notifications module already supports per-user listing, unread counts, timestamps, read/unread state, mark-read, mark-all-read, categories, action URLs, deduplication, metadata, and a queue/worker. Studio consumes that existing account feed with the shared bell UI and `/notifications`, including pagination, All/Unread filters, read actions, errors, and empty states. Existing action URLs lead to the main Blynta app. This work does not emit new Studio export/AI/import events or claim account notifications are Studio-specific. Existing metadata/entity context can carry Studio event context when producers are added.

9. **Billing/upgrade integration — WORKING NOW.** The shared credit popover and account menu link to the existing main-app `/billing` route. The account plan controls Upgrade for more versus Manage Plan. Profile links to the existing `/profile` route. No new checkout, Paddle integration, pricing page, or webhook behavior is introduced.

10. **AI entry behavior — WORKING NOW, provider-dependent.** Home/sidebar open a project picker. Selecting a recent project enters `/editor/:id?ai=1`, opening the existing editor AI panel. Its existing proposal review/apply/undo behavior remains intact. The picker also offers an upload-to-new-project flow and access to the full project manager. Tool discovery enters the editor without automatically opening AI. Captions depend on real transcripts or the existing transcription workflow; general AI edits require the existing provider configuration. No fake standalone chat route or unsupported suggested actions were added.

11. **Coming Soon.** Templates is the only disabled Coming Soon item, reflecting the supplied Studio direction. It has no empty route and does not pretend to work.

12. **Backend changes.** Added authenticated `GET /studio/media` to the existing Studio controller/service, with validated page/source parameters, ownership constraints, pagination, existing R2 thumbnail signing, and no storage mutation. Added library tests. Optional response-thumbnail typing was clarified in existing project list/detail responses to resolve pre-existing import-test typecheck failures without changing response behavior. No new backend module was created.

13. **Schema changes.** None. Existing projects/assets, User, Notification, Activity, jobs/source-video, and billing schemas are reused. No product fields were blindly added.

14. **Routes.** New frontend routes: `/home`, `/media`, `/from-blynta`, `/usage`, `/notifications`. `/from-blynta` combines the existing Edit in Studio instructions/main clip browser link with already imported media. `/dashboard` and `/editor/:id` remain. New shared-account proxy: `/api/workspace/[...path]`, restricted to profile, notification list/count/read operations, and account activity listing. It validates allowed methods/endpoints, checks Origin on mutations, forwards only allowed query fields, sends tokens server-side, disables caching, and handles service outages. Existing clip import routes are unchanged.

15. **Shared components reused/extracted.** Both apps now consume `AppProductHeader`, `AppHeaderActions`, `AppCreditsControl`, `AppNotificationControl`, and `AppAccountMenu` from `packages/ui`. These own the common navigation controls, credit presentation, notification trigger/badge, identity/avatar, plan badge, account menu, Appearance submenu, and logout presentation. Apps supply data, routes, notification body, and their existing logout callback. Studio also reuses AppSidebar, AppSidebarItem, AppButton, AppDialog, AppInput, AppCard, AppSkeleton, Sheet, and shared primitives. The main app changed only to consume the shared chrome and remove its dead Settings menu action; its page experience and billing flow were not redesigned.

16. **Files changed.** See the manifest below. The temporary layout-verification route was removed; no test identity/data route ships.

17. **Environment variables.** None added or changed. Existing `MAIN_APP_URL` / `NEXT_PUBLIC_BLYNTA_URL`, auth/backend configuration, R2 settings, workers, and AI/transcription provider settings remain necessary for their existing capabilities. Studio production validation supplied `MAIN_APP_URL=https://blynta.com` only to the build process because the local development origin fails the existing production-origin guard; no environment file was modified.

18. **Migrations/deployment.** No database migration or dependency/lockfile change. Deploy the backend media endpoint along with the Studio frontend. Existing backend/worker/storage/provider configuration is still required. No production deployment was performed.

19. **Validation.**

    | Check | Result |
    | --- | --- |
    | Shared UI typecheck and lint | Passed |
    | Studio typecheck, lint, and production build | Passed |
    | Main app typecheck and production build | Passed; build required network access to fetch existing Google Fonts |
    | Main app changed header/menu/bell/layout files lint | Passed |
    | Full main app lint | Existing unrelated errors remain, including auth/billing/profile types and effect-state rules |
    | Backend typecheck and build | Passed |
    | Changed backend controller/service/library-test lint | Passed |
    | Selected backend persistence/import/library suites | 3 suites, 27 tests passed |
    | Existing Studio editor/auth regressions | Passed |
    | Existing production-destination/upload lifecycle regressions | Passed |
    | New workspace proxy checks | Passed: allowlist, CSRF, authentication, token isolation, query filtering, no-store, read updates, outages |
    | Visual inspection | Shared account menu and workspace inspected on desktop and 390px mobile using a temporary preview fixture |

    No live authenticated database, Paddle checkout, real AI provider run, or production export was exercised in this task. Those existing integrations were reused, not represented as newly end-to-end verified functionality.

20. **Remaining roadmap — REQUIRES FUTURE BACKEND WORK.** Product/operation-aware credit reservations, charging/refunds, usage ledger, and explicit Studio entitlements; Studio event producers and notification routing for exports, processing, and AI completion; cross-project library insertion/reference lifecycle; richer reusable media organization; template data and workflows. Larger AI capabilities such as silence removal/generative media require their own implementation. Only Templates is advertised as Coming Soon today.

## File manifest

Shared UI:
- `packages/ui/src/components/AppProductHeader.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/README.md`

Main-app adapters:
- `apps/app/features/dashboard/components/DashboardLayout.tsx`
- `apps/app/features/dashboard/components/DashboardHeaderRight.tsx`
- `apps/app/features/dashboard/components/UserDropdown.tsx`
- `apps/app/features/notifications/components/NotificationBell.tsx`

Studio:
- `apps/studio/app/page.tsx`
- `apps/studio/app/(main)/home/page.tsx`
- `apps/studio/app/(main)/media/page.tsx`
- `apps/studio/app/(main)/from-blynta/page.tsx`
- `apps/studio/app/(main)/usage/page.tsx`
- `apps/studio/app/(main)/notifications/page.tsx`
- `apps/studio/app/api/workspace/[...path]/route.ts`
- `apps/studio/components/common/UserDropdown.tsx`
- `apps/studio/features/studio/dashboard/components/StudioShell.tsx`
- `apps/studio/features/studio/dashboard/components/StudioDashboard.tsx`
- `apps/studio/features/studio/dashboard/components/ProjectCollection.tsx`
- `apps/studio/features/studio/dashboard/components/QuickStart.tsx`
- `apps/studio/features/studio/dashboard/components/AccountControls.tsx`
- `apps/studio/features/studio/dashboard/components/WorkspacePages.tsx`
- `apps/studio/features/studio/dashboard/workspace-api.ts`
- `apps/studio/features/studio/editor/hooks/useEditor.tsx`
- `apps/studio/scripts/test-workspace-api.mjs`
- `apps/studio/README.md`
- `apps/studio/PRODUCT-FOUNDATION.md`

Backend:
- `backend/src/studio/studio.controller.ts`
- `backend/src/studio/studio.service.ts`
- `backend/src/studio/studio-library.spec.ts`
