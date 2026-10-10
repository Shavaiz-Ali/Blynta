# UI/UX audit and correction report

## Pre-implementation audit — 2026-10-10

The shared package was inventoried before changing pages: exports, every component/primitive/player interface, theme tokens, package scripts, and existing application adapters. Its source exports are consumed directly by Next; it has typecheck/lint scripts and no standalone build script. Both apps transpile the package and scan its source with Tailwind v4.

1. **Existing components:** AppButton/link buttons, AppInput, AppTextarea, AppSelect, AppDialog, AppTabs, AppDropdown, AppPopover, AppTooltip, AppDisclosure, AppFileInput, AppCard and compound AppCardRoot/Header/Content, badges, skeletons, spinners, sheets, sliders, scroll areas, shared workspace/header/account controls and video players. Inputs support labels/errors; buttons support loading; selects support descriptions/disabled options. Base UI supplies accessible interactions.
2. **Admin duplication:** most local UI files already re-export shared primitives. Table, textarea, switch, sidebar, command, chart and input-group remain local implementations. Sidebar and chart are admin-specific compositions; table and switch are reusable primitives. The compatibility `common/primitives` module bypasses AppButton/AppInput wrappers. ThemeProvider duplicates the shared next-themes adapter. DataTable owns generic sorting/pagination/column visibility and can remain an admin adapter while consuming shared controls.
3. **Main duplication:** common controls and UI primitives are overwhelmingly compatibility re-exports, not duplicate implementations. New AI screens instead use raw native selects/buttons/textarea and primitive Button. ModelSelector duplicates styling already provided by AppSelect. ThemeProvider duplicates the shared adapter. Domain-specific proposals, upload and editing logic belong in the app.
4. **Styling inconsistencies:** admin repeats the shared token definitions in global CSS; imported values are the same theme, not intentional different branding. Admin mixes tiny uppercase labels with standard card typography. AI model errors use prominent destructive text without a compact settings boundary. New Studio sections are independent bordered blocks with insufficient workflow hierarchy.
5. **Missing shared primitives:** table and switch exist in admin but not the package; generic empty/error state is absent. Shared pagination is absent; a small controlled pagination component can replace local row-count/page controls. No new button/select implementation is needed. AppSelect lacks a form `name`/accessible label API needed by uncontrolled management forms.
6. **Layout root causes:** compound dashboard cards incorrectly render AppCardHeader and AppCardContent inside convenience AppCard, which wraps children in a flex content row. This creates nested content and competing horizontal widths; charts and activity lists lose their expected full-width block boundary. Several card headers force a trailing action grid at mobile widths, KPI growth competes with titles, and recent activity fixes timestamps beside long content. Admin content clipping masks overflow instead of containing it. Studio has an unbounded conversation/composer, full competing asset/history blocks, and initial plan errors presented inside a large unfinished canvas.
7. **Ownership/migration:** use AppCardRoot for compound composition, preserving AppCard defaults. Move generic table/switch/pagination/error-state presentation to the existing package, retaining compatibility re-exports. Use shared AppButton/AppInput/AppSelect/AppTextarea in domain screens and forms. Keep chart, sidebar, authorization, query/mutation and AI workflow logic in their apps.

## Coverage and implementation evidence

The supplied attachment describes three screenshots but contains no image files. Comparison therefore uses the described defects and actual local renders, rather than a pixel comparison. Backend contracts, model permissions, credits, proposals, storage and rendering were preserved.

### Shared controls and root causes

- Compound dashboard cards now use **AppCardRoot**, with separate header/content boundaries. The convenience AppCard still has its original defaults. This removes the horizontal wrapper that compressed chart headings, metrics, queues and activity.
- **Tabs** used a `data-horizontal` class despite emitting `data-orientation="horizontal"`. It also did not forward orientation to Base UI. The corrected root stacks horizontal lists above content and forwards orientation; vertical layout remains supported. Real screenshots revealed this defect in both management tables and Studio history.
- **AppSelect** now supports form names and explicit accessible labels. Selected labels are derived from options or custom item children before the popup mounts. Uncontrolled selection updates its label as users change values. Existing management forms still submit provider/credential IDs through native FormData.
- Generic **table and switch** primitives moved into the shared package. Admin compatibility files re-export them. New controlled **AppPagination** and semantic **AppQueryState** replace duplicated pagination and error presentation. Business logic stays in feature adapters.
- Card boundaries use `min-w-0`; dialogs have a viewport height limit and a scrollable body. Shared theme providers replace identical wrappers. Admin's duplicated token declarations were removed; the existing shared values are retained.
- Queues used a fresh Date in server and client rendering, causing a hydration mismatch. The timestamp now uses query `dataUpdatedAt` and an initial “Awaiting telemetry” state.

### Admin route coverage

All existing admin route sources were inspected: overview `/`; users `/users` and `/users/[id]`; jobs `/jobs` and `/jobs/[id]`; `/queues`; `/billing`; `/analytics`; `/audit`; `/clips`; `/system`; `/notifications`; `/settings`; `/feature-flags`; AI overview `/ai` and `/ai/providers`, `/ai/models`, `/ai/usage`; and `/login`.

The browser fixture renders the real feature components and real admin sidebar/topbar at the same layout boundary. Its 17 views cover the authenticated routes above, with `/ai` represented by the providers view. Login was source inspected. Navigation destinations and permissions were preserved.

KPI titles, values, trend badges and descriptions now occupy separate normal-flow rows. Values can wrap for large counts; cards reflow from one to two to four columns. Chart headers place range controls beside or below their descriptions. Queues use shared tables with local horizontal scrolling. Activity titles/actors wrap and mobile timestamps sit below them. User, job, billing, audit and analytics filters use AppSelect. Existing table sorting, column visibility, pagination and row navigation remain intact.

AI providers/models/usage use shared controls and proper vertical tabs. Create/edit dialogs group model identity, generation/pricing, task/capability and plan-access settings. Dialog bodies scroll within the viewport. Credential forms preserve write-only secret handling; stored secrets are never rendered. Empty, loading and retry states are distinct.

### Main app coverage and workflow

Dashboard, My Clips, clip details, Studio landing/workspace, billing, profile, publications and relevant dialogs were inspected. The browser fixture renders these eight real feature views with the existing dashboard shell. Existing shared controls on unrelated screens were retained.

**Hero:** URL and highlight style remain first. A compact model/customization row follows them, with Review & Generate as the primary action. Premium users choose Auto or registered authorized models; Free users see automatic routing. Credit estimates still require a separate confirmation and recheck before job creation. The generation payload and operation UUID are unchanged.

**Studio:** the preview and editing assistant form two desktop panels and stack on small screens. Vertical media uses `object-contain` in a stable viewport-aware stage. The assistant header contains model selection, the transcript/proposals scroll independently, and the composer remains at the bottom of its bounded panel. A workflow strip distinguishes prompt, review/apply, render and refine. User messages and AI responses have distinct presentation; proposals show readable effects/timestamps with apply/reject controls. Applying changes continues to save the plan without automatically rendering.

History/assets now share a compact tabbed library below the preview. Existing preview selection, cancellation/retry, upload, asset reference and signed download actions remain available. History explicitly states that viewing an older preview does not restore the editable plan. Initialization failures show a retry state and original clip access instead of a large inactive workspace. Raw network/HTTP messages are converted to useful service-error text; revision and rate-limit handling are preserved. Profile failures now stop the spinner and offer retry.

### Verification method and reproducibility

Visual checks run installed Chrome through bundled Playwright. Native browser automation could not initialize in this environment, so the checks use a headless browser. Real Next.js components/CSS render at **375, 640, 768, 1024, 1280, 1440 and 1920px**. HTTP/session boundaries are mocked with synthetic example.test data; no live backend, credentials, provider calls or real billing actions are used.

`ui-audit-fixtures.cjs` creates temporary development-only `/auth/ui-audit` pages gated by development mode and `UI_AUDIT_PREVIEW=1`. They are removed before builds. `ui-audit-data.cjs` contains synthetic responses; `ui-audit-browser.cjs` checks document width and browser errors across views/widths and exercises model forms and apply/render/download/assets. `ui-audit-interactions.cjs` checks hero selection/confirmation/payload, mobile navigation/filtering, rejection/prompt submission, lower dashboard sections and dark Studio playback.

To reproduce: first provide a synthetic H.264/yuv420p MP4 at `apps/app/public/ui-audit-video.mp4`, then run `node docs/ui-audit-fixtures.cjs`. Start the two apps on 4100/4101 with `UI_AUDIT_PREVIEW=1` and run the browser, interaction and gallery scripts from the repository root. The setup script copies the synthetic media into `public/auth` because Chrome downloads bypass Playwright interception; this uses an existing public prefix and changes no authorization rules. Run the fixture script with `--clean` and stop the dev servers before builds. It removes its exact routes and both synthetic media files. Next.js development types can retain the removed preview route: clear only the generated `.next/dev/types` caches, then regenerate production types/build. The temporary routes/media are absent from the delivered application.

### Final checks — passed

| Check                       | Executed command / result                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared package typecheck    | `npm run typecheck` in `packages/ui` — passed. No standalone build script exists; both consuming app production builds passed.                                                                                                                                                          |
| Admin typecheck             | `npm run typecheck` in `apps/admin` — passed; production build also completed TypeScript checks.                                                                                                                                                                                        |
| Main typecheck              | `npm run typecheck` in `apps/app` — passed after final Studio retry change and route-type regeneration.                                                                                                                                                                                 |
| All consumers               | Root `npm run typecheck` — 9 successful packages, including Studio, identity, web, auth, API client and types.                                                                                                                                                                          |
| Production builds           | `npm run build` in `apps/admin` and `apps/app` — passed. Temporary audit routes absent. Initial stale development type references were removed, then builds rerun successfully.                                                                                                         |
| Scoped lint                 | Modified/new UI source in the shared package and both apps — passed. Final changed files were rechecked with `--max-warnings=0`. Node test/audit scripts also passed using the app config with CommonJS import and Next page-link rules disabled specifically for those Node harnesses. |
| Editing/UI regressions      | App `test:ai-studio` — 18 passed, including registered models, Free/stale entitlements, proposal revision safety, independent apply/render behavior, escaped text and shared card/tabs/select/pagination composition.                                                                   |
| Existing sharing/navigation | App `test:clip-sharing` — 3 passed; `test:sidebar-navigation` — 21 passed.                                                                                                                                                                                                              |
| Billing regressions         | Root `test:billing-ui` — 11 passed. Legacy test boundaries now provide verified model availability and target shared AppInput/AppButton; credit/estimate/duplicate-submit assertions remain intact.                                                                                     |
| SSR/auth regressions        | Root `test:product-ssr` — 18 passed; `test:session-expiration` — 10 passed.                                                                                                                                                                                                             |
| Final diff                  | `git diff --check` — passed. No backend changes.                                                                                                                                                                                                                                        |

**81 regression tests passed.** Tests exercise actual components/hooks or existing domain logic, with external transport/auth boundaries mocked. They do not prove a live provider or rendering/storage integration.

### Visual evidence — completed

`ui-audit-evidence/results.json` contains **185 successful page/state records**: 25 views × 7 widths, eight offline cases, the mobile model dialog and the applied workspace. All have matching document/viewport widths and no browser page errors. Table content scrolls within its container on small screens rather than shrinking into vertical text. The mobile model dialog measured 343 × 850px at x=16/y=75 within a 375 × 1000 viewport.

`interaction-results.json` records five passing flows: Hero model/style selection → credit confirmation → authorized job payload; mobile admin drawer and plan filter; Studio reject → prompt submission without rendering; lower dashboard chart/queue/activity review; and dark Studio media loading. An additional source-fetch failure check verified the Studio retry button at 375px (`source-offline-results.json`). Apply, explicit render, actual browser download and asset reference controls were checked through the full browser suite. The download fixture uses the existing attachment semantics of the signed R2 endpoint; no production download code was changed.

`gallery-results.json` records 24 additional captures for admin tables/detail/capability views and the remaining main-app screens. There are **70 PNG evidence files**, including two admin contact sheets. Representative evidence:

- [Admin overview, desktop](ui-audit-evidence/admin-overview-ready-1440.png), [below-fold queues/activity/charts](ui-audit-evidence/admin-overview-bottom-1440.png), [mobile overview](ui-audit-evidence/admin-overview-ready-375.png).
- [Admin gallery 1](ui-audit-evidence/admin-gallery-1.png), [gallery 2](ui-audit-evidence/admin-gallery-2.png), [mobile model dialog](ui-audit-evidence/admin-model-dialog-ready-375.png).
- [Hero, mobile](ui-audit-evidence/app-dashboard-ready-375.png), [credit confirmation](ui-audit-evidence/app-generation-confirmation-375.png).
- [Studio, desktop](ui-audit-evidence/app-workspace-ready-1440.png), [mobile](ui-audit-evidence/app-workspace-ready-375.png), [dark](ui-audit-evidence/app-workspace-dark-1440.png), [applied/rendered workspace](ui-audit-evidence/app-workspace-applied-ready-1440.png).
- [Studio initialization failure](ui-audit-evidence/app-workspace-offline-375.png), [source failure with retry](ui-audit-evidence/app-workspace-source-offline-375.png).

The screenshot review covered KPI/card/chart layout, lower overview sections, the 17-view admin contact sheets, mobile model forms and generation confirmation, video/assistant composition, assets and offline states. Development-tool overlays may appear in captures; they are not production product controls.

### Limits and remaining work

- Backend, real provider credentials, agent execution, FFmpeg jobs, signed R2 delivery and paid checkout were not exercised against live services. Synthetic transport fixtures prove UI composition and control/request behavior. Existing backend safeguards and contracts were not modified.
- Protected features were rendered through temporary development previews using the real feature components and shells. Mobile navigation destinations were checked; server authorization behavior is covered by existing regression tests, not an authenticated end-to-end deployment.
- Login was source inspected. Settings/feature flags retain truthful “not connected” states where the existing capability is unavailable; no backend functionality was fabricated.
- No supplied image files were available for pixel comparison. The actual renders were reviewed against the described overlap/clipping problems.
- No deployment, database migration or new production environment variable is required by this refactor.
