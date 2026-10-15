# AI editing classification investigation

## Confirmed root cause

The final planner's capability verdict bypassed the authoritative patch/plan validator. In deployed commit `5d1dd307b98d35071ef65109cb99830e8963c3f3`, `validate` returned `{ patch: undefined, issues: '' }` for every non-proposal model outcome. Its conditional edge therefore chose END; `run()` returned the model's unsupported outcome, and ProposalsService persisted it. No bounded correction was attempted for an unsupported verdict, even when asset resolution had succeeded and the compiler implemented the requested operation.

This is the confirmed application defect. Why the model chose that incorrect semantic verdict cannot be established without its historical raw output; do not substitute an explanation about model reasoning, missing PNGs, or deployment staleness.

## Exact persisted execution

Proposal `6ad0a20532a8f10b4fc47404`, execution `072dae76-bcae-47e5-9a1b-be73f0d04442`, created `2026-10-15T09:51:01.846Z`, model `6acdf04c3208db09578cb0ca`, revision 1:

| UTC time | Persisted evidence |
| --- | --- |
| 09:51:04.007 | get_clip_context: source and output duration 58 seconds, revision 1 |
| 09:51:04.595 | get_current_edit_plan |
| 09:51:05.365 | get_available_assets |
| 09:51:07.927 | Model call 1: success |
| 09:51:09.966 | resolve_asset: real asset ID present, image/png, 256×256, no clarification required |
| 09:51:17.929 | Model call 2: success |
| Terminal proposal | unsupported; summary matches a refusal supplied by the user; no validate_edit_patch tool event |

The executed path follows from those records and the matching deployed graph:

`START → load_context → interpret → resolve_information → resolve_assets → generate_patch → validate → END`.

The first **provable authoritative** unsupported decision is `generate_patch`, call 2. The earlier interpretation response was not retained, so whether its advisory `unsupported` string was already nonempty is unknown. It did not terminate this execution. No third usage record exists, excluding the correction node for this execution.

The historical response can only be reconstructed as `{ outcome: 'unsupported', summary: <persisted refusal>, patchJson: <not retained> }`. Its complete bytes cannot be recovered. The Google adapter parsed the envelope before returning and recording the successful usage call. No parsing/schema exception or catch block converted this run to unsupported: exception handling persists failed; the non-proposal validation shortcut persisted this unsupported outcome directly.

## Deployment and capability payload evidence

Three read-only `/health` samples at approximately 10:00:55 UTC returned the same revision `5d1dd30`, `sourceDirty=false`, build time `09:02:38.555Z`, and artifact hash `0e98f8025904e6dea5e36fce444bd5fabd0ee2f3a153f8456567237857162e07`. That hash matches the local compiled artifact from the previous implementation. The latest failure occurred after that build. This establishes the currently observed API artifact; it is not an exhaustive survey of every upstream or the separate render worker.

The matching compiled capability object has hash `2ce39c2363a32de179c09e66885af2978a69a886c732820325e20b87392443e8` and declares zoom, crop, image_overlay, emoji_overlay, text_overlay, transition and deterministic 😂 generation. `load_context` included that object in interpretation and planning context. The second call additionally received the full editPatch JSON schema, including original-audio updates and up to 20 patch changes. The initial capability object itself omitted original-audio and patch-action contracts; the local candidate now includes those existing schemas directly. These payload facts are reconstructed from matching code/artifact, not a retained historical request body.

The sanitized DB/health snapshot is [ai-editor-classification-evidence.json](./ai-editor-classification-evidence.json). It contains no prompts, transcript, asset names/keys, secrets or reasoning.

## Actual engine support

- `edit-plan.contract.ts`: image/emoji overlays have normalized x/y, width, opacity, fades and timed bounds; zoom has scale/focus controls; original gain accepts 0–2; a plan accepts up to 60 operations.
- `edit-patch.ts`: a patch accepts 1–20 changes, including both adding an operation and updating original audio. Merge preserves unrelated data and checks baseRevision.
- `timeline.ts`: intervals accept start 0 and end equal to output duration; incompatible intervals/complexity remain rejected.
- `ffmpeg-edit-renderer.ts`: overlays compile to `overlay=x=(W-w)*x:y=(H-h)*y`, so x=y=0.5 centers the image. Enable intervals cover the whole compiled duration. Operations are compiled sequentially, independently of the original audio chain.
- `audio-effects.ts`: gain compiles to the existing volume filter. No new filter execution mechanism was introduced.

The independent real FFmpeg fixtures successfully rendered zoom and centered/full-duration generated emoji overlays. The new absolute gain comparisons initially failed at −9 dB versus −6 dB because their input was mono and output stereo. The fixture was changed to a stereo source; that changed render assertion has not been rerun under the user's subsequent no-render restriction. This is not proof of a gain implementation defect or a passed quantitative gain check.

## Local candidate fix

The answer envelope now includes machine-readable unavailable capability IDs constrained to explicitly unimplemented features. A free-form unsupported summary without such a reason no longer exits successfully: it enters the existing bounded correction node. A repeated unverified refusal throws `AI_UNVERIFIED_UNSUPPORTED`, persisted as failed. Invalid model envelopes and invalid patches retain distinct internal error codes; the Google structured-output adapter also preserves Zod parsing failures as `AI_STRUCTURED_OUTPUT_INVALID`. A genuine declared unavailable feature still returns unsupported; unresolved assets and ambiguous information retain clarification. Existing schema/media/ownership/revision validation remains authoritative for every proposal.

Diagnostics record execution/node/call IDs, allowlisted decision fields, schema results, capability/output hashes, asset-resolution counts and routing decisions. They omit summaries, prompts, transcripts, reasoning, arbitrary output values, credentials and R2 keys. Existing proposal records keep at most 64 diagnostic events plus build identity. No new collection or frontend behavior is introduced.

## Deterministic request matrix

All four cases use a 58-second synthetic plan at revision 1 and real patch merge, Zod and timeline/media validation. Model output is mocked deliberately to reproduce the false veto on call 2, then supply the valid patch on the single bounded correction call. These are not live-model success claims.

Common node sequence: `load_context → interpret → resolve_information → resolve_assets → generate_patch → validate → correct → validate → END`.

| Exact instruction | Validated change(s) | Asset resolution | Final local fixture status |
| --- | --- | --- | --- |
| Lower the original audio volume to 50%. | update_original_audio, gain=0.5 | None | pending; Zod/timeline pass |
| Add a zoom from 00:05 to 00:10. | zoom, start=5, end=10 | None | pending; Zod/timeline pass |
| Add a 😂 emoji at the center for the entire video. | emoji_overlay, start=0, end=58, x=y=0.5 | Required; resolved PNG, ownership/media checked | pending; Zod/timeline pass |
| Add a zoom from 00:05 to 00:10 and lower audio volume to 50%. | zoom plus update_original_audio, gain=0.5 | None | pending; Zod/timeline pass |

The original synthetic plan remains unmodified. Additional tests cover repeated refusals becoming failed, genuine unavailable capabilities, malformed parsing, diagnostic redaction and existing approval/ownership behavior.

## Authorized single-provider test findings

The user authorized at most one provider HTTP request for the audio-only instruction, a strict timeout/output cap, no retries, synthetic context, no record writes, no rendering/uploads/jobs, and no deployment/configuration changes.

The test stopped in `ModelRegistry.resolveUserModel → configured → CredentialVault.decrypt` with `ServiceUnavailableException: AI credential could not be authenticated`. The local process cannot authenticate/decrypt the saved credential. This alone does not determine whether its local key configuration differs or stored encrypted material is invalid. No credential/configuration changes were made.

**Provider requests sent: 0. Model response: none. Model schema result: not reached. LangGraph nodes: none. Final test classification: blocked during registry preflight.** No live-model success or refusal can be inferred. Read-only preflight repetitions kept provider calls explicitly disabled. The snapshot is [ai-editor-single-provider-result.json](./ai-editor-single-provider-result.json).

`scripts/test-edit-single-provider.cjs` is explicitly opt-in, caps transport to one HTTP request, uses a 15-second timeout and at most 1024 output tokens, blocks correction calls, and records usage only in memory. Interpretation is supplied as a synthetic fixture so the sole provider call is reserved for patch generation; it is not a two-call end-to-end language interpretation test. It never creates proposals/plans, R2 objects or jobs. The remaining live test requires an authorized environment able to decrypt the existing saved credential. No provider retry was attempted after the preflight failure.

## Verification and status

The initial full editor run passed 132 tests and failed the two new gain comparison assertions described above. The final editor run with FFmpeg rendering explicitly excluded passed **125 tests across 12 suites**. Final backend `npm run build` and ESLint for the changed editor/adapter files passed. Full backend typechecking also has existing unrelated google-validation test-fixture errors documented in the earlier implementation report.

All candidate changes are local and uncommitted. No SSH, deployment, production configuration updates, real record mutations or additional UI/rendering features were performed. Production continues to serve the previous 5d1dd30 artifact; the classifier fix is not deployed and live-model reliability is not yet verified.
