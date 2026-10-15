# generate_patch / clarification investigation

Execution: `118cdae8-02f4-40f3-b34b-8d49b4566195`. Application code remains unchanged during this investigation. No provider requests, FFmpeg executions, uploads, jobs, database mutations or deployment changes were made.

## Exact failed patch recovered

The existing proposal has no persisted patch because the clarification path discarded it. However, its structured-output SHA-256 is `24cb406d21d6a88a959d096de044adff49d3d07f0ba504125385d36194466909`. The following complete parsed envelope reproduces that hash exactly using the same JSON serialization as the deployed diagnostic:

```json
{
  "outcome": "clarification",
  "summary": "Adding an emoji overlay for the entire video duration is not supported.",
  "patchJson": "{\"baseRevision\":1,\"changes\":[]}",
  "unavailableCapabilities": []
}
```

This is a cryptographic match of the complete structured output, not an assumed example. The standalone hash-recovery check and the new regression test independently match it.

Parsing the recovered patch against the actual editPatchSchema produces exactly one Zod issue:

```json
{
  "origin": "array",
  "code": "too_small",
  "minimum": 1,
  "inclusive": true,
  "path": ["changes"],
  "message": "Too small: expected array to have >=1 items"
}
```

Expected: an array with at least one change. Actual: an array with zero changes. `baseRevision` is present and is the valid number 1. There are no operation values, timing values, coordinates or asset references in this patch. No unsupported operation discriminator, missing operation parameter, or out-of-range timestamp caused this particular issue: the model produced no operation at all. The patch JSON itself is syntactically valid.

## Confirmed routing defect

The persisted execution build is revision `1db4ed7f31e50a4e15938cfb014e8079f7073edd`, sourceDirty=false, artifact hash `a2e8bc0c1bc159b78cb5f4294d8ca40aa63af230a1a587c2402fed6f35c3eb0b`.

Only the relevant downstream path is in scope:

1. `generate_patch` returned the schema-valid outer envelope above. Its `patchJson` field is only constrained as a string by answerSchema; the outer schema does not enforce a valid patch or consistency between outcome, summary and patch.
2. diagnosticOutput parsed the patch and recorded `patchSchemaValid=false`, but discarded the Zod issues.
3. `validate` checked `outcome === 'clarification'` before entering patch parsing. It unconditionally emitted USER_INPUT_REQUIRED and returned `{patch: undefined, issues: ''}`. It did not identify any missing input.
4. The conditional edge chose END because issues was empty. It never reached the bounded correction node.
5. The final result copied `result.answer.summary` directly, preserving the inaccurate unsupported claim.

The previous architectural guard only handled unsupported outcomes. The same validation bypass remains through clarification. The correction-node instruction also permits asking for clarification when correction fails, so changing only the first branch would leave another generic fallback.

## Actual planner inputs and overlay contract

Read-only persisted tool metadata confirms the actual output/source duration is 58 seconds, base revision 1, current plan schemaVersion 1, timestampSystem output_seconds, and no existing operations. Asset resolution returned a real image/png asset at 256×256. No asset user input was required.

The generate_patch payload construction passes the resolved asset reference, clip context, complete current plan, capability definitions, interpretation, and full JSON schema generated directly from editPatchSchema. A regression captures the actual serialized planner input and verifies those fields. This establishes both the stored context facts and the deterministic input construction; complete historical request bytes were not stored.

The contract supports both image_overlay and emoji_overlay. A valid emoji change has:

- Envelope: numeric baseRevision and a nonempty changes array.
- Change: action=add, complete operation.
- Operation: id, type=emoji_overlay, numeric start/end, params.
- Params: real owned assetId, emoji, numeric x/y in [0,1], width in [0.01,1]. Other controls have schema defaults.
- Timing: output seconds, start=0 and end=58 for this clip; the timeline validator checks positive interval and output bounds.
- Position: x=y=0.5; the compiler uses `(W-w)*x` and `(H-h)*y` to center the image.

The exact request needs no missing engine capability. The natural-language task asks for the same patch shape as the attached schema and explicitly says non-proposals should have empty patchJson. The actual response instead supplied a nonempty JSON string containing zero changes. That is a model-output inconsistency, not an unsupported overlay contract.

## Proposed minimal application changes — not implemented yet

1. `backend/src/ai-editor/agent/editing-graph.service.ts`: validate a supplied candidate patch before accepting a clarification label. Invalid JSON/schema/timeline/dependencies must produce internal correction issues, then a structured failure if correction is exhausted. Only accept clarification when a typed, specific missing-input reason is identified and consistent with the already loaded context. Remove correction failure's generic clarification fallback. Use validated backend state for the final outcome and a backend-derived proposal summary.
2. `backend/src/ai-editor/agent/agent-diagnostics.ts`: retain bounded, sanitized patch issues, including known schema paths, error codes, expected/actual types and safe numeric constraints/counts. Do not log asset IDs, arbitrary strings, private content or reasoning.
3. Tests: extend the new patch-outcome regression file and diagnostic tests to cover genuine missing input separately from model errors and to prove safe issue redaction.

The EditPlan schema, renderer, interpretation node, frontend, approval behavior and production deployment do not need changes for this fix. The existing API calls a proposed, reviewable edit `pending`; approval is still required. Introducing literal status `proposed` would require an API migration and consumer updates, which is outside this focused fix.

## Test results before implementation

New file: `backend/src/ai-editor/agent/patch-outcome-regression.spec.ts`.

Passing:

1. Complete historical response hash matches; exact Zod issue is changes/minimum 1/actual 0.
2. The exact instruction with a valid model patch resolves the asset, validates the owned PNG/plan/timeline, compiles centered/full-duration filters, and returns pending without modifying the source plan. No FFmpeg process is executed.
3. Reproduces the deployed bug: the recovered invalid patch is returned as clarification, patch validation is not called, and correction is skipped.

Failing regressions, intentionally asserting the required fixed behavior:

1. Invalid patch labeled clarification should reach correction and produce pending when correction is valid; actual status is clarification.
2. Repeated invalid model patches should fail internally; actual result resolves as clarification.
3. A validated supported proposal should not retain an unsupported summary; actual result copies the refusal summary.

Focused Jest run: **3 passed, 3 failed**. These failures reproduce current application defects; they are not provider failures. The model is mocked, while patch schemas, merge, ownership/media validation, timeline validation, and compiler are real. Application code has not been altered to make these tests pass. No complete build is claimed for this investigation-only change.
