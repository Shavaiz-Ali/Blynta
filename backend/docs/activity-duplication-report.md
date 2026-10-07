# Activity duplication audit and fix

Audited on October 8, 2026 (Asia/Karachi). Changes are implemented locally; application history has not been deleted or rewritten.

## 1. Root cause of repeated download records

There was one `CLIP_DOWNLOAD` producer: `JobsController.downloadClip`. Every `GET /jobs/:jobId/clips/:clipId/download` generated a signed R2 URL and unconditionally called `activitiesService.queueCreate`. This endpoint served both preview playback and intentional downloads.

Three automatic callers produced false download events:

- `useClipSignedUrl` called it as an ordinary TanStack Query query for active video playback, including refetch/retry.
- `ClipDetailView` prefetched previous and next clips through that same endpoint.
- `StudioCenterPanel` called `useDownloadClip().mutateAsync` inside its preview-loading effect on mount/clip changes.

Consequently, opening clip details could create activities for the active clip and its two neighbors without any download click. Remounts, navigation, query retries and stale refetches could add more. This is a frontend caller/backend event-semantics defect, with actual database inserts, not duplicate row rendering. No activity-list filtering or grouping was added.

A separate systemic defect was that ordinary queue producers supplied neither an event key nor a deterministic BullMQ job ID. The worker called an unconditional Mongo insert. A retry after a successful insert but before acknowledgement could insert another document. Historical records do not contain request/attempt correlation, so the contribution of retries to each old record cannot be determined retrospectively.

## 2. HTTP requests per action

Before the fix, the generated-card and Studio-right-panel click handlers issued one download request per invocation. The clip-detail click handler issued **zero** when a cached preview URL existed, otherwise one. Automatic clip-detail loading could independently issue one active preview request plus up to two adjacent prefetch requests; Studio preview issued a request on mount/clip changes. These are code-path counts, not a reconstructed production browser trace.

After the fix, each intentional click generates a UUID and executes one POST mutation. The actual frontend mutation and real HTTP controller are exercised by the integration harness. Transport/mutation retries retain the same UUID, so extra HTTP attempts do not represent new events. A new click gets a new UUID.

## 3. Queue jobs per action

One successful POST calls `queueCreate` once. It supplies an action-scoped event key:

`activity:download:<userId>:<jobId>:<clipId>:<actionId>`

The queue job ID is `activity-<SHA256(eventKey)>`, avoiding the colon restriction on BullMQ custom IDs. Repeated producers with the same key resolve to one retained queue job. Mongo remains the final deduplication boundary after completed queue jobs are removed. The real integration test verified one action → one queue job → one record, and an HTTP replay left the job/record count unchanged.

## 4. BullMQ retries

Both activity queue entry points now share the same enqueue helper. A missing business event key receives a UUID **before enqueueing**, persisted in the payload for all attempts. All activity worker jobs use `createIfNotExists`. Existing legacy queued payloads without keys receive a deterministic queue-job fallback key. Duplicate-key insert errors return the already persisted document.

The test injects a failure immediately after the real processor successfully saves to Mongo. BullMQ performs another attempt; the same document is returned. Unit tests additionally cover competing processors, a removed/recreated completed queue job, legacy payloads, and separate ordinary actions. Legacy rows created by the old worker cannot be retroactively matched to a later attempt with certainty.

## 5. Multiple workers

No historical telemetry proves that multiple workers caused the reported rows. The activities processor was registered in the dedicated activities-worker module, with concurrency 5. BullMQ ordinarily locks a job to one worker; stalled/replayed work still requires database idempotency.

The live harness runs **two actual BullMQ workers** in an isolated namespace. The database unique index protects persistence regardless of which worker processes an attempt. Unit tests also deliberately invoke two processors concurrently for the same event.

## 6. Automatic callers and read endpoints

Preview/query/prefetch callers now use authenticated `GET /jobs/:jobId/clips/:clipId/media-url`. It performs the same ownership/readiness check and signs the same R2 object without creating activity. The legacy GET download route remains a read-only URL alias, so old cached clients cannot continue creating false preview activities. Such clients need the updated frontend to record intentional downloads through POST.

Intentional downloads use `POST /jobs/:jobId/clips/:clipId/download` with a validated UUID `actionId` in the JSON body. The clip-detail cached-URL shortcut was removed so genuine clicks are recorded consistently. Studio preview now uses the cached read-only query instead of a mutation effect.

Job list/detail/progress polling, activity list/stats, ordinary user reads, shares, and Studio media URL signing were audited. No additional activity producer was found on these ordinary reads. R2 signing itself has no activity side effect. The unused `ReadyClipsRack` has a direct storage-link download path, but has no callers in the current app and does not call the activity endpoint.

## 7. Event identity and traceability

HTTP download logs carry `requestId`, `actionId`, `userId`, parent `jobId`, `clipId`, activity type and event key. The request ID is generated per HTTP attempt; the action ID survives retries. Queue logs include the deterministic activity job ID. Worker logs include attempt number and the returned Mongo Activity `_id`. Request/action IDs persist in activity metadata. Signed URLs, bearer tokens and connection credentials are not logged.

The event identity includes the action, not merely user/clip/type: downloading the same clip later creates another event. Ordinary queue calls get distinct UUIDs unless the producer supplies a stable business identity. Activity creation remains best-effort on enqueue failure, as before; those failures are now correlated in structured logs.

## 8. Database and indexes

The existing `dedupeKey` field and unique sparse index `activities_dedupe_key_unique` are reused. No schema change or destructive index synchronization was needed. The read-only audit of the configured application database verified that this index exists and is unique/sparse. No records had duplicate nonempty event keys. Workers must run with this index present; the isolated test initializes the real schema/index before starting its workers.

## 9. Other activity producers

| Producers | Audit result |
| --- | --- |
| Job creation and credit deduction | Previously ordinary queue calls; now stable keys based on the newly saved job ID and distinct event types. |
| Job/clip deletion | Now stable keys based on job/clip identity. Replayed producers cannot duplicate the deletion event. |
| Job start, completion and failure | Already had stable business keys. They now also receive deterministic queue IDs through the shared helper. |
| Billing subscription/credit events | Existing subscription-based keys protect duplicate webhook publication. Same protection now exists at queue level. Some repeated events may intentionally share a subscription identity; this audit does not change credit-grant or webhook business semantics. |
| Referral reward and welcome bonus | Existing stable referrer/referred-user keys are retained. |
| Login, registration, password reset, avatar/password/profile changes, referral invitations | Ordinary queue jobs were vulnerable to insert/acknowledgement retries. All now receive persisted per-event UUIDs and worker idempotency. Separate endpoint actions remain separate; this is not universal business-operation idempotency for every HTTP endpoint. |
| Admin user/job/billing/notification actions | Direct `create` calls occur after write operations, not polling reads. They bypass BullMQ and therefore its retries. Separate admin HTTP invocations still produce separate audit records unless they supply an explicit key. A broadcast's per-recipient activity loop is intentional. |
| Clip generation/export/cancel/auth-link types | Some enum members have no current producer; clip readiness is represented by existing parent start/completion events. No second download producer was found. |

No service/controller pair both created the same download event, and one queue helper invocation performed one `Queue.add`. The repeated signing calls, plus unprotected retry persistence, explain the concrete architectural weaknesses without assuming multiple-worker misbehavior.

## 10. Files changed

- Backend: `src/activities/activities.service.ts`, `activities.processor.ts`, `activities-idempotency.spec.ts`; `src/jobs/jobs.controller.ts`, `jobs.service.ts`, `jobs-download.controller.spec.ts`, `dto/download-clip.dto.ts`; `package.json`.
- Frontend: `features/jobs/queries.ts`; `components/ClipDetailView.tsx`, `GeneratedClipCard.tsx`, `StudioCenterPanel.tsx`, `StudioRightPanel.tsx`; `scripts/test-download-activity.cjs`.
- Tools/docs: `scripts/audit-activity-duplicates.cjs`, `test-activity-flow.cjs`, `cleanup-reviewed-activities.cjs`, `test-reviewed-activity-cleanup.cjs`, this report.

## 11. Verification

- Focused activities/download/jobs tests: **27 passed** across four suites, including ten new HTTP/idempotency tests.
- Full backend suite: **194 passed, 2 failed** across 34 suites. The unchanged failures remain the AppController missing `DatabaseConnection` mock and NotificationsService mocked read-status assertion.
- Backend Nest build and backend/app TypeScript checks passed.
- Changed backend TypeScript lint passed. Frontend changed-file lint passed with the existing GeneratedClipCard `<img>` warning.
- Frontend harness executes actual query/mutation functions with real TanStack Query observers: one action → one POST; retry retains the action UUID; another action gets a new UUID; preview/refetch/prefetch only issue GET media-url requests. Source guards cover the identified automatic callers and cached-preview shortcut.
- Live integration uses the actual frontend download mutation, Nest HTTP routes, BullMQ, two workers, and MongoDB with the real unique index. Signing and job ownership fixtures are mocked; no real clip bytes are downloaded and no production UI browser session was used.
- The live integration verified read-only preview/legacy GET, one action/one job/one document, duplicate HTTP replay, a new action adding one document, and a real BullMQ retry after successful Mongo insertion.
- Cleanup tool safety tests passed offline: dry-run performs no deletion, reviewed IDs are required, distinct action IDs are preserved, backup precedes deletion, existing backup files are refused, and concurrent record changes stop cleanup.

Run from backend: `npm run audit:activities`; `npm run test:activities:integration` (localhost Mongo/Redis defaults). `node scripts/test-activity-flow.cjs --configured-mongo` uses the configured Mongo **server** in a freshly generated temporary database and configured **local** Redis port with an isolated queue prefix. It removes only its test collection/queue data. Run the frontend harness from apps/app: `node scripts/test-download-activity.cjs`.

Final successful live trace (disposable test identities; both documents were subsequently removed with the test collection):

Common `userId`: `6ac69f5d59ba4633a38ca9f1`; parent `jobId`: `6ac69f5d59ba4633a38ca9f2`; `clipId`: `6ac69f5d59ba4633a38ca9f3`; activity type: `clip.download`.

| Stage/identity | First action | New action with injected retry |
| --- | --- | --- |
| Frontend action UUID | `5470333c-212e-4fa3-8f21-d6a327dd47a0` | `3e919d13-1076-4eb8-8a97-a382d90fcdae` |
| HTTP request UUID | `d6ac5663-5ada-4b75-9fd2-a26dd40e25b3` | `ac8b8c0d-932e-497c-831f-6a870275b147` |
| BullMQ activity job ID | `activity-563f0440989c1f63ad25cbeeabb3225928a64eb6d9fb3da843fff889017d0b26` | `activity-75592b1ee3f20181a3672ca9058b49c39cc2d9416ba5a6475e1d071f67498ed0` |
| Worker attempts | 1 | 2 |
| Returned Mongo Activity ID | `6ac69f5e59ba4633a38ca9f4` | `6ac69f6159ba4633a38ca9f5` |
| Mongo documents per event | 1 | 1 |

Each persisted key is the `activity:download` prefix plus these common user/job/clip IDs and the action UUID. The replay of the first HTTP action preserved its original queue job/document; a new click produced the second document, even though it required two worker attempts.

## 12. Existing data and cleanup

The read-only audit inspected **93 application Activity documents**. Using identical user/type/entity/job/clip/title/description with the preceding matching record no more than 60 seconds earlier:

| Type | Additional nearby identical candidate rows |
| --- | ---: |
| clip.download | 5 |
| auth.login | 2 |
| credit.purchase | 1 |
| billing.subscription_create | 1 |
| auth.profile_update | 1 |
| **Total** | **10** |

These are candidates, not 10 proven duplicate actions, and not an exhaustive count of duplicates farther apart. There were **zero repeated nonempty dedupe keys**. Automatic preview calls explain why historical download activities can be spurious, but old rows cannot reliably distinguish intentional downloads from URL retrieval, or producer repetition from worker retries. The other types similarly need event-specific review; their cause cannot be proven solely from nearby timestamps.

No application history was deleted. Cleanup is optional after manual review, not required for the fix. The separate `cleanup-reviewed-activities.cjs` defaults to a dry run and requires a manifest with explicit keep/remove IDs, `reviewed: true`, and a reason. Applying requires `--apply --backup <new-file>`; it validates matching records, refuses distinct event/action keys, writes an Extended JSON backup before deletion, retains each keeper, and deletes only the specified unchanged record IDs. Do not select rows for deletion solely from the candidate counts. The cleanup tool was not applied to application history.

Deploy the API, activities worker and updated frontend together. The fix affects future events; it does not hide or rewrite existing activity rows.
