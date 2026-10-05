# Studio production repairs

## Confirmed cause of the remaining clip 404 — October 5

The real Mongoose owner-filtered query was reproduced against the supplied job. Before the fix, `JobSchema.path('userId').instance` was `Mixed`: Nest's schema factory did not turn the BSON constructor `Types.ObjectId` into an ObjectId schema path. The importer supplied a string owner ID, so it was sent unchanged to Mongo and failed to match the stored BSON ObjectId. The user's `/users/me` ID matched the stored owner. Both the clip and its R2 object were present.

Changed the owner property's schema type to `MongooseSchema.Types.ObjectId` in `backend/src/jobs/schemas/job.schema.ts`. The same read-only database check with the rebuilt schema now reports ObjectId casting, a successful owner-filtered job lookup, and a successful exact clip lookup. No ownership checks were removed, and no database migration is needed for this record.

The earlier service tests mocked `jobs.findOne` and therefore missed Mongoose's actual casting. New `job.schema.spec.ts` regressions use the real generated schema and Mongoose queries, with only the database collection mocked. They verify matching ObjectId ownership and rejection of another user.

Deploy/restart the backend with this schema correction. This confirms the previously failing lookup against the actual record; an authenticated production import after deployment remains the final acceptance check. The earlier tentative deployment/account diagnosis below is superseded by this reproduced schema mismatch.

## Confirmed findings

- The supplied job `6abe4d644b3ff2840974672f` and clip `6abe4de08c39dc00dddedd54` exist in the configured Mongo database. The clip is completed, belongs to user `6ab507089b7f22501c40aeb5`, and its canonical R2 object exists: `clips/6abe4d644b3ff2840974672f/clip-1-captioned.mp4` (15,465,928 bytes, video/mp4). This was checked read-only against Mongo and R2.
- The deployed import route exists and rejects an anonymous POST with 401. Its authenticated lookup could not be exercised without the user's session. The reported old error text `Clip media not found` is absent from the current importer. Verify that the deployed API runs this code and uses the same database and authenticated user before attributing the remaining 404 to missing media.
- Fresh signed upload preflights return 403 without `Access-Control-Allow-Origin` for both `https://studio-blynta.vercel.app` and `https://blynta.vercel.app`. The supplied failing URL is a PUT upload, not a metadata polling request.
- R2 object reads work with the available credentials, but reading the bucket's CORS configuration returns `403 AccessDenied`. No bucket configuration was changed.

## Code changes

Studio exposes the existing `MAIN_APP_URL` to client navigation, ahead of a legacy `NEXT_PUBLIC_BLYNTA_URL`. Production builds require an HTTPS destination and reject localhost. There is no production localhost fallback. This covers From Blynta, shell navigation and the account menu.

The project dialog uses explicit responsive choice cards whose content accounts for the shared AppButton wrapper. Desktop uses two columns; mobile stacks them. Upload mode has a compact dashed drop area, a separate browse button, readable helper text, bounded scrolling, and distinct uploading/processing messages. Closing and duplicate submissions are blocked while work is pending. Blank project creation uses the same submission guard.

A blocked upload PUT produces a professional retry message and stops before completion or processing requests. Upload success is only followed by processing after a successful PUT.

R2 HEAD treats only missing objects as absent. Permission and network errors propagate; the importer maps those to a storage-unavailable 503, avoiding false media-not-found responses and incomplete project creation.

## Required deployment/configuration

1. Deploy the backend changes as well as Studio. Deploying the frontend alone does not replace `/studio/from-clip` on the API server. Check the `studio.clip-import.*` logs for the supplied IDs and authenticated user if the new API still returns 404.
2. Configure Studio's deployment environment with `MAIN_APP_URL=https://blynta.vercel.app`, then rebuild/redeploy Studio. Production will now reject a localhost value rather than silently redirecting there.
3. In Cloudflare, open R2 → `blynta` → Settings → CORS policy. Add the rule in `backend/scripts/studio-r2-cors.json`, preserving unrelated existing rules. It allows the exact main/Studio production origins, PUT/GET/HEAD and Content-Type/Range. It does not make the bucket public. Bucket management credentials are required; the available object credentials cannot perform this step.

The reusable `backend/scripts/studio-r2-cors.cjs` supports policy inspection, `--probe` for read-only preflight checks, and `--apply` to merge the named application rule while preserving other rules. The diagnostic script `backend/scripts/audit-clip-import.cjs` reads the supplied job/clip and HEADs its stored object; it never prints credentials or signed URLs.

Cloudflare documents that browser access through signed URLs still requires a bucket CORS policy: [Configure R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## Verification

New production-origin/upload lifecycle regressions pass. Backend suites cover successful HEAD, genuine missing objects, permission/network failures, and import failure classification. Browser verification renders the real dialog at 1440, 768 and 390 pixels: no horizontal overflow or browser exceptions, both creation modes readable, blocked upload sends one PUT and zero completion requests, and retry remains enabled. Screenshots/results are in `dialog-verification/`. The synthetic preview route is removed after verification.

Checks passed: Studio lint, typecheck, production build (with the configured HTTPS MAIN_APP_URL), existing editor/auth tests, and new destination/upload tests; backend typecheck, build and all 24 targeted regression tests. Changed backend files pass lint with one existing Buffer typing warning in R2 download code. The final production build contains no verification route.

This repair is not a claim that production imports or uploads now succeed: backend deployment and the bucket CORS change remain necessary, and the latter was blocked by Cloudflare permissions.
