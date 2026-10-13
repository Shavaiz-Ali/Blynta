# Admin theme audit and model dialog fix

The admin now follows the main app's typography, page heading hierarchy, bordered filter panels and table treatment. Changes are limited to `apps/admin` plus verification artifacts. No backend, environment, schema, dependency or API changes were made.

## Findings and changes

- Admin did not load the main app's Inter font or JetBrains Mono. Root layout now loads both using Next's font handling, with the same shared theme tokens. Browser checks confirm Inter on every inspected view.
- AI model dialog relied on content height and unconstrained flex shrink. The popup now has a bounded viewport height, a flexing form with hidden overflow, and one inner scrolling area. Header and footer remain stationary during focus changes. Task and capability fieldsets have explicit bounds and spacing.
- Shared admin tables used a native Columns disclosure, compact cells and undifferentiated headers. The existing DataTable now uses AppPopover/AppCheckbox for column visibility, shaded uppercase headers, wider cell padding and row spacing. Existing sorting, keyboard row navigation, pagination and actions remain available. Empty tables suppress redundant pagination.
- Shared page headings now use the main app's large heading, blue period and divider. Users, Jobs and Queues were migrated from independent headers to the shared component; other views already consume it.
- AI tabs, search and status controls share a bordered responsive toolbar. Billing, clip search, analytics and user/job filter panels use the same surfaces. AI provider actions have explicit spacing, model capability names are readable, and shared status badges use tinted pills.
- Topbar account control uses the shared identity avatar and popover; account information and sign-out remain accessible. Global admin scrollbars are thin and use neutral theme colors.
- Whole-admin lint identified synchronous state updates in the mobile sidebar breakpoint hook. It now uses useSyncExternalStore with a stable subscription and server snapshot to follow viewport changes without effect-driven state writes.

## Verification

- 34 real-browser route/viewport checks passed: all 17 admin views at 390px and 1440px. Coverage includes overview, users and details, jobs and details, queues, billing, analytics, audit, clips, system health, notifications, settings, flags, AI providers/models/usage. No page errors or horizontal document overflow were observed.
- Highlight detection was toggled on/off/on at both sizes. Popup height and position remained stable, and the title and Save button stayed within the popup. Column visibility also changed the actual rendered table.
- Provider, model and credential form workflows passed at 390px, 1024px and 1440px, including request failure/retry, partial-pricing/task validation and disabled adapters.
- 28 AI/Studio frontend regression tests and 18 production SSR regression tests passed. The SSR checks initially encountered sandbox filesystem restrictions and passed when rerun with the required filesystem access.
- Whole-admin lint and TypeScript checks passed. Admin production build passed with temporary preview routes removed.

Browser verification uses actual UI components with synthetic API and authenticated session responses. No production records, credentials or paid provider tests were changed. The screenshots use a temporary fixture URL, so its breadcrumb reads Details; real AI route breadcrumb behavior is covered by the existing regression test.

## Evidence

- [AI providers and themed filters/table](admin-theme-evidence/providers-1440.png)
- [Model dialog after highlight selection](admin-theme-evidence/model-highlight-1440.png)
- [Mobile model dialog](admin-theme-evidence/model-highlight-390.png)
- [Users](admin-theme-evidence/users-1440.png)
- [Billing](admin-theme-evidence/billing-1440.png)
- [Light theme](admin-theme-evidence/providers-light-1440.png)
- [Browser results](admin-theme-evidence/results.json)

The user requested committing these verified admin theme and dialog fixes.
