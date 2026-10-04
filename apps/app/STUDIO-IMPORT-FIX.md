# Clip → Studio integration and loading state

## 1. Root cause and production evidence

The former importer required `clip.r2ObjectKey` and threw the same 404 for a missing owned job, a missing embedded clip, or a missing canonical key. It did not resolve a legacy persistent `outputUrl` key. Separately, the generation worker assigned new clip ObjectIds on retries, invalidating existing detail URLs and import identities. Both code defects are addressed.

The supplied production response alone cannot identify which branch affected job `6abe4d644b3ff2840974672f`, clip `6abe4de08c39dc00dddedd54`. The configured Mongo connection was unreachable and no authenticated production browser session was available. Therefore this is an implemented and locally tested repair, not a verified production recovery of that record. New diagnostic events distinguish missing job, missing clip, processing state and missing media without logging credentials or signed URLs.

## 2. Throw site

`StudioService.fromClip` in `backend/src/studio/studio.service.ts`, previously the combined `if (!job || !clip?.r2ObjectKey)` guard throwing `NotFoundException('Clip media not found')`.

## 3. Original payload

`EditInStudioButton` sent `POST /studio/from-clip` with `{ jobId, clipId }`. The supplied IDs are valid 24-character hexadecimal IDs. This payload remains unchanged; ownership comes from the authenticated JWT, never the request body.

## 4. Actual media persistence

Generated clips are embedded in `Job.clips`; they are not independent Studio assets or source-video records. The current generation worker persists the R2 key in both `r2ObjectKey` and `outputUrl`. Its names are `clips/<jobId>/clip-<n>-captioned.mp4` and `clips/<jobId>/clip-<n>.mp4`. Original source media is referenced through `SourceVideo.videoObjectKey`.

## 5. Resolution after the repair

The importer validates IDs, normalizes hex case, loads the authenticated user's job, and finds the exact embedded clip. It reopens an existing initialized import first. New imports require a completed clip (legacy absent status allowed), a valid duration, and a successful R2 HEAD on a stable media key. It builds one generated video asset and an initial editable 9:16 timeline clip at time zero on the video track. Transcript times are clamped and shifted to the generated clip. Available original source media remains a separate library asset.

## 6. R2 reuse

Studio assets reference existing object keys. Import performs no uploads, browser downloads, reuploads or object copies. Playback URLs are signed when assets are read; signed URLs are never persisted in project documents or asset identities. The generated video carries its existing audio.

## 7. Schemas, indexes and migrations

No new fields or migrations. The existing unique partial index on `{ userId, importKey }` enforces reuse of `<jobId>:<clipId>`. Ensure the normal existing database indexes are installed in the deployment.

## 8. Legacy records

A valid canonical key takes priority. If it is absent, a persistent `outputUrl` key is accepted only in the owned job's `clips/<jobId>/` namespace. Known worker filenames can recover legacy URL-only records, and every candidate requires HEAD confirmation. Remote URLs, expiring credentials and local paths are never treated as keys. A missing canonical object fails rather than silently substituting another file. Already invalidated old clip IDs cannot safely be inferred from this two-ID payload; the page must obtain the current embedded clip ID. Future retries preserve IDs when the highlight's time range is unchanged.

## 9. Duplicate clicks and concurrent imports

The button has a synchronous pending guard, remains disabled during navigation, and displays `Opening Studio…`. An API failure produces a professional toast and enables retry. Repeated imports reopen the initialized project. Concurrent imports use the existing unique index, remove the losing temporary project and asset references, and return the winner. Initialization failures remove incomplete records.

## 10. Navigation

The app navigates to `/editor/<projectId>` on the configured Studio origin. `NEXT_PUBLIC_STUDIO_URL` can explicitly configure it; otherwise Next exposes the existing `STUDIO_APP_URL`, with localhost only in development. There is no hardcoded production origin or token in the navigation URL. Invalid/missing origins fail visibly rather than guessing a destination. Production configuration must exist at build time.

## 11. Session absent in Studio

The existing Studio proxy, login callback and centralized SSO return path remain intact. Existing integration tests cover preservation of the editor destination, central login, identity reuse and separate Admin authorization. No SSO or Admin implementation was changed.

## 12. Loading skeleton

The dedicated `ClipDetailsSkeleton` mirrors the actual header actions, compact 9:16 preview, responsive information column, metadata, watch action, AI insight and publishing panel. It uses existing skeleton tokens with static placeholders, retains accessible loading status, and follows the loaded page's grid and spacing.

## 13. Query cache

The existing job detail query key and request remain. A matching embedded clip from cached job lists provides placeholder data while the same detail query refreshes. Fresh detail cache is reused directly. A background error does not replace already available detail data with an error screen. No additional fetch effect or parallel request was added.

## 14. Files changed for this request

- Backend: `src/studio/studio.service.ts`, `clip-media.ts`, `studio.service.spec.ts`, `studio-import.spec.ts`; `src/jobs/jobs.processor.ts`, `clip-identity.ts`, `clip-identity.spec.ts`.
- Main app: `features/jobs/components/ClipDetailView.tsx`, `ClipDetailsSkeleton.tsx`, `clip-detail/EditInStudioButton.tsx`, `features/jobs/clip-details-cache.ts`, `studio-navigation.ts`, `next.config.ts`, `.env.example`, `scripts/test-studio-import.mjs`, this report and `clip-verification/` screenshots/results.
- Prior Studio dashboard work is preserved separately. The pre-existing `backend/.env.sso.example` edit was not changed by this repair.

## 15. Regression coverage

21 backend tests across import, existing Studio service and clip identity cover ownership, missing records/objects, processing state, invalid payloads, current and legacy keys, URL exclusion, timeline and transcript, stable retry identities, reuse, concurrent requests and cleanup. Frontend regression checks validate destination configuration and real TanStack Query observers: exact cached clip match, immediate rendering, one shared in-flight request and no request for fresh cached details.

## 16. Checks and remaining verification

Main app typecheck and changed-file lint pass. Backend typecheck, build and changed-file lint pass. Backend regression suites pass. Full main lint reports 38 errors/35 warnings elsewhere; full backend lint reports 797 errors/105 warnings across existing code. These unrelated files were not mass-fixed. Main production build is blocked by failed network requests to Google Fonts for Inter, Instrument Serif and JetBrains Mono.

The full isolated HTTP SSO integration suite passed. A temporary public preview route rendered the actual `ClipDetailView` with synthetic intercepted API responses in headless Edge at 1440, 1024, 768 and 390 pixels. All four widths passed: loading/loaded geometry, no horizontal overflow, no browser exceptions, exactly one job-detail request, one request during duplicate import clicks, professional failure feedback and retry, and successful navigation to the configured editor path. Screenshots and `clip-verification/results.json` retain the evidence. The temporary preview route was removed. This browser check uses synthetic responses; it does not prove production video playback or database access.

Production acceptance remains: deploy the app/API/worker changes with the configured Studio origin, open the supplied job using the current clip ID, click Edit in Studio, and verify playback plus timeline editing/save. If it still fails, the new `studio.clip-import.*` event identifies the failed stage for the exact supplied IDs. No production changes were deployed from this workspace.
