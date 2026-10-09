# Quality-first highlight discovery and pipeline cache rollout

## Proven incident

Job `6ac8e71caab3a05c10d8a725` used Business, a nine-clip cap and 540 authorized output seconds. The source was approved at 3233 seconds and measured at 3233.461 seconds. Five accepted intervals totalled 257.4 seconds, leaving 282.6 seconds of authorization. Five highlights became five persisted clips; neither budget nor UI truncation caused the result.

Worker logs show the initial response exhausted its output-token limit. The strict JSON retry returned six candidates; one failed duration validation. The recovery request examined only 55 transcript segments and returned zero. The logs do not preserve the rejected candidate's timestamps, so they cannot prove which duration boundary it violated. The root cause is candidate underproduction after truncation, a duration rejection, and narrow recovery coverage.

Existing jobs keep their saved selections and render manifests. This change does not regenerate or alter that job's five clips.

## Behavior and code map

- `media/highlight-policy.ts` remains the backend policy: Free maximum six, Pro/Business maximum nine, minimum zero. Automatic output authorization remains bounded by source duration and `cap * 60` seconds. Confirmation and job cards now describe maximums, without promising a minimum.
- `media/services/highlight-detection.service.ts` discovers candidates independently of plan and output authorization. Google discovery uses overlapping transcript windows bounded by 900 seconds and 18,000 characters; Groq retains its smaller provider-specific chunks. Requests ask for a broader candidate pool, allow zero results, and use effective preset instructions together with normalized custom instructions. Long sources receive source-wide coverage rather than one oversized request.
- One bounded recovery pass can examine all meaningful uncovered regions after validation losses or incomplete discovery on long sources. It keeps the same quality threshold; sparse but complete successful results do not trigger quota filling. Failed or partial discovery may supply valid clips to the current job but is not published as a successful shared artifact.
- Validation checks actual source bounds, finite timestamps and scores, transcript coverage and quoted grounding, context completeness, preset relevance, duplicate timestamps/content, and durations. Existing long-source clip length rules remain 45–60 seconds for sources of at least ten minutes; short-source clips may be shorter. Subtraction normalizes floating-point noise without extending the duration limit.
- `media/highlight-selection.ts` selects the strongest non-overlapping combination within the current job's clip cap and immutable approved output allowance. It never trims clips to squeeze them into the budget.
- `jobs/jobs.processor.ts` orchestrates the real media, transcript, candidate-cache and per-job selection paths. `JobsService.prepareRenderManifest` saves the accepted highlights and matching clip rows together, so progress/cards describe the same selected set. Resume uses the job's existing manifest/highlights and idempotent fanout.

## Separate cache layers

| Input change or failure                                      | Video/audio                           | Transcript                                  | Highlight candidates                                  |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| Same source and effective instructions                       | Reuse if valid                        | Reuse if compatible                         | Reuse complete compatible pool                        |
| Different preset or custom instructions                      | Reuse                                 | Reuse                                       | Redetect                                              |
| Same nonempty custom prompt, same owner                      | Reuse                                 | Reuse                                       | Reuse                                                 |
| Free to paid                                                 | Reuse                                 | Reuse                                       | Reuse full pool; select using new job's authorization |
| Model/template/algorithm or preset instruction change        | Reuse                                 | Reuse                                       | Redetect                                              |
| Transcription configuration or source content version change | Validate source                       | Retranscribe                                | Redetect                                              |
| Missing/corrupt audio                                        | Keep valid video, extract audio again | Reuse compatible transcript                 | Reuse compatible pool                                 |
| Missing/corrupt video                                        | Repair through original downloader    | Reuse only if repaired content/config match | Reuse only if identities match                        |
| Interrupted ASR/detection                                    | Retain valid published media          | Retry missing complete artifact             | Retry missing complete artifact                       |

The existing canonical `SourceVideo` record remains the media pointer. YouTube identity is provider plus normalized video ID; tracking/query parameters do not create new media identities. Objects are verified through download, media probing, and SHA-256 content hashes. Compatible audio has its own hash. Valid media is published before transcription completes, so an ASR failure does not force another download.

The new internal `pipelineartifacts` collection stores separate immutable transcript and candidate-pool records. Deterministic canonical serialization and SHA-256 identify artifacts and verify payloads. Transcript identity includes source content version and provider/model/settings/language/timestamp/schema compatibility. Local Whisper model and binary fingerprints invalidate when their files change. Highlight identity includes canonical source/content version, transcript plus transcription configuration, preset ID/effective instructions, normalized custom prompt, prompt template, model/settings and detection algorithm version (`quality-discovery-v3`). The pool excludes final plan limits and output budgets.

Absent and whitespace-only custom prompts normalize alike. Nonempty custom prompts are hashed and owner-scoped. Equivalent private instructions therefore reuse within an owner rather than exposing a previous user's private artifacts. Public/default preset pools can be shared only for sources verified accessible without authentication cookies. An anonymous metadata probe ignores local yt-dlp configuration. Sources that cannot be verified public bypass shared source reuse, and private/restricted YouTube downloads using server cookies are rejected. Other job-owned media/artifacts remain owner-scoped; this change does not introduce a user-upload endpoint.

Artifact payloads and raw prompts/transcripts are not public download resources or cache-key/log text. Source object paths contain hashes rather than custom instructions. Successful artifacts are inserted once; invalid/expired records can be replaced under a distributed lease. Redis leases use unique ownership tokens, renewal, owner-checked release and expiry after a crash. Publication verifies ownership; interrupted and failed work releases its lease. Mongo's unique key index is the final duplicate-write guard.

Retention defaults to 30 days, configurable with positive `PIPELINE_CACHE_TTL_DAYS`. Retention expiry or missing/corrupt data causes regeneration. Legacy plan-limited `defaultHighlightsByPreset` values are ignored, not migrated into candidate pools. Legacy transcripts without a configuration fingerprint receive a cold refresh. Canonical media pointers can refresh; content-addressed files and versioned artifacts remain distinct. Same-duration upstream edits are detected on refresh, not instantly while a verified cached media version remains within retention.

## Billing and observability

Each job still passes existing Billing V2 admission, credit reservation and source-duration validation before candidate reuse. Cache hits do not introduce discounted pricing or change the saved pricing snapshot. Selection and the final manifest both enforce current authorization. Settlement uses delivered clips, preserves the existing idempotency mechanisms and releases unused reservations. Cached artifacts never act as another job's financial authority. Authorization failures remain non-retryable under the existing source-budget handling.

Structured events report media/audio hits and repair reasons, transcript/highlight hits or misses, algorithm/configuration identities, safe preset identifiers/hashes, source duration and discovery coverage, candidate/rejection counts, bounded recovery outcomes, selected count/duration, authorized remaining output, and avoided LLM/ASR calls. Provider failures log error classes rather than raw prompt/response text. Quality and context annotations are model judgments backed by timestamp/quote/coverage validation, not an independent guarantee of editorial quality.

## Deployment prerequisites — no automatic deployment

1. Build one release and run the checks below. Use a dedicated staging account with its own balance/reservation to verify cold processing and repeat cache hits, different styles/prompts, concurrent submissions, and settlement. Unit tests use controlled external-provider, Redis, Mongo and R2 substitutes; real service behavior still needs this staging smoke check. Never use production users' jobs to exercise failures.
2. Ensure the new collection's indexes exist before resuming pipeline workers. These are additive; no ledger, pricing or historical clip migration is needed. Against the intended database, an operator can run:

   ```javascript
   db.pipelineartifacts.createIndex({ key: 1 }, { unique: true });
   db.pipelineartifacts.createIndex(
     { expiresAt: 1 },
     { expireAfterSeconds: 0 },
   );
   ```

3. Keep `BILLING_CREDITS_V2=true` on both API and pipeline workers, with matching pricing/configuration. Existing Redis, R2, transcription and LLM configuration remains required. `PIPELINE_CACHE_TTL_DAYS=30` is optional; it must be positive.
4. If the clips bucket has public access / `R2_PUBLIC_DOMAIN`, provision a separate **private** source bucket and set `R2_SOURCE_BUCKET_NAME` on every API/worker that reads or writes source objects. Credentials must cover that bucket. It must differ from the public clips bucket and have no public domain/access. Source video/audio URLs now always use signed access. The source storage guard fails closed when a public-domain configuration lacks a separate source bucket. If the original bucket is already private and no public domain is configured, the extra bucket variable is optional; verify its privacy in R2 rather than inferring it from an absent environment variable.
5. Before switching a deployment that already stores sources publicly, copy all referenced `source-videos/` and `job-sources/` objects to the private bucket **with identical keys** and verify checksums/existence. Include historical job and studio source references, not just current cache records. Remove public source copies or otherwise eliminate their public access as part of the operator-managed migration. Do not move public clip objects. Automatic cache regeneration alone is insufficient for historical jobs that still need their source objects.
6. Pause new submissions, drain active pipeline **and render** jobs, and stop old media workers before changing source-bucket routing. Deploy the API and workers from the same built Git revision and environment, then resume. Do not mix old/new workers writing a shared cache or old/new source-bucket configurations. Record the actual running revision and process start times; equal PM2 uptime alone does not prove compatible code. Model/binary changes should use immutable versioned files followed by coordinated worker restart.
7. Observe a restricted staging cold job, a cache-hit job and a changed-style job. Confirm source authorization remains intact, selected duration fits approval, each job has its own reservation/settlement/ledger entries, no duplicate clips/charges appear on resume, and leases expire/release correctly. Restore traffic only after this check and source privacy/index verification.

No migration, production mutation or deployment was performed during implementation.

## Verification

Backend build and backend/frontend TypeScript checks passed. The full backend run passed 453 tests, with two existing fixture failures and three skipped Mongo tests. Subsequently added/updated focused regressions passed 54 tests across detection, cache, model fingerprinting and the actual processor; the final detection/processor rerun passed all 44 tests. All 11 billing interaction tests and processing-state/responsive-markup checks passed. External providers and persistence are substituted in these local cache tests; these results do not replace the real-service staging check.

The full backend suite retains existing AppController database-provider fixture and NotificationsService save-result mock failures. Three transactional Mongo billing tests require a dedicated test replica set and are skipped without its URI. Consult the existing Billing V2 rollout documentation for that integration-test setup; do not point tests at production. Existing lint findings remain in legacy service code; newly added cache/processor test files are lint clean.
