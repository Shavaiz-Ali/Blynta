# Blynta AI-native UX redesign

Implemented and locally verified on 2026-10-11. Changes extend the existing editing engine; they do not replace EditPlan, LangGraph, optimistic revisions, BullMQ, FFmpeg, private R2 storage, billing, or model authorization. The separately deployed apps/studio implementation is unchanged.

## Creation and customization

The dashboard now has one creation surface containing the link input, clear action, registry model selector, highlight-style dropdown, optional Customize action and Review & Generate. The selector uses highlight_detection availability, Auto remains the default, unselectable registry models are excluded, and free accounts cannot choose paid models or styles. Supported HTTPS YouTube/Vimeo hosts match the backend estimate contract. Field errors are announced and associated with the input.

Credit review, fresh estimate rechecking, operation UUIDs, reservation authorization and the actual job payload remain intact. Generation has no signed direct-upload endpoint; no unsupported video-upload action was added.

Guide your highlights replaces the explanatory settings cards with the shared textarea, meaningful example instructions, a character count and Done. Examples append without submitting. Paid focus instructions still use customPrompt; this is separate from the editing agent's prompt. The optional UI field is capped at 2,000 characters. Reopening preserves the draft.

## Studio discovery

AI Studio now starts with a compact header. Continue editing uses actual recent plans, owned clip titles/thumbnails supplied by the compatible recent-plans API extension, last edited dates and real preview status. Missing thumbnails use a neutral placeholder. Empty recent sections are omitted; at most eight recent cards are displayed.

Generated clips have consistent thumbnails, duration badges and prominent Edit with AI navigation. The existing initialization service creates or reuses the editing plan. Search, chronological sort and recent-edit filtering explicitly cover the current page of up to 12 jobs; recent-edit matching uses the last 25 plans. They are not presented as global clip search. Shared pagination remains beside results, with empty, no-match and retry states.

## Editor and shared components

The desktop workspace splits preview and assistant at the lg breakpoint. Mobile stacks the preview and assistant, followed by the secondary library. Conversation scrolling is independent and the composer stays within a bounded assistant panel. The large workflow stepper has been replaced with contextual proposal guidance and actual render status.

The feature uses AppButton, AppSelect, AppTabs and compound tab primitives, AppInput, AppTextarea, AppDialog, AppPopover, AppFileInput, AppCardRoot, AppPagination, AppQueryState, AppSpinner and existing skeleton/theme tokens. No competing control library was introduced.

StudioVideoPlayer from packages/ui/player replaces every native player in the AI editor, including initialization-error source playback. Original/edited switching uses shared tabs associated with the preview panel. Preview history and assets use the shared default tab style. Selecting an older render never restores or rewrites the plan.

Small shared-player enhancements are backwards compatible:

- Optional onError and ariaLabel props; initial loading and playback-error recovery.
- Focused-player keyboard shortcuts avoid intercepting chat input, buttons or tab navigation.
- The existing ClipMediaStage is focusable and retains its keyboard shortcuts.
- The existing scrubber supports pointer/touch input, keyboard arrows/Home/End and slider semantics.
- Compact controls wrap instead of truncating duration; volume becomes visible on keyboard focus.
- An empty player actions menu is omitted.

Feature presentation is separated into StudioPreviewPanel, StudioLibraryPanel, StudioPromptComposer and StudioClipCard. StudioWorkspace retains initialization, query/mutation coordination, submission UUIDs, approval/render locks and signed-link recovery. Existing validated proposal summaries and explicit Apply/Reject remain. Applying does not render. Rendering, cancellation, failed-render retry, version history and fresh signed download requests remain separate actions.

## Functional attachments and backend changes

The editing composer has Attach, suggestions, Send, multiline input, Enter/Shift+Enter with composition protection, counts, attachment chips and removal. Suggestions populate the draft. Attach provides Upload from device and Choose from your assets. File drag-and-drop does not capture ordinary text drops.

attachments.ts reuses the existing authorized Studio APIs: list/create project, register upload, signed R2 PUT, complete upload and poll project media validation. It prefers an existing AI Studio assets project, otherwise reuses another owned project, and creates a project only when no owned project exists and the user uploads a file. Concurrent uploads in one mounted workspace share the same destination promise. There is no project creation on page load or per upload.

Supported formats are PNG, MP3, WAV, M4A and OGG, with a 100 MiB editing limit per file and at most eight prompt attachments. JPEG, video and documents are rejected. PNG overlays remain limited to four megapixels by backend checks. Failed uploads retain the File for manual retry. Processing assets are polled until ready or failed; a failed validation poll offers an explicit check-again action. Files must be ready before Send is enabled. Removing a chip removes only the current prompt reference, never stored media.

The optional selectedAssetIds field is a compatible extension to POST /clips/:clipId/ai-edit/propose. It accepts at most eight distinct bounded IDs, rejects URLs, and participates in the existing idempotency fingerprint. Before resolving a provider/model or creating a session, the backend verifies access to the clip/plan and checks each selected asset belongs to the user, has exactly one ready record, and is supported image/audio with valid metadata and size. The permitted context remains the original engine's owned clip/plan plus the user's ready asset library; no cross-user asset/project access is added.

Selected IDs enter LangGraph as structured context. Asset tools recheck ownership/readiness and expose metadata without R2 keys or URLs. With attachments selected, newly referenced patch assets must belong to the selected set; existing plan assets remain available for preserving or refining current edits. The unchanged Phase 1 validator still checks media objects, ETags, timeline limits, aggregate resource budgets and optimistic revision updates before saving/rendering. Requests without selected IDs retain the previous behavior.

The second backend extension adds optional clipTitle, sourceTitle and thumbnailUrl metadata to the existing recent-plans response. It retains owned-source/deletion filtering and real latest-preview status.

Deploy the backend extension before the frontend. No new environment variable, database field migration or package dependency is required.

## Executed verification

| Check | Actual final result |
| --- | --- |
| Nine-package monorepo typecheck | Passed, 9/9 packages |
| Final shared-player standalone typecheck | Passed |
| Main app production build | Passed; temporary preview routes absent |
| Admin production build | Passed |
| Nest backend build | Passed |
| Frontend, sharing, navigation, billing and session regressions | 87 passed, zero skipped/failed |
| Engine, AI registry/agent, Studio and actual FFmpeg tests | 146 passed across 15 suites, zero skipped/failed |
| Scoped frontend/shared-player/backend ESLint | Passed |
| git diff --check | Passed |
| Real Chrome visual/geometry checks | 38 states/captures, no horizontal overflow or uncaught page errors |
| Real Chrome functional flows | 9 passed |

Backend regression ran with EDIT_FFMPEG_PATH and EDIT_FFPROBE_PATH set to the installed executables. Native integration rendered actual video/audio; Mongo/provider/R2 services were not used for a live end-to-end run.

The 87 frontend checks were run with node --test over the three apps/app regression scripts and scripts/tests/billing-ui.test.mjs, product-ssr.test.mjs, session-expiration.test.mjs and product-session-read.test.mjs. The billing harness was updated to resolve extracted relative TypeScript helpers; its consent/credit assertions were preserved.

Browser evidence is in ai-native-evidence/results.json and 38 PNG files. Dashboard, Studio landing and editor were inspected at 375, 640, 768, 1024, 1280, 1440 and 1920 pixels. Additional captures cover Customize, credit review, free gating, pagination, attached proposals, failed/validating uploads, dropped audio, completed previews, empty states, offline states, dark mode and the existing clip viewer. Screenshot inspection corrected duration truncation, mobile library order and prompt-example touch targets. No actual reference-image files were supplied; comparison used the structural brief.

Functional checks exercised credit review and payload, prompt persistence, free model/style gating, scoped discovery and navigation, attachment selection/removal, structured IDs, upload failure/retry and validation gating, rejected JPEG/audio drop, apply versus render, original/edited/history tabs, play/pause, seeking, fullscreen, a browser download event, rejection/follow-up prompts and keyboard playback in the existing clip viewer.

ai-native-browser.cjs drives real Chrome with synthetic authenticated HTTP/API/R2 fixtures. Synthetic media responses support byte ranges for real seeking. Production components contain no mocks. Temporary gated fixture routes, synthetic public media and generated fixture types were removed before production builds. The preview server was stopped.

## Limits and production prerequisites

The browser upload tests exercise the actual frontend registration/PUT/completion/polling code against synthetic transport; they do not certify Cloudflare R2 IAM/CORS or live media validation. The real deployment must permit signed PUT requests from the main app origin and run the existing Studio metadata worker. Provider prompts were checked through service/graph tests, not a paid live provider call.

The original backend/AI_EDITOR_AUDIT.md prerequisites remain: the full Mongo/JWT/Bull/private-storage workflow was previously blocked by local Mongo application-control restrictions; previously exposed Mongo credentials require rotation and were not read or reused here. Live R2 privacy/signing and deployment-host resource/crash behavior still require staging verification. Those prerequisites affect production certification, not the completed local UI implementation. Full repository lint was not rerun or claimed to pass; the audit records unrelated existing lint debt.

Existing project media quotas still apply. The frontend does not create new projects to bypass them. Destination reuse is deduplicated within a mounted editor; simultaneous first-ever uploads from separate tabs are not a server-atomic project creation operation because the existing creation API has no idempotency key. Manual retry after a failed PUT may register a new media record through that same existing API; pending/failed records remain governed by existing asset cleanup and quota policies.

Global clip-title search and server-wide editing-status filtering are not provided by the current jobs API. Their page-local scope is explicit in the UI. No direct generation upload, fake undo/restore, automatic proposal application/rendering, arbitrary media support or new editing capability was introduced.

The user subsequently requested committing and pushing this redesign, including its compatible backend extensions.
