const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const filename = path.resolve(
  __dirname,
  "../features/jobs/components/FailedClipCard.tsx",
);
let expanded = false;
const lock = { current: false };
let pending = false;
let resolveRetry, rejectRetry;
const requests = [],
  errors = [],
  successes = [];
const AppButton = () => {};
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = (id) => {
  if (id === "react")
    return {
      ...React,
      useId: () => "details",
      useRef: () => lock,
      useState: () => [
        expanded,
        (value) => {
          expanded = value;
        },
      ],
    };
  if (id === "@blynta/ui") return { AppButton };
  if (id === "sonner")
    return {
      toast: {
        error: (value) => errors.push(value),
        success: (value) => successes.push(value),
      },
    };
  if (id === "../queries")
    return {
      useRetryClip: () => ({
        isPending: pending,
        mutateAsync: (args) => {
          requests.push(args);
          pending = true;
          return new Promise((resolve, reject) => {
            resolveRetry = (value) => {
              pending = false;
              resolve(value);
            };
            rejectRetry = (error) => {
              pending = false;
              reject(error);
            };
          });
        },
      }),
    };
  return original(id);
};
mod._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  filename,
);
const { FailedClipCard } = mod.exports;
const base = {
  job: { _id: "video" },
  clip: { _id: "clip" },
  index: 0,
  title: "Long clip title",
};
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(nodes),
  ];
}
function buttons(tree) {
  return nodes(tree).filter((element) => element.type === AppButton);
}
async function run() {
  let tree = FailedClipCard(base);
  assert.equal(
    buttons(tree).length,
    1,
    "No details action without meaningful metadata",
  );
  assert.ok(
    tree.props.className.includes("self-start"),
    "Failed cards do not stretch to fill the row",
  );
  const props = {
    ...base,
    clip: {
      ...base.clip,
      failure: {
        message: "Captions could not be added.",
        stage: "Adding captions",
        attempt: 2,
        failedAt: "2026-10-08T01:00:00Z",
        retryAvailable: true,
      },
    },
  };
  tree = FailedClipCard(props);
  let details = buttons(tree)[1];
  assert.equal(details.props["aria-expanded"], false);
  details.props.onClick();
  tree = FailedClipCard(props);
  details = buttons(tree)[1];
  assert.equal(details.props["aria-expanded"], true);
  assert.ok(
    React.Children.toArray(details.props.children).includes("Hide details"),
  );
  assert.equal(
    nodes(tree).find((node) => node.props?.id === "details").props.inert,
    false,
  );
  details.props.onClick();
  assert.equal(buttons(FailedClipCard(props))[1].props["aria-expanded"], false);
  const action = buttons(tree)[0].props.onClick;
  const first = action();
  await action();
  await action();
  assert.equal(requests.length, 1, "Rapid clicks submit one request");
  assert.deepEqual(requests[0], { jobId: "video", clipId: "clip" });
  const loading = buttons(FailedClipCard(props))[0];
  assert.equal(loading.props.disabled, true);
  assert.equal(loading.props.isLoading, true);
  resolveRetry({});
  await first;
  assert.equal(successes.length, 1);
  const second = buttons(FailedClipCard(props))[0].props.onClick();
  rejectRetry(new Error("private backend exception"));
  await second;
  assert.equal(errors.length, 1);
  assert.doesNotMatch(errors[0], /private|exception/);
  assert.equal(lock.current, false);
  const unavailable = buttons(
    FailedClipCard({
      ...props,
      clip: {
        ...props.clip,
        failure: {
          message: "Original video unavailable",
          retryAvailable: false,
        },
      },
    }),
  )[0];
  assert.equal(unavailable.props.disabled, true);
  await unavailable.props.onClick();
  assert.equal(requests.length, 2);
  const stateFile = path.resolve(
    __dirname,
    "../features/jobs/processing-state.ts",
  );
  const states = new Module(stateFile, module);
  states._compile(
    ts.transpileModule(fs.readFileSync(stateFile, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    stateFile,
  );
  const job = {
    status: "failed",
    clips: [{ status: "completed" }, { status: "failed" }],
  };
  assert.equal(states.exports.completedWithIssues(job), true);
  assert.equal(states.exports.pipelineIndex(job), 4);
  assert.equal(
    states.exports.completedWithIssues({
      ...job,
      status: "cutting_clips",
      clips: [{ status: "completed" }, { status: "pending" }],
    }),
    false,
  );
  console.log(
    "PASS: failed cards with/without metadata, show/hide details, accessible expansion, retry success/failure, duplicate clicks, loading, unavailable source, and overall terminal status.",
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
