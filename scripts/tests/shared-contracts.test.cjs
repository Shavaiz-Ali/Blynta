const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const contracts = require("../../packages/types/src/generated/contracts.js");
test("persisted job and clip identifiers stay compatible", () => {
  assert.deepEqual(Object.values(contracts.JobStatus), [
    "pending",
    "transcribing",
    "detecting_highlights",
    "cutting_clips",
    "completed",
    "failed",
    "cancelling",
    "cancelled",
  ]);
  assert.deepEqual(Object.values(contracts.ClipProcessingState), [
    "queued",
    "cutting",
    "captioning",
    "uploading",
    "ready",
    "cancelled",
    "failed",
  ]);
  assert.deepEqual(contracts.AI_TASKS, [
    "highlight_detection",
    "edit_planning",
    "edit_refinement",
  ]);
});
test("route builders encode identifiers without changing valid persisted IDs", () => {
  assert.equal(
    contracts.API_ENDPOINTS.editor.plan("abc-123"),
    "/ai-editor/plans/abc-123",
  );
  assert.equal(
    contracts.API_ENDPOINTS.editor.proposal("clip/a", "p?x"),
    "/clips/clip%2Fa/ai-edit/proposals/p%3Fx",
  );
  assert.equal(contracts.ADMIN_ROUTES.user("a/b"), "/users/a%2Fb");
  assert.equal(
    contracts.API_ENDPOINTS.aiAdmin.credentials("id#1"),
    "/admin/ai/providers/id%231/credentials",
  );
});
test("backend and frontend resolve the same generated runtime contract", () => {
  const backendRequire = createRequire(path.join(root, "backend/package.json"));
  const appRequire = createRequire(path.join(root, "apps/app/package.json"));
  assert.deepEqual(
    backendRequire("@blynta/types/contracts").AI_TASKS,
    appRequire("@blynta/types/contracts").AI_TASKS,
  );
});
test("checked-in runtime is generated from its single TypeScript source", () => {
  const ts = require(
    require.resolve("typescript", {
      paths: [path.join(root, "packages/types")],
    }),
  );
  const source = fs.readFileSync(
    path.join(root, "packages/types/src/contracts.ts"),
    "utf8",
  );
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  assert.equal(
    fs
      .readFileSync(
        path.join(root, "packages/types/src/generated/contracts.js"),
        "utf8",
      )
      .replace(/\r\n/g, "\n"),
    emitted.replace(/\r\n/g, "\n"),
  );
});
