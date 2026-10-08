const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript"),
  React = require("react");
const file = path.resolve(
  __dirname,
  "../features/jobs/components/FailedStateCard.tsx",
);
const mod = new Module(file, module);
mod.paths = Module._nodeModulePaths(path.dirname(file));
const original = mod.require.bind(mod);
let queued = false,
  pending = false,
  resolve,
  reject;
const lock = { current: false },
  requests = [],
  errors = [];
const AppButton = () => null;
mod.require = (id) => {
  if (id === "react")
    return {
      ...React,
      useRef: () => lock,
      useState: () => [queued, (value) => (queued = value)],
    };
  if (id === "@blynta/ui") return { AppButton };
  if (id === "./helpers") return { getJobId: (job) => job._id };
  if (id === "sonner")
    return {
      toast: { success() {}, error: (message) => errors.push(message) },
    };
  if (id === "../queries")
    return {
      useRetryJob: () => ({
        isPending: pending,
        mutateAsync: (id) => {
          pending = true;
          requests.push(id);
          return new Promise((yes, no) => {
            resolve = () => {
              pending = false;
              yes({});
            };
            reject = () => {
              pending = false;
              no(new Error("private backend detail"));
            };
          });
        },
      }),
    };
  return original(id);
};
mod._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  file,
);
const render = (job) => mod.exports.FailedStateCard({ job });
const nodes = (e) =>
  !e || typeof e !== "object"
    ? []
    : [e, ...React.Children.toArray(e.props.children).flatMap(nodes)];
const buttons = (tree) => nodes(tree).filter((e) => e.type === AppButton);
const base = {
  _id: "video",
  status: "failed",
  errorStage: "pending",
  errorMessage: "SECRET cookie=xyz /private/file stack trace",
  processingFailure: {
    code: "source_authentication_required",
    message:
      "Couldn’t access this YouTube video. The source may require authentication. Please try again later.",
  },
};
async function run() {
  let tree = render(base);
  assert.equal(buttons(tree).length, 1);
  assert.equal(
    nodes(tree).filter((e) => e.type === "a").length,
    0,
    "No redundant source/navigation row",
  );
  assert.ok(!JSON.stringify(tree).includes("SECRET"));
  const action = buttons(tree)[0].props.onClick;
  const first = action();
  await action();
  assert.equal(requests.length, 1);
  assert.equal(buttons(render(base))[0].props.disabled, true);
  assert.equal(buttons(render(base))[0].props.isLoading, true);
  resolve();
  await first;
  assert.equal(
    buttons(render(base))[0].props.disabled,
    true,
    "Keep duplicate retry blocked while polling catches up",
  );
  queued = false;
  const second = buttons(render(base))[0].props.onClick();
  reject();
  await second;
  assert.equal(errors.length, 1);
  assert.doesNotMatch(errors[0], /private|backend/);
  assert.equal(buttons(render(base))[0].props.disabled, false);
  const legacy = render({ ...base, processingFailure: undefined });
  assert.ok(!JSON.stringify(legacy).includes("SECRET"));
  assert.equal(
    buttons(render({ ...base, deletionRequested: true }))[0].props.disabled,
    true,
  );
  console.log(
    "PASS: compact failed-video recovery, one retry action, safe legacy fallback, duplicate prevention, pending/success/error feedback, and deletion guard.",
  );
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
