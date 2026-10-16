# AI Studio corrective simplification

Implemented October 16, 2026. This supersedes the listing and session-navigation design in `ai-studio-redesign-results.md`.

The library now shares the actual My Clips count, heading, toolbar, thumbnail, card, list-row, responsive grid, and pagination presentation. Its heading reads “AI Studio” / “Edit your clips using AI.” All Clips is the default; Edited is the only alternate filter. The New AI Edit picker, project navigation, redundant badges, and visible conversation sidebar are removed.

History, Media, and Changes open focused shared dialogs without nested tabs. The editor retains the global shell, gives the video and conversation the full available width, and uses a shorter composer. Skeletons remain only in the conversation. Shared player defaults and the legacy Studio app were not changed.

## Backend scope

- The existing owned clip listing accepts `filter=all|edited`, filters before counting/pagination, and returns a small allowlisted editing/preview summary. It uses the same latest canonical plan as initialization. Actual requests, revisions, or saved modifications qualify; an empty plan/session and frame rounding do not. Preview status must match the current revision.
- Session creation optionally resumes the latest owned active conversation before its existing retry-safe creation path. No sessions, messages, proposals, models, or APIs were removed or merged. Plan initialization and its duplicate protection are preserved.
- Proposal, approval, and render mutations invalidate the clip library cache. Existing preview admission, worker, storage, approval, and revision protections remain in place.

## Verification

- App TypeScript: passed, including the production build type check.
- App ESLint for AI Studio and the shared My Clips presentation: passed.
- Backend ESLint for changed service/test files: passed.
- Frontend AI Studio tests: 35 passed.
- Backend editing suite: 146 passed; 9 existing integration tests skipped. The final activity change was followed by another successful 23-test service run.
- Backend production compilation (`nest build`): passed after the final activity change. Contract installation check passed.
- App production build (`next build --webpack`): passed with the original configuration restored and all temporary fixture routes removed.
- Listing browser checks at 375, 768, 1024, 1440, and 1920 px: count above title, All Clips/Edited, grid/list, search, pagination, empty/error/retry, correct clip links, no overflow, no browsing writes, and no browser errors.
- Editor browser checks at 360, 390, 768, 1024, 1440, and 1920 px, plus short-height and landscape layouts: no overflow, player/controls/composer fit. Focused dialogs have no tabs. Missing conversation initializes once and survives refresh; existing conversation drafts restore. Clarifications appear once. Apply starts exactly one render for the saved revision, progress/completion works, retry does not reapply, failed/no-op/rejected proposals do not render, and stale completed renders do not replace the current preview. IME and multiline input checks passed.

Browser verification used the real components and shared authenticated shell with intercepted synthetic API responses and generated test media. It did not call a paid AI provider, live R2 storage, or production data. Backend tests exercise the existing graph/render logic with their normal test doubles; this is not a live service end-to-end run.

## Screenshots

| Screen  | Desktop                                                                 | Mobile                                                                |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Library | [1440 px](studio-simplification-listing-evidence/listing-grid-1440.png) | [375 px](studio-simplification-listing-evidence/listing-grid-375.png) |
| Editor  | [1440 px](studio-simplification-evidence/chat-1440-dark.png)            | [390 px](studio-simplification-evidence/chat-390-dark.png)            |
| Video   | [Landscape](studio-simplification-evidence/landscape-1440-light.png)    | [Portrait](studio-simplification-evidence/preview-390-light.png)      |

Additional grid/list, My Clips reference, dialog, clarification, and breakpoint screenshots and machine-readable results are saved beside these images. The reusable verification scripts are `studio-listing-checkpoint.cjs`, `studio-redesign-browser.cjs`, and `studio-redesign-fixtures.cjs`. Temporary routes/media and the local development compiler workaround were cleaned up after verification.
