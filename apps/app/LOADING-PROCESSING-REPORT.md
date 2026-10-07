# Main app loading and processing report

Scope: apps/app only. Existing backend work and frontend progress types were already modified when this task began; those changes were preserved. No backend, Studio, SSO, shared theme, or shared UI files were edited.

## 1. Root causes

Three my-clips loading.tsx files rendered independent DashboardLayout placeholders before client queries mounted. Library loading used a default grid before a mount effect read localStorage; a stored list therefore visibly changed geometry. The reported list-first order was not the default in this checkout: defaults were grid. The clip-detail route used JobDetailSkeleton, then ClipDetailView used the different ClipDetailsSkeleton. SourceVideoDetailsSkeleton used four tall 9:16 cards while final cards use a 16:10 thumbnail and three columns. Processing also guessed missing clip counts, rendered a fixed 75% animated bar, and changed entire views when the first clip completed. Some failed background fetches could replace existing data with error UI.

## 2. Loading-boundary audit

| Surface | Initial boundary and replacement trigger | Result |
| --- | --- | --- |
| Dashboard | Profile/header placeholders and StatsBarSkeleton until user query resolves; JobsSkeleton until jobs resolve | Independent resources retained; persisted layout resolved safely; cached jobs survive refetch and refetch failure |
| /my-clips | Route ClipsLibrarySkeleton, then query ClipsLibrarySkeleton, then localStorage effect could change grid/list | Route boundary removed; query owns collection placeholders; unknown preference is neutral |
| /my-clips/:id | Route SourceVideoDetailsSkeleton followed by same feature skeleton until useJob resolves | Route boundary removed; query owns placeholder; thumbnail/card geometry corrected |
| /my-clips/:id/clips/:clipId | Route JobDetailSkeleton then feature ClipDetailsSkeleton until useJob resolves | Route boundary removed; ClipDetailsSkeleton retained; existing cachedClipJob placeholderData preserved |
| /jobs and nested clips index routes | Auth check and redirects to canonical my-clips URLs; no query-specific placeholders | Retained |
| Job processing | JobProcessingView for early stages; cutting banner and generated placeholder cards during rendering | One stepper throughout active stages; actual queued/active/ready/failed clip states |
| Activity | ActivitySkeleton and independent stat placeholders on initial queries | Retained; keepPreviousData already preserves activity pagination; isFetching drives refresh controls/opacity |
| Profile | Text Suspense fallback, then ProfileSkeleton; referral/identity/security fields have independent query or mutation indicators | Redundant outer Suspense removed; query UI retained |
| Publications | Text Suspense fallback then inline publication-card placeholders | Redundant outer Suspense removed; initial query placeholder retained |
| Social accounts | Text Suspense fallback then ConnectedYouTubeCard placeholder from YouTube status query | Redundant outer Suspense removed; feature query placeholder retained |
| Billing | Suspense text fallback for useSearchParams in PaddleProvider/BillingPage; CurrentPlanBarSkeleton and PlanCardSkeleton for profile/plans | Retained: parameter suspension and independent profile/plan queries have distinct purposes |
| Calendar | Initial calendar skeleton, separate selectable-clip/query placeholders and category controls | Retained; isFetching is used for retry controls rather than full-page replacement |
| Notifications | NotificationList owns NotificationItemSkeleton; page queries same key for pagination metadata; dropdown uses compact variant | Retained; shared TanStack query cache prevents duplicate network query identity |
| Public share | Initial public-share fetch indicator and media/download controls | Retained; independent public route |
| Auth pages and auth transition routes | Signup Suspense with null fallback; initialData-enabled social-provider placeholders; form mutation buttons; dedicated auth-transition indicators | Audited and left untouched within SSO scope constraint |
| Media dialogs/player | Signed-URL fetch, media buffering, transcript/publishing/scheduling mutation and option loading indicators | Retained; media loading does not replace the job page |
| Shared packages | apps/app/components/ui/skeleton.tsx re-exports the same @blynta/ui primitive as AppSkeleton; shared primitive already respects reduced motion | One primitive, no second generic skeleton system |

No Zustand or context persisted view store was present. Main app has no remaining loading.tsx files. Billing remains the route-level Suspense boundary; signup retains its existing auth-specific boundary. Plain TanStack useQuery hooks do not suspend, so removed text Suspense wrappers were redundant rather than reliable query-loading owners.

## 3–4. Duplicates and removals

Removed three my-clips loading.tsx files, the inline ClipGeneratingSkeletonCard, unused MyClipsClient, unused DashboardShell (including inline SkeletonCard), unused JobProcessingHeader and its PipelineStepper, and their obsolete barrel exports. References were checked across apps and packages before deletion. Removed unused pipeline helper definitions and the getJobStageDetails helper with made-up fallback percentages.

JobsSkeleton and ClipsLibrarySkeleton remain separate because dashboard cards and SourceVideoCard library cards have different responsive grids and list geometry. Their unknown-view placeholder is shared through JobsSkeleton. SourceVideoDetailsSkeleton and ClipDetailsSkeleton serve different pages. JobDetailSkeleton/ClipWorkspaceSkeleton is retained for the exported legacy JobDetailContent composition, and is no longer a fallback on the active clip-detail route.

## 5–7. Final skeleton and persistence architecture

Data-specific components own first-load skeletons. SSR and initial hydration return null for view mode through useSyncExternalStore's server snapshot. During that short unknown period, an existing skeleton owner shows a neutral, accessible loading message rather than either layout. Browser snapshots validate localStorage values and resolve list/grid; no saved or invalid value defaults to grid. No cookies or new state-management library were added.

Keys remain blynta_clips_view_mode and blynta_dashboard_view_mode_v2. Both are now read and written; previously JobsCard wrote its dashboard key without reading it. Switching only updates presentation and persistence, with storage exceptions handled by an in-memory session fallback. Storage events synchronize mounted views/tabs. Query keys do not contain view mode, so switching cannot trigger data loading.

The intentional flow is neutral preference resolution → correct geometry if data is still absent → content. It never renders the opposite layout before the preference is known. Client navigation can read the resolved browser snapshot immediately; cached queries are not replaced by a route fallback.

## 8. Query behavior

Initial placeholders require missing data and initial loading, or unresolved presentation preference. Existing query data stays rendered during isFetching. Dashboard, library, and source detail no longer discard existing data on background fetch error. Existing ten-second job staleTime, five-minute global gcTime, query keys, signed-URL caching and clip-detail placeholderData are preserved. Library filter/page resets are batched in input handlers rather than a follow-up effect that could request the old page then reset it.

## 9–11. Processing experience and real contract

JobProcessingView is a vertical four-step pipeline: Preparing video → Generating transcript → Finding the best moments → Creating your clips. Earlier steps are derived from actual job status; failures use errorStage aliases when reported. Unknown failure stage stays explicitly unknown. There are no timers or frontend-invented percentages.

The existing backend enums have no independent parent finalizing or cancelled state. Finalizing is represented by uploading clips; no fake fifth stage was introduced. The terminal polling helper also treats an unrecognized/cancelled status as inactive for forward compatibility.

GET /jobs/:id shapes job.render through backend renderSnapshot. Existing frontend types already match ready, failed, total, progressPercent, and clips[].clipId/status/progress/renderProgress/processedSeconds/durationSeconds/etaSeconds/speed/frame/fps/updatedAt. Frontend consumes the existing contract without inventing another transport model. Backend merges aggregated render progress into job.progressPercent.

| Backend per-clip state | UI |
| --- | --- |
| queued | Waiting to process, no animated progress bar |
| cutting | Creating video with reported stage percentage |
| captioning | Adding captions with reported stage percentage |
| uploading | Finalizing; no invented upload percentage |
| ready / completed clip status | Normal finished GeneratedClipCard |
| failed / failed clip status | Processing failed, safe explanation |

Progress entries are joined by clip ID, never array position. Highlights provide titles; known highlights can show Waiting before clip metadata arrives without guessing additional outputs. Every active clip updates independently, with reported processed time/duration and ETA when available. The stage percentage uses progress; renderProgress remains the backend's weighted aggregate input rather than a second competing visible percentage. Missing progress fields produce status text, not fake progress. Failed raw backend messages are not displayed as FFmpeg stderr or stack traces. The existing POST /jobs/:id/retry action remains available on the video failure card.

Ready cards appear inside the same processing section as other clips. The first finished clip no longer replaces the whole processing screen. Dashboard active banners show every active video, each linking to its own job. No mutable progress state is shared across job IDs.

## 12. Polling and cache

No SSE endpoint exists in the inspected jobs controller. Existing polling is retained: cutting_clips details refresh every 1 second; earlier active stages every 3.5 seconds. Lists refresh every 5 seconds only while the current list contains active jobs. Completed/failed/unknown terminal jobs stop active detail polling. Completed lists stop interval polling. Normal focus/reconnect refresh remains available. Progress polling updates the existing detail query naturally, without invalidating all queries or replacing populated content with skeletons.

## 13–14. Components and changed files

Created:
- features/dashboard/use-view-mode.ts
- features/jobs/processing-state.ts
- features/jobs/components/ClipProcessingCard.tsx (including processing progress semantics)
- scripts/test-loading-processing.cjs
- LOADING-PROCESSING-REPORT.md

Changed:
- app/(main)/profile/page.tsx
- app/(main)/publications/page.tsx
- app/(main)/social-accounts/page.tsx
- features/dashboard/components/ActivePipelineBanner.tsx
- features/dashboard/components/DashboardHome.tsx
- features/dashboard/components/JobsCard.tsx
- features/dashboard/components/JobsSkeleton.tsx
- features/dashboard/utils.tsx
- features/jobs/components/ClipsLibrary.tsx
- features/jobs/components/ClipsLibrarySkeleton.tsx
- features/jobs/components/FailedStateCard.tsx
- features/jobs/components/GeneratedClipsGrid.tsx
- features/jobs/components/JobDetail.tsx
- features/jobs/components/JobProcessingView.tsx
- features/jobs/components/SourceVideoDetails.tsx
- features/jobs/components/SourceVideoDetailsSkeleton.tsx
- features/jobs/index.ts
- features/jobs/queries.ts

Deleted:
- app/(main)/my-clips/loading.tsx
- app/(main)/my-clips/[id]/loading.tsx
- app/(main)/my-clips/[id]/clips/[clipId]/loading.tsx
- features/dashboard/components/MyClipsClient.tsx
- features/dashboard/components/DashboardShell.tsx
- features/jobs/components/JobProcessingHeader.tsx
- features/jobs/components/PipelineStepper.tsx

All paths above are relative to apps/app. features/jobs/types.ts is an existing concurrent backend-contract change and was not edited in this task.

## 15. Verification

- pnpm --filter @blynta/app typecheck: passed.
- Targeted ESLint through the installed package's executable: passed with one pre-existing SourceVideoDetails img warning.
- node apps/app/scripts/test-loading-processing.cjs: passed.
- node apps/app/scripts/test-studio-import.mjs: passed; existing signed-URL/cache/navigation regression coverage preserved.
- Production next build: attempted; failed because Google Fonts downloads for Instrument Serif, Inter and JetBrains Mono could not connect. No font/theme workaround was committed.

Regression coverage includes server rendering with unknown view; client snapshot list/grid/no preference/invalid value; storage-disabled switching; zero/missing/non-finite percentages; backend stage and failure reconstruction; multiple independently updating clips; queued clips without fake bars; time/duration/ETA; finished-card transition markup; failed clips; job-ID isolation; terminal polling; and a real TanStack QueryObserver retaining data throughout background refetch. Render tests use a stub for the finished GeneratedClipCard and a display-title helper; they exercise the actual pipeline/processing-card implementations. Client preference tests probe snapshots using a hook harness; they are not an end-to-end browser hydration test.

## 16. Remaining verification and limits

Browser hard-refresh/slow-network navigation, full visual/mobile layout verification, focus/reconnect behavior in a live session, and live FFmpeg percentage updates against the running backend were not exercised. Reduced-motion classes, vertical/mobile grid markup, and progress accessibility semantics were checked in generated HTML, not by a browser or screen reader. The backend contract is currently concurrent work in this checkout and must be deployed for real clip percentages/ETA to reach users. Earlier-stage job progress can still be an estimate supplied by that backend; the frontend adds no estimates. Production build remains unverified until font downloads succeed. Removing route fallbacks means server auth/parameter navigation waits retain the current page instead of showing another data skeleton.
