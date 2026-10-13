# AI Studio workspace redesign

Design brief — 13 October 2026, written before implementation.

## Problems in the current workspace

The supplied screenshot is the baseline to replace. Three permanent bordered regions divide one workflow into a preview card, assistant form and empty library. A detached model selector and technical unavailable message dominate the assistant. Render/download/revision labels compete with prompting. Fixed chat height wastes space and pushes secondary tools below the fold.

## Research and design inference

[Descript features](https://www.descript.com/features) presents text instructions as an editing entry point. Its [scene editor](https://help.descript.com/hc/en-us/articles/10165362727821) changes toolbars according to the selection. These suggest keeping tools contextual rather than permanently expanded. The direct requested Descript URLs timed out; official indexed pages supplied the research text.

[Runway Edit Studio](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio) places reference media and model choice near instructions, supports before/after comparison and separates input from output versions. The applicable inference is spatial proximity and progressive disclosure. Blynta retains deterministic supported operations and explicit proposal approval, rather than Runway's generative capabilities.

## Interaction model and architecture

One viewport workspace contains a compact title toolbar and two connected regions: a dominant neutral video canvas (about 60%) and a bounded instruction/conversation column (about 40%). One subtle divider separates them. The canvas footer owns rendering status and actions. Export appears only for a completed selected version. Saved state is compact; revision details live in history.

The assistant starts with a useful welcome and supported suggestions. Submission transitions to chronological messages and reviewable proposals. The unified compact composer owns attachment and model controls, retry, validation and Send. Automatic scrolling follows only readers near the bottom; readers looking back receive a new-message action.

History, owned media and proposal changes open in one contextual shared sheet: right-hand overlay on desktop, bottom sheet on mobile. They are absent from the main layout until requested. History previews do not restore plans. Changes display actual proposals only.

## Reuse strategy

Keep StudioVideoPlayer, AppButton, AppSelect, AppTabs, AppSheet/SheetContent, AppPopover, AppTextarea, AppFileInput and shared loading/query controls. Add feature compositions for the conversation and tools. Add an opt-in viewport mode to DashboardLayout without changing other pages. Keep existing queries, locks, idempotency, revision conflict checks, model access and upload lifecycle. No backend changes are planned.

## Main journey

Open clip → see original → describe supported edit / attach owned validated media → receive proposal → inspect operations and timestamps → Apply or Reject → explicitly Render preview → compare Original/Edited → download selected completed preview. History and further instructions remain available throughout rendering.

## Mobile

Stack a compact preview above conversation and composer. Use content-driven heights and dynamic viewport units rather than forcing desktop columns. The composer stays in document flow so keyboard resizing cannot conceal actions. Secondary tools use a focus-managed bottom sheet. Test all seven requested widths plus 390px, short desktop heights and reduced motion.

Implementation findings, screenshots and verification results will be recorded below after actual testing.

## Implemented architecture and before/after

The workspace now occupies the available application viewport, with a compact title toolbar and one connected canvas/conversation surface. The assistant is constrained to 360–480px; the canvas receives the remaining width. At typical desktop sizes this gives the requested approximately 60/40 balance. The portrait player scales to available height without stretching. The surrounding stage is neutral and has no enclosing dashboard card.

The supplied baseline's detached model selector, permanently expanded library, revision headline, disabled download button and separate render-status card were removed or relocated. Original/Edited is a compact comparison control; Edited is disabled until a real version exists. Rendering stays beside the canvas with accurate pending, progress, failure, cancellation and retry states. A completed preview uses one concise ready label and enables download. Selecting an older render does not restore the plan; paging through history does not change the selected preview.

On mobile the smaller canvas precedes the composer. Conversation follows it, and a Review suggestion action explicitly navigates to pending review. The normal document flow remains scrollable as viewport height shrinks. Desktop uses internal conversation scrolling; the composer remains available. History, Media and Changes open in a standard shared right sheet on desktop and a bottom sheet on smaller screens, with focus restoration and Escape handling.

## Components created and reused

| Composition              | Responsibility                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| StudioWorkspace          | Existing API orchestration, request/approval/render locks, signed URL recovery, compact toolbar and workspace shell |
| StudioConversation (new) | Welcome suggestions, chronological messages and linked proposals, reader-aware scrolling and new-message navigation |
| conversation.ts (new)    | Pure proposal/message ordering and near-bottom scroll policy                                                        |
| StudioRenderStatus (new) | Real asynchronous status, reported progress, cancellation and retry; completed status moves to canvas footer        |
| StudioPreviewPanel       | Neutral canvas, original/edited comparison and explicit rendering                                                   |
| StudioPromptComposer     | Unified input, model access, media attachment chips, suggestions, validation and retry                              |
| StudioLibraryPanel       | Contextual History/Media/Changes sheet, version selection, pagination and real proposals                            |
| ProposalCard             | Natural-language summary, change count, operation/timing details and approval/conflict states                       |
| ModelSelector            | Optional compact presentation; existing registry, task routing and paid/free permissions preserved                  |
| DashboardLayout          | Opt-in dynamic viewport mode used by this editor; other pages keep the existing layout                              |

The actual StudioVideoPlayer is reused without modifying its implementation. Shared AppButton, AppSelect, AppTabs, AppSheet/SheetContent, AppPopover, AppTextarea, AppFileInput, AppSpinner and query-state controls remain the UI foundation. No alternate player, button or tabs system was introduced. The main app landing page, generation composer, admin application and legacy apps/studio were not redesigned in this task.

## Editing and asset interaction details

The sequence remains Prompt → Proposal → Review → Apply/Reject → explicitly Render → Compare/Download. Supported welcome/composer examples concern deterministic zoom and original-audio volume. Image suggestions require a ready attached PNG. No generative object replacement, background regeneration or unsupported visual effect is advertised.

The existing four-thousand-character composer limit, duplicate-send guard, IME protection, Shift+Enter behavior and safe request-ID retry are retained. Recoverable failure preserves text and the original request body. A stale proposal cannot silently overwrite a newer revision; rejection and refresh/re-prompt provide recovery. Existing backend concurrency/idempotency checks remain authoritative.

Model choice is next to attachments. Paid users see only registered selectable models. Free users get read-only Auto routing. A missing default or service failure produces a concise unavailable state and a retry action inside the composer, rather than a technical banner in the workspace header. No working provider is fabricated.

Attachments still use the existing authorized project registration, signed PUT, completion and server-validation polling flow. PNG, MP3, WAV, M4A and OGG are advertised; the existing 100 MiB and eight-selection bounds remain. Device upload, ready-library selection, drag/drop, uploading/validating/ready/failure states, retry and removal are preserved. Removal detaches a chip and does not delete stored media. Existing destination reuse and quota behavior are unchanged. Selected IDs remain structured context in the existing proposal payload; server ownership, readiness, MIME, size and resource safeguards continue to run.

**This task is frontend-only.** No backend source, endpoint, LangGraph contract, EditPlan schema, provider credential handling, queue, storage contract, dependency, environment variable or database migration was changed.

## Verification results

| Check                                               | Result                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Relevant frontend regression set                    | 90 passed, zero failed/skipped                                                       |
| Existing backend editor/registry/studio regressions | 146 passed across 15 suites, zero failed/skipped; includes native FFmpeg integration |
| Main app TypeScript                                 | Passed                                                                               |
| Shared UI TypeScript                                | Passed; this package exports source and has no separate build script                 |
| Scoped editor/layout/test lint                      | Passed                                                                               |
| Main app production build                           | Passed; temporary test routes absent from production route output                    |
| Browser visual/interaction gate                     | 37 captured layouts and 10 interaction checks passed                                 |

Frontend regression includes billing consent/re-estimation, sharing, sidebar navigation, SSR/auth isolation, session behavior, real shared player rendering, proposal escaping and revision safety, model authorization and structured asset requests. New checks cover chronological proposal placement, near-bottom scrolling policy and honest compact model unavailability.

Chrome exercises the real React components. Local backend availability on the configured example port 5001 failed, so browser API/auth/R2 transport is synthetic. Media playback, seeking, fullscreen, keyboard behavior, focus, real browser download events and DOM layout are exercised in Chrome; provider editing and cloud validation responses are mocked. Native media tests are separate from these browser fixtures. Framework debug widgets are hidden only by the browser fixture, matching their absence from production.

## Responsive evidence and quality review

The browser harness is docs/studio-workspace-browser.cjs; machine-readable results and screenshots are in docs/studio-workspace-evidence. Coverage includes 375, 390, 640, 768, 1024, 1280, 1440 and 1920px, the requested welcome/active/proposal/rendering/completed/uploading/error states at 390/1024/1440, contextual tools, free routing, failed upload, stale approval and long-conversation reading. Short 600px desktop height with reduced motion and a 500px mobile viewport check action availability. The latter simulates keyboard-height reduction and does not claim a physical mobile keyboard/device test.

Actual screenshots were inspected, not inferred from types. Inspection led to mobile composer ordering, narrower model controls, quieter completed-render feedback, an icon-only mobile download action, bounded assistant width and a corrected responsive tools sheet. The geometry gate checks overflow, desktop composer/workspace visibility, mobile welcome composer visibility and the sheet's right/bottom placement. Focus returns after tools close. The baseline's three permanent dashboard cards are absent from the new workspace.

The final browser gate additionally covers authorized explicit model selection, prompt insertion without submission, structured ready-asset attachment/removal, Shift+Enter and Send, explicit proposal approval without rendering, render progress, original/edited switching, real keyboard play/pause/seek and desktop fullscreen, completed preview selection and download, upload validation gating, unavailable models, IME/duplicate-send protection, identical request retry after failure, older-message reading, free model access, failed upload retry, unsupported JPEG drop, stale approval and history paging without an unrelated preview request. The synthetic server supplies proposal/render outcomes; those outcomes are not presented as live provider/cloud integration.

Temporary authenticated fixture routes and synthetic public videos were removed from both app/admin source trees after verification. The verified local preview process was stopped before the production build. Generated fixture type directories were removed after checking their resolved paths stayed inside this repository. Git diff whitespace checks passed. Test/build logs are ignored local files; screenshot evidence is retained for review.

Selected captures: [Desktop proposal](studio-workspace-evidence/pending-1440.png), [Tablet welcome](studio-workspace-evidence/welcome-1024.png), [Mobile completed](studio-workspace-evidence/completed-390.png), [Desktop history](studio-workspace-evidence/history-1440.png), [Mobile history](studio-workspace-evidence/history-390.png), [Rendering](studio-workspace-evidence/rendering-1440.png), [Upload](studio-workspace-evidence/uploading-390.png), [Unavailable model](studio-workspace-evidence/unavailable-390.png). Video test-pattern footage is synthetic, not a real user's media.

## Remaining limitations and deployment

Deploy the main app update. There is no new backend deployment or environment setup for this redesign. Actual AI editing still requires the existing authorized registry/provider configuration; the missing-default condition in the supplied screenshot cannot be solved by inventing a model in the frontend.

Live authenticated Mongo/Bull/provider/R2 workflows were not certified here. The original backend/AI_EDITOR_AUDIT.md staging and credential-rotation prerequisites remain unresolved by this frontend task, including full Mongo workflow verification, live private storage/IAM/CORS/signing and deployment-host crash/resource behavior. No previously exposed credentials were read or reused.

Existing project quota, per-mounted-editor destination deduplication and failed-upload record cleanup limitations remain as documented by the preceding implementation. No fake undo/restore, asset deletion, unsupported media capability or fabricated editing history was added. The user subsequently requested committing and pushing this frontend redesign.
