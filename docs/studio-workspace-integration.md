# Blynta Studio workspace and service integration

Implemented 3 October 2026. The attached editor image informed workspace geometry; existing Blynta tokens, typography, themes, authentication and @blynta/ui controls remain the product foundation.

## Editor report

1. **Components:** EditorShell, EditorToolbar, MediaPanel/MediaItem, PreviewCanvas, InspectorPanel, AIPanel, Timeline/TimelineClip, ExportDialog, NewProjectDialog, Dashboard, ProjectCard, useEditor and useWorkspaceLayout changed.
2. **Structure:** compact header; upper workspace with tool rail, contextual library, contained preview, shared right workspace; timeline spans the full workspace below.
3. **Tool rail:** compact icon buttons with accessible labels, tooltips and active state. Media, Text, Audio, Captions, Transitions, Effects and Brand select contextual content.
4. **Context panel:** searchable, filtered, grouped cloud media. Real uploads, asset replacement, original source/generated clips, text creation, actual fade and transform actions. Ready cloud uploads can be recovered into the library after a timeout. Brand displays its availability honestly.
5. **Preview:** aspect-ratio frame fits both available dimensions; transforms/text use canonical 720-pixel coordinates. Playback, seeking, stepping, audio, zoom and fullscreen retained. Visual/audio fades are reflected in preview and export.
6. **Inspector:** selection-aware timing, transforms, appearance, fit, text and audio controls. No-selection project properties. Selectable text fonts and weights match the server's supported mapping.
7. **AI:** shares the Inspector's right workspace. Conversation remains mounted when closed. Real backend proposals expose descriptions and Apply/Discard. Apply uses the existing reducer as one undoable edit; stale proposals are rejected. Captions require actual transcripts.
8. **Timeline:** full-width tracks, adaptive ruler spacing, selected trim handles, authentic media thumbnails, sticky track controls. Preserves drag/drop, snapping, scrubbing, splitting, mute, hide, lock, duplicate, delete, zoom and undo/redo. Decorative audio waveforms removed.
9. **Panels:** context/right panels resize and collapse; timeline defaults to 38% and resizes. Local layout preferences persist. Narrow desktop widths collapse panels and support reopening them.
10. **Shortcuts:** existing play, split, delete and undo/redo plus Ctrl/Cmd+K for AI. Inputs, contenteditable fields, dialogs, menus, sliders and comboboxes guard editor shortcuts.
11. **State:** editor history/playhead remain local reducer state. Authenticated TanStack queries hold remote projects, assets and render status. A serialized SaveSession prevents overlapping autosaves and preserves unsaved edits after conflicts/errors.
12. **Performance:** media URLs refresh separately; processing and renders poll only when needed. Preview frame updates do not generate API mutations. Existing context consumers still render with the 10 Hz playback state; independent playback subscriptions are a future optimization.
13. **Preservation:** manual editor operations and shared design controls reused. Unsupported placeholder features no longer fabricate output. Existing generated video may include baked captions, which cannot be removed through text editing.
14. **Removed:** unused local project repository, mock AI service and local-blob upload path. Test fixtures remain outside production imports. Historical browser storage is not erased.
15. **Validation:** see verification table below.
16. **UX TODOs:** production media/long-session checks, further narrow-screen polish, real waveform extraction, brand library, richer transitions, font metric parity, legacy browser-project migration and accessible product review with users.

## Backend and integration report

1. **Modules:** new StudioModule/controller/service/contracts/models/processor/render planner; AppModule and existing JobsWorkerModule register Studio. JobsService/JobsModule protect objects referenced by Studio from clip deletion. R2Service adds authenticated object metadata inspection. SourceVideo platform property uses an explicit String schema type.
2. **MongoDB:** StudioProject stores ownership, name, version, revision, document and optional clip import identity. StudioAsset stores owned project media references, trusted metadata, thumbnails and cached transcripts. StudioRender stores an immutable timeline/settings snapshot and progress/output state.
3. **API:** all routes require existing JWT authentication, under `/studio`:
   - GET/POST `/projects`; GET/PATCH/DELETE `/projects/:id`.
   - PUT `/projects/:id/timeline`; POST `/projects/:id/duplicate`.
   - GET `/projects/:id/assets`; POST `/projects/:id/assets/upload` and `/complete`.
   - POST `/projects/:id/ai/propose`; POST `/projects/:id/renders`.
   - GET `/renders/:id`; POST `/from-clip`.
4. **Ownership/security:** user identity comes from the JWT, never request body. Reads/writes scope project/media/render queries to ownership. Foreign or invalid project identifiers return 404. Strict schemas reject caller-owned storage keys, arbitrary media URLs, unsupported operations and unknown fields. Studio's authenticated Next.js proxy keeps bearer credentials server-side and checks mutation origin.
5. **Assets:** persistent timeline references use stable asset IDs. Uploads and imported clips resolve through owned StudioAsset records. Metadata processing checks actual media with ffprobe; timelines only save against ready, owned media with matching duration.
6. **R2:** server chooses object keys and signs direct PUT. Completion checks size/MIME with HEAD, then schedules processing. Playback/thumbnails/export use signed download URLs; ephemeral URLs are excluded from saved documents. Dashboard thumbnails resolve from owned media. Duplicate projects reuse objects. Project deletion deliberately retains media references/objects pending a future garbage-collection policy.
7. **Timeline:** version 1 documents contain name, ratio, assets, tracks and clips. Constraints include 200 assets, 150 clips, 20 tracks, one-hour timelines and bounded source offsets/speed/transforms. MP4 export supports 16:9, 9:16, 1:1 and 4:5.
8. **Autosave:** 750 ms debounce with sequential writes, revision compare-and-swap and newest-document coalescing. Conflicts stop overwrites and preserve dirty edits; retry and edit-plan download support recovery. Export flushes saves before submitting the saved revision. Unload warns when edits remain dirty.
9. **AI schema:** validated trim(seconds,targetClipId), ratio(value), volume(value,targetClipId) and captions(actual timed segments). Up to ten actions per proposal; unsupported requests return an explanation/error.
10. **Apply:** backend proposes against sanitized current timeline context. No provider mutation of the document. Frontend checks proposal freshness, applies atomically through the reducer, and autosaves the resulting document. Lock guards apply to AI operations too.
11. **Rendering:** saved document and settings are snapshotted. Worker resolves owned media, downloads inputs, builds a filter script and argument array, renders locally, uploads MP4, then exposes signed output. Temporary files are removed on completion/failure.
12. **BullMQ:** `studio` queue handled by StudioProcessor in the existing jobs worker, concurrency two. Metadata, transcription and render jobs use existing Redis infrastructure; retries and failed statuses are explicit. Render requests limit active exports per user.
13. **FFmpeg:** trim/retime, layered videos/images, contain/cover, scale/rotation/position/opacity, visual fades, literal multiline text, mapped fonts, audio trim/atempo/volume/fades/delay/mix, stereo AAC, H.264, pixel format and faststart. Text uses generated files and expansion disabled. See [official filter documentation](https://ffmpeg.org/ffmpeg-filters.html).
14. **Progress:** parses FFmpeg out_time_us, throttles serialized database/queue updates, caps encoding progress below 100 until R2 upload completes. Frontend polls render state and shows errors, progress, retry status and download.
15. **Main app handoff:** ClipDetailView/ClipHeader expose EditInStudioButton. Authenticated `/studio/from-clip` verifies clip ownership, reuses its R2 key, initializes a real timeline and rebases cached captions. Adds original source when available. Unique import identity makes repeated handoff idempotent.
16. **Reused services:** JWT/Auth.js, Mongo/Mongoose, existing R2Service, BullMQ/Redis, transcription provider, FFmpeg wrapper and process registry, Jobs/SourceVideo schemas, shared @blynta/ui.
17. **Configuration:** optional new main-app `NEXT_PUBLIC_STUDIO_URL` controls handoff destination (development defaults localhost:3002; production studio.blynta.com). Studio uses existing backend URL/auth configuration. Backend reuses MONGO_URI, REDIS_HOST/REDIS_PORT, R2_BUCKET_NAME/R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY, LLM_PROVIDER/LLM_API_KEY/LLM_MODEL_NAME/LLM_BASE_URL or GROQ_API_KEY. Transcription uses TRANSCRIPTION_PROVIDER with GROQ_API_KEY/GROQ_WHISPER_MODEL, or WHISPER_BINARY_PATH/WHISPER_MODEL_PATH. No test binaries are production dependencies.
18. **Indexes:** project owner+updatedAt; unique owner+importKey partial string index; unique asset owner+projectId+assetId; render owner+projectId+createdAt. Ensure these indexes are deployed where automatic index creation is disabled.
19. **Queries:** owner-scoped query keys for projects/assets/renders, narrow mutation invalidation, signed URL refresh and processing polls; loading/error/retry states replace demo fallback.
20–22. **Tests:** see below. API service tests use model/storage/queue doubles; UI tests intercept transport. Actual FFmpeg runs independently of cloud services.
23. **Deferred:** advanced compositing/keyframes, rich transitions, waveform generation, arbitrary fonts/text animation, brand assets, URL import, collaborative editing, media garbage collection and legacy local-project migration.
24. **Limits:** no live MongoDB/Redis/R2/LLM/transcription workflow was exercised in this session. Existing local browser projects are not automatically migrated. Burned captions remain in imported video. Browser/server font metrics can differ. External provider and large-project performance require deployment validation.

## Deployment prerequisites

Run both the Nest API and existing jobs worker (`start:worker:prod`) with shared MongoDB, Redis and R2 configuration. Install current FFmpeg and ffprobe on PATH with H.264/AAC/drawtext support and Liberation Sans/Serif/Mono regular/bold fonts (or corresponding fontconfig mappings). Configure R2 CORS for the Studio origin to allow PUT/GET/HEAD and Content-Type/Range. Set Studio/main-app central authentication and backend destinations consistently. Configure at least one actual AI and transcription provider; missing configuration produces an explicit unavailable response.

## Verification

| Check | Result |
| --- | --- |
| Backend Studio ESLint, TypeScript, Nest build | Passed |
| Backend service/render-planner Jest | 11 tests passed |
| Studio TypeScript, ESLint, editor/auth state tests | Passed |
| Main app TypeScript | Passed |
| Studio optimized Next.js build | Passed |
| Browser workspace at 1440/1280/1000 | Passed; real components with mocked API transport |
| Browser AI Apply/Undo, panel collapse, input guards, autosave/export UI | Passed |
| Actual FFmpeg MP4 smoke, all four ratios | Passed; decoded frame/audio/dimension assertions |
| Live cloud workflow/providers | Not exercised |

Test entry points: `apps/studio/scripts/test-editor.mjs`, `apps/studio/scripts/test-workspace.mjs`, `backend/src/studio/*.spec.ts`, `backend/test/studio-render-smoke.cjs`. Browser checks need STUDIO_PLAYWRIGHT_PATH and installed Chrome. Render smoke accepts STUDIO_TEST_FFMPEG. Screenshots and portable verification tools are ignored under `.test-results`; the application does not use them.
