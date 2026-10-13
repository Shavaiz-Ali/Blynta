// Checked-in CommonJS output allows the independently installed Nest backend and
// Next frontends to consume one TS source without changing deployment entry paths.
const ts = require(
  require.resolve("typescript", {
    paths: [require("node:path").resolve(__dirname, "../packages/types")],
  }),
);
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "packages/types/src/contracts.ts");
const outDir = path.join(root, "packages/types/src/generated");
const program = ts.createProgram([source], {
  declaration: true,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
  outDir,
  skipLibCheck: true,
  types: [],
});
const errors = ts.getPreEmitDiagnostics(program);
if (errors.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (f) => f,
      getNewLine: () => "\n",
    }),
  );
program.emit();
fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify({ type: "commonjs" }) + "\n",
);
