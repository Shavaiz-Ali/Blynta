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
const ClipFailureDetailsDialog = () => {};
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
          expanded = typeof value === "function" ? value(expanded) : value;
        },
      ],
    };
  if (id === "./ClipFailureDetailsDialog") return { ClipFailureDetailsDialog };
  if (id === "@blynta/ui") return { AppButton };
  if (id === "./ClipCardLayout")
    return {
      ClipCardLayout: () => {},
      ClipCardTitle: () => {},
      ClipCardDescription: () => {},
      ClipCardControls: () => {},
      ClipPendingMedia: () => {},
    };
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
    ...React.Children.toArray(element.props?.footer).flatMap(nodes),
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
  assert.equal(
    buttons(
      FailedClipCard({
        ...base,
        clip: { ...base.clip, failure: { retryAvailable: true } },
      }),
    ).length,
    1,
    "Retry availability alone must not open a redundant details dialog",
  );
  assert.ok(
    tree.props.children[0].props.media,
    "Failed clips share the media section",
  );
  assert.ok(
    tree.props.children[0].props.footer,
    "Retry actions belong to the shared footer",
  );
  const props = {
    ...base,
    clip: {
      ...base.clip,
      failure: {
        message: "Captions could not be added.",
        stage: "Adding captions",
        reason:
          "Caption rendering stopped before this clip finished. Retry the clip to finish creating it.",
        attempt: 2,
        failedAt: "2026-10-08T01:00:00Z",
        retryAvailable: true,
      },
    },
  };
  tree = FailedClipCard(props);
  let details = buttons(tree)[1];
  const dialog = (tree) =>
    nodes(tree).find((node) => node.type === ClipFailureDetailsDialog);
  assert.equal(details.props["aria-haspopup"], "dialog");
  assert.equal(dialog(tree).props.open, false);
  details.props.onClick();
  tree = FailedClipCard(props);
  assert.equal(dialog(tree).props.open, true);
  assert.equal(
    nodes(tree).some((node) => node.props?.role === "region"),
    false,
    "No inline disclosure",
  );
  assert.equal(
    dialog(
      FailedClipCard({ ...props, job: { ...props.job, updatedAt: "poll" } }),
    ).props.open,
    true,
    "Polling preserves dialog state",
  );
  dialog(tree).props.onOpenChange(false);
  assert.equal(dialog(FailedClipCard(props)).props.open, false);
  buttons(tree)[1].props.onClick();
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
  assert.equal(
    dialog(FailedClipCard(props)).props.open,
    false,
    "Successful retry closes details",
  );
  buttons(FailedClipCard(props))[1].props.onClick();
  const second = buttons(FailedClipCard(props))[0].props.onClick();
  rejectRetry(new Error("private backend exception"));
  await second;
  assert.equal(errors.length, 1);
  assert.equal(
    dialog(FailedClipCard(props)).props.open,
    true,
    "Failed retry preserves dialog context",
  );
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
    "PASS: failed cards with/without metadata, details dialog, polling persistence, retry success/failure, duplicate clicks, loading, unavailable source, and overall terminal status.",
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
