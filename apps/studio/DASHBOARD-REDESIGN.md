# Blynta Studio dashboard redesign

## 1. Previous dashboard

The dashboard had a sparse header, no primary application navigation, disconnected controls, padded card content that weakened the thumbnails, and a small “Continue editing” label. Creation was concentrated in one button. A separated account-save footer added space without helping project discovery. Loading and error presentation did not give the workspace a consistent structure.

## 2. Information architecture

The dashboard now uses a compact header, persistent Studio navigation, and a main workspace ordered as **Projects → Quick start → Recent projects → All projects**. The sidebar exposes New project, Projects, From Blynta, and Back to Blynta. The existing theme switch and account menu stay together in the header.

Recent projects are the four most recently edited projects from the same cached dataset as the full library. All projects has an integrated search, source filter, sort control, result count, and grid/list selector. The old footer and “Continue editing” text were removed.

## 3. Components created

- `StudioShell`, `StudioHeader`, `StudioSidebar`: application geometry, compact navigation, collapse controls, skip link, and mobile drawer.
- `QuickStart`, `FromBlyntaDialog`: three creation entry points and guidance for the existing Blynta clip workflow.
- `ProjectCollection`, `RecentProjects`: responsive grid, actual tabular list, and recent work.
- `ProjectsToolbar`: project search, source filtering, sorting, and accessible view controls.
- `ProjectsSkeleton`, `ProjectsEmptyState`, `ProjectsError`: layout-matched loading, first-use/no-results, and retry presentation.
- `ProjectThumbnail`, `ProjectActions`: thumbnail fallback, real metadata, and secondary actions within the redesigned project card.
- `project-display.ts`: shared source, duration, date formatting, and action types.

## 4. Components modified

- `StudioDashboard` / `DashboardWorkspace`: coordinates the new components, derives recent/filtered projects, and handles existing project actions with pending and error feedback.
- `ProjectCard`: flush 16:9 thumbnail, full-card editor link, restrained metadata, overflow menu, and missing/failed-thumbnail fallback. The placeholder uses the current theme and a small frame/timeline treatment rather than an isolated media icon.
- `NewProjectDialog`: supports a requested initial blank/upload mode, resets between dashboard launches, improves content spacing, and disables editing/dismissal during creation or upload.
- `useProjects`: exposes retry and fetching state, preserves cached projects during background failures, prefetches full editor detail on focus/hover, and invalidates/removes detail cache after rename/delete.
- Root layout: imports dashboard-specific CSS; remains a server component. Authentication layouts and editor components are unchanged.

## 5. Shared UI reused

`AppButton`, `AppLinkButton`, `AppInput`, `AppSelect`, `AppDialog`, `AppDropdown`, `AppCardRoot`, `AppSkeleton`, and shared Sheet primitives come from `@blynta/ui`. Existing Studio tooltip, theme, avatar/account, logo, and file-input adapters are reused. The tooltip adapter already delegates to shared UI primitives. No generic primitives or Studio business components were added to the shared package.

## 6. Routes and navigation

No permanent routes were added or removed. `/dashboard` remains the single project workspace; `/editor/[projectId]` remains the editor destination. “View all” links to the dashboard's project library. Back to Blynta uses the existing configured Blynta origin.

From Blynta opens a dialog with a link to the existing main-app `/my-clips` route. It explains the existing generated-clip **Edit in Studio** action, which already calls `/studio/from-clip`. When imported projects exist, the dialog can filter the Studio library to those projects. The dashboard does not copy or re-upload R2 media.

## 7. Existing functionality preserved

Blank creation, file browsing/drop uploads, aspect ratio selection, timeline save before opening uploads, editor links, search, source filtering, last-edited/name/oldest ordering, grid/list mode, rename, duplicate, and confirmed delete still use the existing APIs and flows.

TanStack Query keys, 30-second provider stale time, existing refetch behavior, and project-list invalidation remain intact. Recent work adds no project-list fetch. Editor prefetch uses the existing detail key and fetches the complete project; the listing's thumbnail-only media data is never substituted for playable editor data. Detail invalidation prevents a prefetched project retaining its old name after rename.

Authentication, logout, backend, billing, processing, AI, timeline, and export systems were not changed.

## 8. Responsive and accessible behavior

The sidebar is 232px on desktop and collapses to a 72px icon rail with tooltips. At 768–1023px it uses the icon rail automatically. Below 768px it uses a shared Sheet with keyboard focus management and close behavior.

The project grid adapts from one column below 640px to two on tablet, three on smaller desktop, four on ordinary desktop, five from 1800px, and six from 2400px. Single projects retain a normal column width. Mobile recent work uses a horizontally swipeable row; the full project library remains one column. List mode reduces secondary columns on narrow screens. Search takes the available width and moves to its own row when needed.

Keyboard focus, semantic editor links, navigation labels, a skip link, hidden select labels, icon tooltips, pressed view states, action menus, alerts, and reduced-motion handling are included.

## 9. Loading, empty, and error states

Loading uses static thumbnail/card skeletons for recent work and the main library. Quick-start and shell controls remain available. First-use presentation provides all three creation entry points and hides the unused search/filter controls. Search/filter misses offer Clear filters. Project-load failures retain the shell and show Retry. Background refresh failures keep cached work visible. Rename/delete failures stay in the dialog with an inline error; mutation buttons prevent repeated submissions.

## 10. Intentionally omitted functionality

There is no duplicate Home destination, standalone Studio My media route, global AI destination, notifications, help center, or fabricated project status. The actual media and AI tools remain inside projects. The sidebar states that location.

A new in-Studio generated-clip picker was not added: the existing browse-and-import workflow lives in the main Blynta application. Only actual metadata is displayed: project name, source, aspect ratio, edit date, thumbnail where available, and duration derived from the project's timeline.

## 11. Files changed

New source files:

- `app/dashboard.css`
- `features/studio/dashboard/components/StudioShell.tsx`
- `features/studio/dashboard/components/QuickStart.tsx`
- `features/studio/dashboard/components/ProjectCollection.tsx`
- `features/studio/dashboard/components/ProjectsToolbar.tsx`
- `features/studio/dashboard/components/ProjectsStates.tsx`
- `features/studio/dashboard/project-display.ts`

Modified source files:

- `app/layout.tsx`
- `features/studio/dashboard/components/StudioDashboard.tsx`
- `features/studio/dashboard/components/ProjectCard.tsx`
- `features/studio/projects/components/NewProjectDialog.tsx`
- `features/studio/projects/hooks/useProjects.ts`

This report and `dashboard-verification/*.png` record the result. Screenshots use isolated fixture projects, including the repository's existing illustration, rather than real account media. The temporary preview route and browser-check script were removed after verification; neither is shipped.

## 12. Verification

- Studio ESLint: passed.
- Studio TypeScript check: passed.
- Studio production build: passed; no preview route in the resulting route table.
- Existing `pnpm --filter @blynta/studio test`: passed editor/auth regression checks.
- Headless Edge browser checks: passed at 320, 390, 640, 768, 1024, 1280, 1440, 1920, and 2560px without page-level horizontal overflow.
- Browser interactions: passed sidebar collapse, mobile drawer, Blynta destination, search/no-results reset, source filtering, sorting, list view, rename/delete, mutation failure, single-project width, empty/loading/error states, retry, blank/upload entry modes, and theme switching. Final run reported no page exceptions or hydration errors.

Browser checks used a temporary isolated UI fixture and did not mutate a real account. Authenticated backend uploads, duplication, and generated-clip import were preserved by reusing their existing implementation but were not exercised against a live account in this pass.

Screenshots: [desktop](dashboard-verification/desktop.png), [mobile](dashboard-verification/mobile.png), [list](dashboard-verification/list.png), [single project](dashboard-verification/single-project.png), [empty](dashboard-verification/empty.png), [loading](dashboard-verification/loading.png), [dark theme](dashboard-verification/dark.png).
