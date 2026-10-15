# AI Studio assets and progress

The existing LangGraph, operation/patch schemas, proposal approval, timeline compiler, edit-render queue, R2 service, model registry, and shared video player remain in use.

## Capability and asset resolution

`edit-capabilities.ts` derives operation names and their JSON contract from the Zod operation union. Interpretation identifies asset requirements and transcript phrases. Its unsupported assessment is advisory: information and asset resolution execute before the final planner decides the outcome. The planner receives actual resolved asset IDs. Validation rejects proposals that omit resolved assets, then runs the existing revision, ownership, media, and timeline checks. One correction is allowed, with at most three model calls, sixteen scoped tool calls, and the existing 90-second execution deadline.

The API keeps `pending` for reviewable proposals and `clarification` for missing assets, ambiguous names/times, and unavailable image generation. An unresolved part blocks the proposal rather than silently applying a subset. The original request and conversation remain available for refinement. Approval still saves a revision; Render preview separately queues FFmpeg.

Emoji generation is an original, project-owned procedural graphics library in `emoji-artwork.ts`. It introduces no third-party artwork, licensing obligations, fonts, downloads, provider calls, or charges. It uses a deliberately limited Blynta visual style, not platform-specific emoji artwork. Supported inputs are the exported allowlist, including 😂 and the multi-codepoint ❤️ variation sequence. Other sequences require an uploaded PNG. New emoji artwork should extend this allowlist with visual review and PNG tests; do not approximate unknown sequences.

The PNG encoder produces RGBA PNGs with transparent padding, antialiased edges, and integer dimensions of 32–512 pixels. IDs hash the resulting PNG content. Records and private object keys are scoped to the authenticated user. A unique existing StudioAsset index prevents duplicate records. Concurrent identical PUTs write identical bytes to the same key; retries reuse the durable intent and asset ID. Upload size is verified before marking ready. The existing render validator checks MIME, dimensions, ownership, and R2 metadata again.

Basic right-pointing arrows and rectangles use the same deterministic rasterizer and storage path. Shape and hex color inputs are allowlisted/validated; neither invokes an image model. Shape size and color become part of the resulting content hash. Both produce standard image-overlay dependencies for the existing FFmpeg compiler.

Generated assets are permanent reusable library assets, including when a suggestion is rejected. There are no temporary files or temporary object keys to abandon. Failed/pending upload intents remain in StudioAsset and can be safely retried at their deterministic keys; automatic deletion is intentionally avoided because deleting a key could race another execution or remove an approved dependency. Any future retention cleanup must claim an expired generation lease and check references in saved plans, pending proposals, and render versions before removing an asset. Existing render workspaces and unpublished render outputs retain their reconciliation cleanup.

The database registry currently describes text output and vision/audio inputs, with no image-output provider contract or billing path. Image generation therefore remains explicitly unavailable; personal photos, logos, custom stickers, and shapes outside the deterministic library require an owned upload. No text model is treated as an image generator.

## Progress and cancellation

Shared stage labels and render phase values live in `packages/types/src/contracts.ts`; generated frontend/backend artifacts follow the existing contract build workflow.

Actual graph node entry emits a safe stage ID into owner/execution-scoped Redis with a five-minute TTL. The existing authenticated state endpoint returns stage snapshots. The frontend polls during the POST and while a stored proposal is generating, then stops. Refresh and reconnect use existing state records. No raw prompts, reasoning, credentials, object keys, or URLs are included in progress values.

`POST clips/:clipId/ai-edit/proposals/:id/cancel` claims only an owned generating proposal. Its durable `cancelled` status prevents late results from being published; a Redis flag aborts the in-flight graph/provider signal. Repeated requests retain the existing request-ID idempotency rules. A disconnected browser does not automatically cancel work; it can reconnect and recover the execution. Failure records retain an execution ID, stage, code, retryability, user/clip/session, and timestamps in existing records and usage logs.

The renderer reports actual preparation, compilation, encoding, verification, upload, and finalization phases. Encoding parses FFmpeg `out_time_us`, the historical microsecond-valued `out_time_ms`, and `out_time`. The denominator is the compiled output timeline duration, including multi-segment edits. Progress is monotonic within an attempt and capped at 99 before publication. It is an **encoding percentage**, not a weighted estimate of the whole job. Other phases are indeterminate. `speed`/`progress=end` are not used to invent a percentage.

Ticks are throttled to at most twice per second into BullMQ/Redis. MongoDB stores phase transitions, attempt number, failures and terminal state, rather than every tick. Existing worker lease heartbeats continue independently. The authenticated version endpoint overlays live progress only when execution token, retry generation and attempt match the durable active version. Tokens remain server-side. A manual retry resets progress and increments the existing generation. Completed/cancelled/failed versions ignore old ticks. Upload HEAD verification and the existing local media verification must finish before publication records 100.

The shared player remains mounted as its source changes. A restrained blue inset glow marks active rendering and disables animation with reduced motion. Rendering keeps the original available; completion loads the signed edited URL, refreshes plan/history queries, and enables the existing download path. Failures retry the render without resubmitting the AI prompt. Existing valid version records remain available after cancellation.

## Verification and extension

Focused tests cover the graph, emoji PNG encoding and storage retries, owned assets, patch approval, timestamp progress parsing, stale progress isolation, lifecycle phases, cancellation, UI phase/percentage display, polling and reduced motion. The FFmpeg integration fixture uses an actual generated transparent emoji PNG through the existing compiler.

Live provider, MongoDB/Redis/R2 integration and an authenticated browser session require the application's running services and credentials. Mock-backed tests do not establish those integrations. See the final implementation report for commands and results.

Local checks:

- Backend `npm test -- --runInBand ai-editor` with `EDIT_FFMPEG_PATH` and `EDIT_FFPROBE_PATH` set to installed executables: **122 passed**, including all five actual FFmpeg integration tests.
- Frontend `node --test scripts/test-ai-studio.cjs`: **31 passed**.
- Editor backend ESLint and frontend feature/test ESLint: passed.
- Backend `npm run build` and frontend `next build`: passed, including frontend TypeScript.
- Full backend `npm run typecheck`: blocked by seven existing errors in the unchanged `src/ai-registry/google-validation.spec.ts` (missing timeout/retry fixture settings and an unnarrowed result union). Production backend compilation excludes test files and passes. These unrelated fixtures were not changed.
- `git diff --check`: passed.

Optional browser simulation is deferred. A later extension should use the shared player's actual playback-time subscription and approved operation parameters for verified static overlays only, including seeking, pauses, aspect-ratio geometry and signed asset URLs. It must be labeled provisional and removed when the FFmpeg preview is selected. It must not simulate unsupported effects or replace FFmpeg.
