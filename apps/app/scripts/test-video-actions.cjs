const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const filename = path.resolve(
  __dirname,
  "../features/jobs/components/VideoActionsDropdown.tsx",
);
const mod = new Module(filename, module);
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const orig = mod.require.bind(mod);
mod.require = (id) =>
  id === "@blynta/ui" ? { AppDropdown: () => null } : orig(id);
mod._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  filename,
);
const render = (overrides) =>
  mod.exports.VideoActionsDropdown({
    sourceUrl: "https://example.com/video",
    cancellationAvailable: true,
    cancelling: false,
    canDelete: false,
    onCancel() {},
    onDelete() {},
    ...overrides,
  }).props.items;
let items = render();
assert.deepEqual(
  items.map((i) => i.label),
  ["Open Source Link", "Cancel processing"],
);
assert.ok(items.every((i) => i.icon));
assert.equal(items[1].separatorBefore, true);
items = render({ cancelling: true, canDelete: true });
assert.equal(items[1].label, "Cancelling processing…");
assert.equal(items[1].disabled, true);
assert.equal(
  items.some((i) => i.label === "Delete video"),
  false,
);
items = render({ cancellationAvailable: false, canDelete: true });
assert.deepEqual(
  items.map((i) => i.label),
  ["Open Source Link", "Delete video"],
);
assert.equal(items[1].destructive, true);
items = render({
  sourceUrl: undefined,
  cancellationAvailable: false,
  canDelete: true,
});
assert.equal(items[0].separatorBefore, false);
console.log(
  "PASS: video menu order, icons, grouping, pending cancellation, and safe deletion visibility.",
);
