# AI Studio redesign: design review

Date: 16 October 2026. Status: direction approved by the user; implementation and synthetic verification recorded in `ai-studio-redesign-results.md`.

## Evidence and scope

The initial review inspected the repository before application changes. At that point, the attachment contained the brief only. Existing repository screenshots `docs/ui-audit-evidence/app-clips-ready-1440.png` and `app-clip-detail-ready-1440.png` were inspected as historical visual context, not as evidence of the current rendered application.

Update after approval: all four reference screenshots were supplied and inspected. They confirm the My Clips grid's bordered cards, divided metadata footer, 16:9 thumbnails and shared toolbar; the list's compact thumbnail/title/action alignment; the listing's redundant empty Continue editing section; and the editor's excessive preview surround, narrow conversation and repeated clarification. The implementation follows the proposed My Clips geometry and removes the standalone recent section. The results document records editor changes and validation.

### Mandatory page audit

| Area | Implementation inspected | Established pattern / implication |
| --- | --- | --- |
| My Clips grid and list | `apps/app/features/jobs/components/ClipsLibrary.tsx`, `SourceVideoCard.tsx`, `ClipsLibrarySkeleton.tsx` | Primary reference: divided heading, compact action, bordered toolbar, segmented filters, bordered thumbnail cards and rows. Grid and list share a single card component. |
| My Clips details | `SourceVideoDetails.tsx`, `ClipDetailView.tsx`, `clip-detail/ClipHeader.tsx`, `ClipPreview.tsx`, `VideoWorkspaceDialog.tsx` | Compact context/action header; dominant media with supporting information; contextual menus and shared dialogs. Cached job data avoids blanking detail navigation. |
| Home | `apps/app/features/dashboard/components/DashboardHome.tsx` | `PageContent`, 24/30px heading, muted description, shared buttons, section-specific loading and error handling. Home's larger generation input is purpose-specific, not a chat composer reference. |
| Publications | `apps/app/features/youtube/components/PublicationsPage.tsx` | Shared small tabs, restrained metadata, status badges, bordered cards and contextual retry. Its heading is smaller than My Clips; My Clips wins for this redesign. |
| Activity | `apps/app/features/activity/components/ActivityPage.tsx`, `ActivityFilterBar.tsx`, `ActivitySkeleton.tsx` | Same My Clips heading lockup; wrapping filter/search toolbar; distinct filtered and first-use empty states; skeletons shaped like rows. |
| Billing | `apps/app/features/billing/components/BillingPage.tsx` | Same strong heading family, muted supporting text, responsive bordered surfaces, local skeletons. Billing-specific highlight treatments are not needed in AI Studio. |
| AI Studio listing | `apps/app/features/ai-editor/StudioLanding.tsx`, `StudioClipCard.tsx` | Currently a separate borderless gallery: weaker heading, extra nested width/spacing, no primary action, no list mode, separate recent section. Replace with My Clips structure. |
| AI Studio editor | `StudioWorkspace.tsx`, `StudioSessionSidebar.tsx`, `StudioPreviewPanel.tsx`, `StudioConversation.tsx`, `ProposalCard.tsx`, `StudioPromptComposer.tsx`, `StudioLibraryPanel.tsx` | Session controls and preview pipeline exist. Chat is fixed at 320–380px; preview takes remaining width; repeated status surfaces and a separate tools footer weaken hierarchy. Preserve behavior while reorganizing presentation. |
| Authenticated shell | `apps/app/app/(main)/layout.tsx`, `components/layout/AppShell.tsx`, `AppHeader.tsx`, `PageContent.tsx` | Authentication boundary, one global header/sidebar, workspace viewport ownership, mobile navigation Sheet. Editor must fit this shell. |
| Shared UI | `packages/ui/src/components`, `primitives`, `styles/theme.css`, `player/StudioVideoPlayer.tsx` | Existing tabs, inputs, selects, pagination, buttons, dialogs, sheets, dropdowns, skeletons and player. Reuse directly. |

### Specific design contract

| Pattern | Reuse / target |
| --- | --- |
| Content width and spacing | `PageContent`: `max-w-7xl`, 16px mobile / 32px larger horizontal padding, 24/32px vertical padding, 24px section spacing. Remove the listing's nested container and 36px section rhythm. |
| Heading | My Clips' `text-2xl sm:text-3xl font-extrabold tracking-tight`, description `mt-1 text-xs sm:text-sm text-muted-foreground`, 16px bottom padding and `border-border/60` divider. Title: **AI Studio**. Description: **Create and manage AI-powered edits for your clips.** No title icon. |
| Primary action | My Clips' `AppButton`, default variant, small size overridden to `h-9`, semibold, small shadow, plus icon; right aligned from medium widths and below heading on small screens. Label: **New AI Edit**. |
| Toolbar | `AppCard` with My Clips' default `AppTabs` at left, `AppInput` search, `AppSelect` sort and `AppViewModeToggle` at right; wraps without a fixed minimum overflowing narrow screens. |
| Grid | My Clips' 1 / 2 / 3 / 4 columns at base / sm / md / xl, 16px gap; 16:9 thumbnail, duration at lower right, 16px body padding, two-line semibold title, muted 11–12px metadata, divided footer with state and menu. |
| Card surfaces | `AppCard`: `bg-card`, `text-card-foreground`, `border-border/80`, `rounded-lg`, `shadow-xs`; My Clips hover border and shadow. Match the existing card appearance precisely. |
| List | My Clips' 112×64px thumbnail, 144×80px from sm, 14px content gap, 10px row separation, shared card padding; metadata beside thumbnail, primary action and menu at end. Natural height, wrapping actions on mobile. |
| Interaction | Shared primary/outline/ghost buttons, ring tokens for focus, disabled and pending states. Main navigation is a real link with accessible name; menu remains a separate interactive element. Avoid nested buttons/links. |
| Status | Shared Badge primitive and My Clips' compact metadata scale. One project status plus last edited date; no invented numerical render progress. Use primary, muted and destructive theme tokens. |
| Empty/error states | Bordered `AppCard` and existing `AppQueryState` conventions: title, concise explanation and action. Distinguish no projects, no eligible clips, no matches and load failure. |
| Skeletons | Shared `Skeleton` / `AppSkeleton`; My Clips card/row geometry; editor-specific session rows, preview frame, message lines and compact composer. Keep content during background refetch. |
| Dialogs/drawers | `AppDialog` for searchable clip selection; `AppSheet` for sessions and contextual tools at narrow widths. Retain focus trapping, Escape dismissal, labelled titles and return focus. |
| Typography/theme | Existing Inter-based sans stack; monospace only for duration/time. `background`, `card`, `muted`, `border`, `primary`, `destructive`, `ring` and `sidebar-*` tokens, including dark mode. No new palette. |

`AppMediaCard` already exists, but its rounded-xl surface and stronger shadow differ from `SourceVideoCard`. Do not substitute it unchanged. Start with `AppCard` and a small thumbnail/body/metadata/actions composition extracted from My Clips only where it removes actual duplication. Leave source-job badges and actions in My Clips; Studio cards represent individual clips, not source jobs.

## Proposed listing hierarchy

```text
AppShell (existing)
  PageContent
    Heading + description + New AI Edit
    AppCard toolbar
      AppTabs: My Projects | All Clips
      AppInput search + AppSelect sort + AppViewModeToggle
    Active tab panel
      matching skeleton / error / empty state
      Studio media cards (grid or list, My Clips geometry)
    AppPagination
    ClipSelectionDialog (AppDialog, searchable paginated clip rows)
```

Default to **My Projects**. Keep tab, search, sorting and page state coherent; reset pagination on filter changes. Persist Studio's view preference with the existing `useViewMode` convention. Both tabs have their own meaningful sorting: last edited/newest project/oldest project for projects; newest/oldest clip for clips. Preserve each tab's controls when switching where practical.

Project cards show title, thumbnail, last edited date, state and Open project. Use **Preview ready** only for a completed preview matching the authoritative plan revision; **Rendering** for that revision's active render; **Render failed** for its failed render; **Changes pending** when saved edits lack a current preview. An untouched initialized plan can say **Ready to edit**. Conversation counts are optional and should be omitted unless returned by the listing query; avoid one request per card. Context menu: Open project and View original clip. Do not invent project deletion or archive semantics.

All Clips shows eligible completed clips with Edit with AI or Open project when known. No standalone Continue editing section. No-project empty state: “No AI projects yet” with “New AI Edit”. No-clip empty state links to Create New Clips. Filtered empty states offer Clear search.

## Project and conversation data flow

1. Keep EditPlan as the editing project. Do not add a Project collection. Scope all reads and mutations to the owner.
2. Extend the existing plans listing beyond `recent()`: it currently caps at 25 before availability checks and returns no search/pagination metadata. Add server-side search, stable sorting, totals and pagination over canonical available projects, before page slicing. Do not client-filter the latest 25 and call it a complete project list. Include current-revision preview status and usable clip metadata; batch joins rather than per-card lookups.
3. Reuse the current eligible-clips query, which searches all completed clips server-side and paginates 12 per page. Retain server ordering; do not copy My Clips' current-page-only search/sort behavior. If adding project associations to All Clips, return them in the listing query rather than inferring absence from a partial project page.
4. My Projects opens its known EditPlan directly, validates ownership and the clip association, then loads conversations. All Clips and the picker use the existing initialize workflow: reuse an existing plan or create the canonical one. Opening any project must never create a conversation.
5. Preserve `useStudioPreferences` account/clip-scoped selected conversation and per-conversation drafts. It currently uses sessionStorage, so restoration is within the browser tab. Fall back to an available session if selection no longer exists. New Chat is explicit; first prompt may create the initial conversation through the existing workflow.
6. Keep plan queries keyed by plan ID and conversation history by session ID. Switching a conversation changes history/draft, never replaces the authoritative plan with an old proposal snapshot.
7. Retain initialization's existing-plan lookup and partial unique index on canonical Studio initialization. That index does not imply every historical plan is unique: resolve legacy duplicates consistently without destructive cleanup or silently selecting different plans in different entry points.
8. Refresh affected listing, plan, session and version caches after edits. Keep previous paginated data visible during fetch, with a subtle busy state and disabled pagination where appropriate; do not allow stale rows to perform misleading actions under new filters.

## Proposed editor hierarchy and responsive behavior

```text
AppShell (existing global navigation/account controls)
  PageContent workspace
    Compact project header: Back, title, save state, Sessions toggle
    Workspace body
      StudioSessionSidebar (optional desktop column / narrow-screen Sheet)
      Preview and conversation split
        StudioPreviewPanel
          Compact toolbar: Original | Edited preview; History, Media, Changes
          Aspect-aware shared StudioVideoPlayer
          Single integrated status/progress + Download / retry as appropriate
        Conversation panel
          Compact conversation heading
          Typed message stream / proposal review
          Compact integrated StudioPromptComposer
```

Use workspace **available width**, not viewport width alone: the global sidebar can consume 240px. Proposed fit rules to validate during implementation:

- At least 1200px of available workspace: optional 192px session column; remaining width splits approximately 55/45 between preview and chat. Chat stays at least 400px wide.
- 880–1199px available: sessions move into a Sheet, with preview and chat side by side; chat at least 380px. A collapsed global sidebar can make this layout viable at narrower viewport sizes.
- Below 880px available (including tablet and mobile): shared Preview / Chat tabs, one visible panel at a time; sessions in a Sheet. Tools open a right Sheet on desktop and a bottom Sheet on small screens. Never two permanent contextual sidebars.

Measure the container or use container queries; avoid encoding these as viewport-only Tailwind breakpoints. Global mobile navigation stays owned by AppShell. Respect dynamic viewport height, safe-area inset and visualViewport keyboard changes; scrolling belongs to the conversation or preview, with composer kept reachable.

The preview should fit the actual media ratio inside a viewport-height budget, with a quiet `muted` surround. Portrait footage remains tall and centered; landscape expands horizontally without cropping. The shared player's current default is `aspect-[9/16]` and its controls overlay footage. Make a backward-compatible player option for actual aspect ratio and docked controls outside the image; existing callers keep their current behavior. Reuse playback logic, scrubbing, volume, speed, loop, fullscreen and authorized-link recovery. Remove redundant preview badges from the image when the adjacent tabs already identify it.

Keep one toolbar and one status region around the player. Show actual backend stage/progress when available, otherwise show the stage with indeterminate progress. Preserve an explicitly selected historical preview, label its revision clearly, and never auto-switch to an outdated completed render. Download belongs beside preview controls and identifies which preview is being downloaded.

## Conversation and composer

The current backend intentionally persists an assistant message with `proposalId` and the proposal summary. `conversationItems` links them, but `StudioConversation` suppresses the message only on exact string equality. That is a fragile duplicate-prevention rule; the supplied screenshot case cannot be reproduced from the missing screenshots alone.

Render linked assistant/proposal content as one semantic item by proposal ID and status. A clarification has one concise question and a response action that focuses the usable composer; retain its associated user request and pass the response through the existing conversation. Ordinary explanations remain plain readable text; user messages use a restrained muted bubble; pending proposals get a compact bordered review with Apply/Reject/Revise; applied changes collapse to a concise saved summary; progress is a small live status; errors have an inline retry. Preserve genuinely distinct assistant context rather than globally hiding equal strings. Handle orphaned proposals, repeated pages and polling updates by stable IDs. Add focused regression cases for these mappings.

Retain `AppTextarea`, attachments, upload validation, model selector and `AppButton`. Start the textarea at roughly two lines, grow to 128px, and use one shared bordered surface with focus-within ring. Attach/model controls sit on the lower left, Send on the right. Keep Enter to send, Shift+Enter for newline, composition-event protection and a mobile-friendly explicit Send action. Retain drafts, upload retry and same-submission retry identity. Composer loading must be compact and match its actual geometry.

## Preview pipeline constraints

Preserve the current separate Apply and Render endpoints and their ownership, revision and admission checks. Only a successful non-no-op Apply advancing the expected revision requests an automatic preview. Retain render locks, backend job deduplication, current-revision checks, failed-render retry and recovery of the Apply-to-Render gap after refresh. Session changes must not reset project render state. A failed render request retries rendering without reapplying the proposal. Keep TanStack Query cache updates and polling; broaden listing invalidation where preview status requires it.

## Incremental implementation and validation after approval

1. Listing: canonical paginated projects query, shared toolbar/tabs, My Clips-matching grid/list cards, picker and empty states. Show populated, empty, filtered and loading screenshots alongside My Clips in both view modes. Verify existing-project open and idempotent initialization.
2. Editor structure: fit-based split, compact project header, 192px collapsible sessions and Sheets. Show desktop/tablet/mobile layouts; verify create/switch/rename/archive/resume and unchanged authoritative revision across session switches.
3. Conversation: typed rendering, stable clarification association, compact proposal review and composer. Show each message state; test deduplication, drafts, IME, keyboard, attachments and safe retries.
4. Preview: compact toolbar, aspect-aware shared player, docked controls, one status region and preserved workflow. Verify portrait/landscape, captions, fullscreen, history selection, download, failed/no-op Apply, duplicate clicks, conflicts, failed render retry, refresh recovery and stale completion.
5. Loading/accessibility/regression: layout-matched skeletons, cached refetch, focus order, tab keyboard behavior, labelled menus, drawer focus restoration, readable live announcements and reduced motion. Verify 375, 640, 768, 1024, 1280, 1440 and 1920px viewports, short heights, both global sidebar states and light/dark themes. Run relevant frontend/backend tests, type checks and lint; record limitations separately from passed checks.

At every checkpoint, present visual evidence and validation before proceeding to the next review. Design approval starts checkpoint 1; this document does not claim implementation or runtime verification.
