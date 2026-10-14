# Authenticated application shell

## Audit

The existing `(main)` route group already contained Dashboard, AI Studio, My Clips and its detail routes, Publications, Calendar, Social Accounts, Profile, Billing, Activity, and legacy jobs redirects. Its server layout checked the session but did not render navigation. Each feature instead mounted `DashboardLayout`, which owned desktop collapse, the mobile drawer, and the invitation dialog. These states were local to each page and did not survive navigation.

`DashboardLayout` rendered the existing `packages/ui` sidebar and product header primitives. Pages supplied the header's entire content, including duplicated title, loading, and `DashboardHeaderRight` composition. AI Studio landing, editor, and editor error/loading states supplied no header content, leaving only the sidebar toggle. `DashboardHeaderRight` already reused credits, notifications, and the account dropdown; it did not need new data fetching. Sidebar profile observers and page observers used the same TanStack Query key. There was no persisted sidebar preference to migrate.

The root server layout already owned theme, tooltip, session, and query providers. Auth pages, recovery, share pages, auth callbacks, and API routes were outside `(main)`.

## Implementation

- `(main)/layout.tsx` now mounts one `AppShell` inside the existing session boundary. The root and authenticated layouts remain server components.
- `components/layout/AppShell.tsx` reuses the original desktop sidebar, mobile sheet, navigation schema, invitation dialog, and local collapse/drawer state. The persistent route layout owns their lifetime. One shell profile observer supplies both sidebar presentations and the header.
- `AppHeader` composes `AppProductHeader` with typed segment-based route metadata. Studio clip routes keep the section title “AI Studio”; clip/source breadcrumbs remain contextual feature content.
- `AppHeaderRight` reuses existing credits, notification queries/dropdown, and account menu. Credits retain loading/error presentation. The account menu falls back to session identity while profile data loads or fails.
- All feature-level shell wrappers are replaced by `PageContent`, which only owns content spacing and optional contextual content. Counts and source/clip breadcrumbs are preserved. No feature mounts global navigation controls.
- The editor retains its clip title, saved state, History/Media/Changes, previews, uploads, assistant, model selector, proposals, rendering, and download handlers. Only its content wrapper and compact toolbar styling changed.
- The shell uses `h-dvh`, flex sizing, `min-h-0`, and `min-w-0`. Ordinary pages scroll below the shared header. The editor fills the remaining desktop space and permits stacked content scrolling below the desktop breakpoint.
- Public URLs, route files, provider configuration, authentication behavior, and shared UI primitives are unchanged.

## Verification

The standalone app typecheck and production build pass. The relevant component suites pass: shared shell (18), sidebar navigation, clip sharing, and AI Studio (52 combined), totaling 70 tests. Tests cover each authenticated section's header, loading/error account controls, segment-safe metadata, shared collapse/drawer state, notifications, account destinations, contextual editor actions and preview switching, absence of feature shells, and public/provider boundaries. Hook-isolated state tests establish component ownership; they do not replace authenticated browser navigation testing.

The app-wide lint run encounters existing errors in auth/query code, invitation/profile components, and CommonJS scripts. Changed application source and the new shell/fixture harness pass lint with zero errors and four existing warnings (an image element in source details and three unused values in Publications).

Browser verification used the local `preview-app-shell.cjs` fixture, which renders the production shell and actual editor with mocked account/editor queries. Screenshots were inspected for Home, AI Studio landing, AI Studio editor, My Clips, and Billing. The shared header measured 56px, rendered once, and included credits, notifications, and user menu. The editor had no horizontal overflow at 375, 640, 768, 1024, 1280, 1440, or 1920px. At desktop widths and 900px height, the prompt composer's bottom was 884px.

The production app redirects the browser to the existing sign-in service. No authenticated browser session was available, so screenshots of live account-backed pages, hydrated drawer/menu interactions, real media playback, and actual client-navigation provider lifetime remain unverified. The fixture uses server-rendered markup and is explicitly a visual check, not an end-to-end test. No authentication bypass or public preview route was added.

To reproduce: `npm --prefix apps/app run test:app-shell`; `node apps/app/scripts/preview-app-shell.cjs` (loopback port 4318). The fixture serves `/dashboard`, `/studio`, `/studio/clip-preview`, `/my-clips`, and `/billing`.
