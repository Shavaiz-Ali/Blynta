# AI Studio redesign and verification

The approved redesign is implemented locally in `apps/app`, shared API contracts, and the existing backend editing/session infrastructure. No legacy Studio application, unrelated product pages, deployment settings, or Phase 3 export/caption functionality was changed.

## Interface and component architecture

- Existing AppShell remains the only global header and sidebar. Studio adds a contextual conversation sidebar at 1440px and above, with collapse and a drawer on narrower screens.
- StudioWorkspace coordinates the current shared plan, selected conversation, proposal approval and preview requests. Existing StudioVideoPlayer remains the only player.
- StudioLanding and StudioClipCard use typographic headings, clickable thumbnail cards, matching skeletons and server-side clip search/sort/pagination. Search is debounced; pagination operates on clips rather than parent videos.
- StudioSessionSidebar supports new chat, search, selection, rename and confirmed archive. Archive has an Undo action; shared edits and history are retained.
- useStudioPreferences stores account/clip-scoped conversation selection, per-conversation drafts/model choices, mobile tab and sidebar preference in tab-local session storage. Attachments are scoped by conversation and retained while switching.
- At 1280px and above, video and conversation appear together. Below that, keyboard-accessible Preview/Chat tabs preserve usable space. The composer auto-resizes, respects safe-area insets and follows visual-viewport changes when the mobile keyboard reduces usable height.
- History, Media and Changes are contextual tools below the player. Changes displays saved operations and audio controls, without replaying the conversation. Media lists referenced/attached owned assets; the composer retains access to the user's library.
- Proposal cards avoid identical message/summary duplication, show validated operation details and generated-asset information where available, and support Apply/Reject/Revise. Downloads explicitly say 720p preview.

## Sessions and API additions

- GET `/ai-editor/clips`: owner-scoped, completed/nondeleted clips, escaped literal title search, deterministic sort, 12 clips per page.
- GET/POST `/clips/:clipId/ai-edit/sessions`: list active sessions for an owned plan, or create a conversation for that same plan. Creation uses a retry-stable UUID and unique owner/request identity.
- PATCH `/clips/:clipId/ai-edit/sessions/:id`: validated rename or active/archived status; ownership and the referenced plan are rechecked.
- Existing session history now includes session-specific proposals and cursor-based older messages, excluding tool content. Frontend infinite-query pages keep conversations separate and allow loading earlier messages.
- Existing schemas and APIs remain compatible with older sessions/proposals. Existing optimistic plan revisions continue to protect approvals from stale conversations.

## Apply and automatic preview sequence

1. Apply remains an approval-only endpoint. It validates and saves the proposed EditPlan revision using existing optimistic concurrency. A semantic no-op is marked explicitly and does not write a new revision.
2. After a successful non-noop Apply, the frontend requests the separate preview endpoint with `expectedRevision` equal to the saved revision. An optional revision argument preserves compatibility with existing callers; mismatches fail before render admission.
3. Existing immutable version snapshots, unique plan/revision/profile identity and deterministic BullMQ job identity prevent duplicate work. Queued intent can be republished safely after a lost enqueue response.
4. Frontend recovery checks persisted applied proposals, including the plan's durable last-applied proposal marker, against current versions. This closes the Apply-to-Render gap after refresh without reapplying the proposal or relying only on the latest 20 proposals.
5. A failed render request leaves edits saved and exposes Retry Render. Failed/rejected/no-op approvals do not start a new preview. A failed worker render uses the existing retry/cancel APIs.
6. Existing authenticated polling reports real worker phases and encoding progress. Native EventSource cannot carry the current Bearer header, so the existing polling transport is retained. No progress values are fabricated.
7. Completion only switches playback automatically when the signed preview belongs to the current plan revision. Historical or stale completed renders cannot replace it. Users can still select historical previews explicitly.

## Prerequisite classification defect

Historical execution `118cdae8-02f4-40f3-b34b-8d49b4566195` returned an outer clarification envelope containing `{"baseRevision":1,"changes":[]}`. Its actual Zod failure was `changes`, code `too_small`, expected at least one item, actual zero. The old clarification branch bypassed patch validation and exited with USER_INPUT_REQUIRED despite resolved assets and no identified missing information.

Now clarification requires an actual backend resolution reason. An invalid generated patch goes through one bounded correction and then AI_PATCH_INVALID if still invalid. A validated patch determines proposal state, and a backend-generated summary cannot repeat a contradictory unsupported claim. Diagnostics include bounded known field paths, issue codes, expected/actual types and safe array constraints/counts, without raw private content, asset identifiers or reasoning.

The provider-facing patch schema excludes source and metadata. Legacy persisted patches remain readable, while backend merge preserves existing operation provenance. Zod EditPlan and owned-asset/timeline validation remain authoritative. No arbitrary FFmpeg execution is exposed.

## Verification

- Studio/shared-shell component suite: 51 passed, including exact-revision transport, existing auth/header behavior and simulated mobile keyboard viewport resizing.
- Complete backend editing suite: 150 passed across 15 suites, including the older-message, provenance, classification, session and revision regressions and all 9 FFmpeg integration cases.
- Actual FFmpeg integration: 9 passed using synthetic local media, covering gain, zoom, emoji overlays, combined edits and existing renderer cases. No provider, upload or production job was involved.
- Chromium browser checks: 24 layout captures at 360, 390, 768, 1024, 1440 and 1920px across light/dark themes. All recorded document widths match the viewport; visible workspace/composer bounds fit the viewport.
- Browser interactions passed: draft/session switching and refresh, shared-plan New chat, automatic render/progress/completion, render-request retry without reapply, no render after failed/no-op/rejected approval, durable-marker refresh recovery, stale-completion protection, IME Enter, Shift+Enter, keyboard tabs, mobile drawer, rename and archive.
- Screenshots and browser results: `.test-results/studio-redesign/`. Reproduce with `docs/studio-redesign-fixtures.cjs`, a development server on port 4100 with UI_AUDIT_PREVIEW=1, and `docs/studio-redesign-browser.cjs`. Run the fixture script with --clean before production builds. Temporary routes and synthetic media are removed from the delivered application.
- Production backend and frontend builds passed. Changed-file frontend/backend lint passed. The frontend production build also completed its TypeScript check.
- Full backend `tsc --noEmit` still reports exactly seven existing errors confined to `src/ai-registry/google-validation.spec.ts`: six test settings omit timeoutMs/maxRetries, and one union result accesses code without narrowing. No new backend type errors remain. These unrelated registry tests were left unchanged.

## Files changed

- Frontend: `apps/app/features/ai-editor/StudioLanding.tsx`, `StudioClipCard.tsx`, `StudioWorkspace.tsx`, new `StudioSessionSidebar.tsx` and `useStudioPreferences.ts`, `StudioConversation.tsx`, `StudioPromptComposer.tsx`, `ProposalCard.tsx`, `StudioPreviewPanel.tsx`, `StudioLibraryPanel.tsx`, `attachments.ts`, `queries.ts`, and `contracts.ts`.
- Backend session/approval APIs: `agent/agent.schemas.ts`, `agent/agent.controller.ts`, `agent/proposals.service.ts`; clip discovery and preview revision checking in `edit-plans.controller.ts` and `edit-plans.service.ts`; safe public last-applied marker in `edit-admission.service.ts`.
- Backend classification/provenance: `agent/editing-graph.service.ts`, `agent/edit-patch.ts`, and `agent/agent-diagnostics.ts`.
- Shared API contracts: `packages/types/src/contracts.ts` and generated/vendored contract artifacts.
- Regression and verification files: Studio/shared-shell Node tests and harness; backend patch/diagnostic/proposal/session/edit-service tests; guarded synthetic FFmpeg fixture cleanup; `docs/studio-redesign-browser.cjs` and `docs/studio-redesign-fixtures.cjs`. The earlier empty-patch investigation links to this implementation report.

## Deployment and limits

This is a local implementation, with no SSH, deployment, production configuration or database changes. UI browser transport is synthetic; it does not demonstrate a live configured-model call or a production queue/R2 roundtrip. The existing saved-model credential authentication limitation has not been changed or bypassed. Native mobile keyboard behavior and non-Chromium browsers need device verification. Session navigation currently lists the latest 200 active conversations for a clip/plan; archive records remain stored and can be restored through the session API or the immediate Undo action. Ready-media library discovery retains the existing latest-50 limit.
