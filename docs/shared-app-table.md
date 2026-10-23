# Shared Activity-style AppTable

## Extraction and migrations

Activity's existing layout is the source of truth. `AppTableRow` moves its exact row markup and classes into shared UI: icon container, wrapped title/badge line, description, optional metadata, timestamp and action slots. Icon selection, category/status rendering, metadata formatting, URL validation, relative time and action handlers remain in `ActivityItem`. The action button class string is exported once as `appTableRowActionClassName`.

`AppTable<T>` owns the existing AppCard container, row separators, fetching opacity, stable keys, loading/error/empty slots, and optional footer/pagination positioning. It accepts typed data, `getRowKey`, `renderRow` and an accessible label. Features retain all filters, API hooks and state. `contentRef` preserves Activity's existing scroll-to-list behavior. Disabled tables use native `inert`; pager buttons also receive their existing disabled prop.

`AppTablePagination` delegates to the existing `AppPagination` Activity variant. It adds no second pagination implementation and owns no page state. Existing `AppListSkeleton` and `AppListEmptyState` are reused rather than creating competing table skeletons/empty components.

Activity was migrated first and compared with the pre-extraction local page before changing Billing. Its filters, search debounce, refresh invalidation, category/status badges, metadata pills, URL safeguards, View/Manage actions and pagination clamping remain in the feature.

Credit History now uses `AppTable` and feature-owned `CreditHistoryItem`. The traditional table/header row is removed. Rows have transaction-specific icons, title, prominent credit amount, neutral Recorded indicator, description, date and a View video action for linked jobs. Other related references remain visible as complete reference text; no invented payment/Studio URL is introduced. Hold/release semantics and amount formatting are retained. The existing API hooks, backend filters, actual totals/page counts, page size and tab-state preservation are unchanged. Billing cards, checkout, accounting, prices and the backend were not changed by this extraction.

## Public files and API

New shared files, exported through `@blynta/ui`:

- `packages/ui/src/components/AppTable.tsx`: `AppTable`, `AppTableProps<T>`.
- `packages/ui/src/components/AppTableRow.tsx`: `AppTableRow`, `AppTableRowProps`, `appTableRowActionClassName`.
- `packages/ui/src/components/AppTablePagination.tsx`: `AppTablePagination`, `AppTablePaginationProps`.

Migrated files:

- `apps/app/features/activity/components/ActivityPage.tsx`.
- `apps/app/features/activity/components/ActivityItem.tsx`.
- `apps/app/features/billing/components/CreditHistory.tsx`.
- New `apps/app/features/billing/components/CreditHistoryItem.tsx`.

The shared UI entry point exports all components/types. No package dependencies, table library, custom CSS, app imports, feature enums or business calculations were added to shared UI.

Example from a client feature (filtering and sorting remain outside):

```tsx
import { AppTable, AppTableRow } from "@blynta/ui";

<AppTable
  label="Records"
  data={records}
  getRowKey={(record) => record.id}
  renderRow={(record) => (
    <AppTableRow
      icon={recordIcon}
      title={record.title}
      description={record.description}
      badges={renderBadges(record)}
      timestamp={formatDate(record.createdAt)}
      action={renderAction(record)}
    />
  )}
  isLoading={query.isPending}
  isFetching={query.isFetching}
  emptyState={emptyState}
  pagination={{
    page,
    totalPages: result.totalPages,
    total: result.total,
    pageSize,
    visibleCount: records.length,
    itemLabel: "records",
    onPageChange: setPage,
  }}
/>;
```

Use `AppTablePagination` separately when composing a different layout. Server totals, page counts and page size must be supplied by the consuming feature; AppTable does not fabricate them. A row is not a clickable div: callers supply real links/buttons for keyboard-accessible actions.

## Other frontend table/list audit

No additional pages were migrated. These layouts intentionally retain their current behavior:

| Surface  | Inspected implementations                                                                                                                                     | Reason to retain                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin    | `components/common/DataTable.tsx`; users, jobs, clips, billing records, audit, analytics, system health/failure notifications, AI provider/model/usage tables | Already share a typed column-table implementation with sorting, column visibility, row navigation and page-size controls. Activity's row slots would remove useful cross-column comparison or require unrelated feature changes. |
| Admin    | `admin-dashboard/components/RecentActivity.tsx`                                                                                                               | Despite its name, this is a worker queue metrics table with multiple numeric columns, not an event feed. Already uses shared table primitives.                                                                                   |
| Admin    | `admin-billing/components/CreditDetails.tsx`                                                                                                                  | Dense ledger inspection includes distinct product/type/amount columns and surrounding adjustment tools; existing shared table primitives are appropriate.                                                                        |
| Studio   | `studio/dashboard/components/ProjectCollection.tsx`, project/media cards and editor media lists                                                               | Thumbnail/project layouts, editor prefetch/actions and media drag/drop differ from Activity. Replacing them would redesign unrelated interfaces.                                                                                 |
| Main App | `dashboard/components/JobCardList.tsx`, jobs/clip library layouts                                                                                             | Thumbnail, duration, processing-progress and action-menu layouts have a different hierarchy and interactive behavior.                                                                                                            |
| Main App | Notifications `NotificationList.tsx` / `NotificationItem.tsx`                                                                                                 | Shared compact dropdown/full-page notification presentation includes unread state, dismiss/mark-read actions and bounded scrolling; migrating would change established behavior. A future dedicated audit feed can use AppTable. |
| Auth     | Forms, provider/account controls                                                                                                                              | No tabular record/history surface to migrate.                                                                                                                                                                                    |

The Admin AI module currently imports its existing `AppDataTable` under a local `AppTable` alias. It remains its column-table implementation; it does not import or conflict with the new shared row component. No dense column variant was added because existing infrastructure already meets those pages' needs.

## Verification

- Local Activity before/after comparison: **identical row HTML, pagination HTML and geometry**. The sample desktop row remains 81.5px high and 1214.4px wide; pagination remains 68.8px high with unchanged x/y positioning. This is a DOM/class and geometry comparison, not a claim of automated pixel-perfect image comparison.
- Saved screenshots: `.test-results/activity-before-desktop.jpg`, `activity-after-desktop.jpg`, `app-table-credit-history-dark.jpg`, `app-table-credit-history-mobile.jpg`. DOM/geometry evidence: `.test-results/app-table-activity-comparison.json`.
- Browser checks: Activity and Credit History at desktop and 390px widths; light/dark themes; row wrapping; stacked filters; existing mobile timestamp/pagination positioning; history page navigation. Credit History no longer needs horizontal column-table scrolling. Preview data is explicitly labeled as local fixtures, not production purchases.
- `node --test scripts/tests/billing-ui.test.mjs`: **24/24 pass**. Added coverage checks different data schemas/stable keys, empty/loading/error/disabled states, server ranges, absent column headers, credit holds/releases/references/job actions, Activity badges/metadata/View/Manage links, safe URLs, controlled filters, debounced search, refresh and clamped pagination.
- TypeScript: **Main App, Admin, Auth, Studio and shared UI pass**.
- Targeted ESLint: **Activity components, CreditHistory/CreditHistoryItem and all three new shared components pass with no warnings**.
- Main App production build: **pass**, including compilation, TypeScript and static page generation. Other apps were typechecked; their production builds were not rerun for this extraction.
- Import audit: **738 authored frontend files; zero introduced cycles**. The existing jobs/dashboard/YouTube barrel cycle is unchanged. Shared table files have no app/feature dependencies.
- `git diff --check`: pass.

The earlier constants audit remains documented in `frontend-constants-audit.md`; its 734-file inventory and test results describe that earlier checkpoint. This extraction supersedes its traditional Credit History table presentation. Existing unrelated lint/shell/download-harness limitations recorded there were not changed or claimed fixed here.
