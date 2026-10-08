const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { QueryClient, QueryObserver } = require("@tanstack/react-query");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative);
  if (!Object.keys(overrides).length && cache.has(filename))
    return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id in overrides) return overrides[id];
    if (id === "../queries" && filename.endsWith("FailedClipCard.tsx"))
      return {
        useRetryClip: () => ({
          isPending: false,
          mutateAsync: async () => ({}),
        }),
      };
    if (id === "@blynta/ui")
      return {
        AppCardRoot: ({ children, ...props }) =>
          React.createElement("div", props, children),
        AppButton: ({ children, icon, isLoading, ...props }) =>
          React.createElement("button", props, icon, children),
      };
    if (id === "./GeneratedClipCard")
      return {
        GeneratedClipCard: ({ clip }) =>
          React.createElement(
            "div",
            { "data-ready-clip": clip._id },
            "Ready clip",
          ),
      };
    if (id === "@/features/dashboard/utils")
      return { getJobDisplayTitle: (job) => job.videoTitle || "Video" };
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), id);
      for (const extension of [".ts", ".tsx"])
        if (fs.existsSync(target + extension))
          return load(path.relative(root, target + extension));
    }
    return original(id);
  };
  mod._compile(compiled, filename);
  if (!Object.keys(overrides).length) cache.set(filename, mod.exports);
  return mod.exports;
}
const { pipelineIndex, percentage, clipState, processingPollInterval } = load(
  "features/jobs/processing-state.ts",
);
const { JobProcessingView } = load(
  "features/jobs/components/JobProcessingView.tsx",
);
const { ClipProcessingCard } = load(
  "features/jobs/components/ClipProcessingCard.tsx",
);
const { useViewMode } = load("features/dashboard/use-view-mode.ts");
const { formatRemainingTime } = load("features/jobs/format-eta.ts");
for (const [seconds, label] of [
  [45, "~45 sec remaining"],
  [90, "~2 min remaining"],
  [1147, "~19 min remaining"],
  [1351, "~23 min remaining"],
  [3600, "~1 hr remaining"],
  [4500, "~1 hr 15 min remaining"],
  [59.9, "~1 min remaining"],
  [3599, "~1 hr remaining"],
  [0, "~0 sec remaining"],
]) {
  assert.equal(formatRemainingTime(seconds), label);
}
for (const invalid of [null, undefined, NaN, Infinity, -Infinity, -1, "90", {}])
  assert.equal(formatRemainingTime(invalid), null);
const job = {
  _id: "video-a",
  videoTitle: "Test video",
  status: "cutting_clips",
  progressPercent: 0,
  clips: [],
  highlights: [],
  transcript: [],
};
function render(Component, props) {
  return renderToStaticMarkup(React.createElement(Component, props));
}
for (const [status, expected] of [
  ["pending", 0],
  ["transcribing", 1],
  ["detecting_highlights", 2],
  ["cutting_clips", 3],
  ["completed", 4],
])
  assert.equal(pipelineIndex({ ...job, status }), expected);
assert.equal(
  pipelineIndex({ ...job, status: "failed", errorStage: "captioning" }),
  3,
);
assert.equal(
  pipelineIndex({ ...job, status: "failed", errorStage: "unreported" }),
  -1,
);
assert.equal(percentage(0), 0);
assert.equal(percentage(120), 100);
assert.equal(percentage(NaN), undefined);
for (const status of ["completed", "failed", "cancelled", undefined])
  assert.equal(processingPollInterval(status), false);
assert.equal(processingPollInterval("cutting_clips"), 1000);
assert.match(
  render(JobProcessingView, { job: { ...job, status: "transcribing" } }),
  /Generating transcript/,
);
assert.doesNotMatch(
  render(JobProcessingView, { job: { ...job, progressPercent: undefined } }),
  /role="progressbar"/,
);
const clips = ["a", "b", "c", "d", "e"].map((_id, i) => ({
  _id,
  startTime: i * 50,
  endTime: i * 50 + 47,
  status: i === 3 ? "completed" : i === 4 ? "failed" : "cutting_clips",
  processingState: i === 2 ? "queued" : "captioning",
}));
const rendering = {
  ...job,
  clips,
  render: {
    ready: 1,
    failed: 1,
    total: 5,
    progressPercent: 63,
    clips: [
      {
        clipId: "a",
        status: "captioning",
        progress: 67,
        processedSeconds: 31,
        durationSeconds: 47,
        etaSeconds: 15,
      },
      {
        clipId: "b",
        status: "captioning",
        progress: 27,
        processedSeconds: 13,
        durationSeconds: 47,
      },
      { clipId: "c", status: "queued", progress: 0 },
    ],
  },
};
const html = render(JobProcessingView, { job: rendering });
const captionCard = render(ClipProcessingCard, {
  job: {
    ...rendering,
    render: {
      ...rendering.render,
      clips: [
        {
          clipId: "a",
          status: "captioning",
          progress: 36,
          stageProgress: 10,
          processedSeconds: 4,
          durationSeconds: 50,
          etaSeconds: 1147,
          etaScope: "stage",
        },
      ],
    },
  },
  clip: clips[0],
  index: 0,
});
assert.match(captionCard, /36%/);
assert.doesNotMatch(captionCard, /10%/);
assert.equal((captionCard.match(/>Adding captions</g) ?? []).length, 1);
assert.ok(captionCard.includes("00:04 / 00:50"));
assert.match(captionCard, /~19 min remaining in this stage/);
const finalizingCard = render(ClipProcessingCard, {
  job: {
    ...rendering,
    render: {
      ...rendering.render,
      clips: [
        {
          clipId: "a",
          status: "uploading",
          progress: 90,
          stageProgress: 0,
          durationSeconds: 50,
        },
      ],
    },
  },
  clip: clips[0],
  index: 0,
});
assert.match(finalizingCard, /90%/);
assert.equal((finalizingCard.match(/>Finalizing</g) ?? []).length, 1);
assert.match(html, /67%/);
assert.match(html, /27%/);
assert.ok(html.includes("00:31 / 00:47"));
assert.match(html, /~15 sec remaining/);
assert.doesNotMatch(html, /~24 min remaining/);
assert.match(
  render(JobProcessingView, {
    job: { ...rendering, estimatedRemainingSeconds: 1440 },
  }),
  /~24 min remaining/,
);
for (const invalid of [undefined, null, NaN, -1, Infinity])
  assert.doesNotMatch(
    render(JobProcessingView, {
      job: { ...rendering, estimatedRemainingSeconds: invalid },
    }),
    /~24 min remaining/,
  );
assert.doesNotMatch(
  render(JobProcessingView, {
    job: { ...rendering, status: "failed", estimatedRemainingSeconds: 1440 },
  }),
  /~24 min remaining/,
);
assert.doesNotMatch(
  render(JobProcessingView, {
    job: { ...rendering, status: "completed", estimatedRemainingSeconds: 1440 },
  }),
  /~24 min remaining/,
);
const longEtaJob = {
  ...rendering,
  render: {
    ...rendering.render,
    clips: rendering.render.clips.map((entry) => ({
      ...entry,
      etaSeconds: 1147,
    })),
  },
};
assert.match(
  render(ClipProcessingCard, { job: longEtaJob, clip: clips[0], index: 0 }),
  /~19 min remaining/,
);
assert.doesNotMatch(
  render(ClipProcessingCard, { job: longEtaJob, clip: clips[0], index: 0 }),
  /1147 sec remaining/,
);
assert.match(html, /1 of 5 clips ready/);
assert.match(html, /data-ready-clip="d"/);
assert.match(html, /Retry clip/);
assert.doesNotMatch(
  render(ClipProcessingCard, { job: rendering, clip: clips[2], index: 2 }),
  /progressbar|animate-spin/,
);
assert.match(
  render(ClipProcessingCard, { job, index: 0 }),
  /Waiting to process/,
);
assert.doesNotMatch(
  render(ClipProcessingCard, { job, index: 0 }),
  /progressbar/,
);
assert.equal(
  clipState({ ...rendering, _id: "video-b", render: undefined }, clips[0])
    .progress,
  undefined,
);
const changed = {
  ...rendering,
  render: {
    ...rendering.render,
    clips: rendering.render.clips.map((p) =>
      p.clipId === "a" ? { ...p, progress: 72 } : p,
    ),
  },
};
assert.match(render(JobProcessingView, { job: changed }), /72%/);
assert.match(render(JobProcessingView, { job: changed }), /27%/);
assert.match(
  render(JobProcessingView, {
    job: { ...rendering, status: "failed", errorStage: "cutting_clips" },
  }),
  /Failed/,
);
assert.match(html, /motion-reduce:animate-none/);
assert.match(html, /grid-cols-1/);
assert.doesNotMatch(html, /skeleton|GPU|FFmpeg/);
function PreferenceProbe() {
  const [mode] = useViewMode("blynta_clips_view_mode");
  return React.createElement(
    "div",
    null,
    mode === null ? "Unknown preference" : mode,
  );
}
assert.equal(render(PreferenceProbe), "<div>Unknown preference</div>");
const events = new EventTarget();
let saved = "list",
  blocked = false;
global.window = {
  localStorage: {
    getItem: () => {
      if (blocked) throw Error("blocked");
      return saved;
    },
    setItem: (_, value) => {
      if (blocked) throw Error("blocked");
      saved = value;
    },
  },
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
  dispatchEvent: events.dispatchEvent.bind(events),
};
let clientSnapshot, serverSnapshot;
const probe = load("features/dashboard/use-view-mode.ts", {
  react: {
    useCallback: (fn) => fn,
    useSyncExternalStore: (_, client, server) => {
      clientSnapshot = client;
      serverSnapshot = server;
      return client();
    },
  },
}).useViewMode;
for (const value of ["list", "grid", null, "invalid"]) {
  saved = value;
  const [mode] = probe("blynta_clips_view_mode");
  assert.equal(mode, value === "list" ? "list" : "grid");
  assert.equal(serverSnapshot(), null);
}
let [, setMode] = probe("blynta_clips_view_mode");
setMode("list");
assert.equal(clientSnapshot(), "list");
setMode("grid");
assert.equal(clientSnapshot(), "grid");
blocked = true;
setMode("list");
assert.equal(clientSnapshot(), "list");
delete global.window;
(async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["jobs", "detail", "video-a"], rendering);
  let finish;
  const observer = new QueryObserver(client, {
    queryKey: ["jobs", "detail", "video-a"],
    queryFn: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  const result = observer.getCurrentResult();
  assert.equal(result.isFetching, true);
  assert.equal(result.isLoading, false);
  assert.equal(result.data, rendering);
  assert.equal(client.getQueryData(["jobs", "detail", "video-b"]), undefined);
  finish(changed);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(observer.getCurrentResult().data, changed);
  unsubscribe();
  client.clear();
  console.log(
    "PASS: SSR preference, persisted list/grid/default/blocked storage, instant switching, cached background fetch, job isolation, pipeline reconstruction, concurrent progress, queued/ready/failed clips, terminal polling, reduced motion and responsive markup.",
  );
})();

// Cancellation remains pollable, then terminates without spinners or stage ETAs.
assert.equal(processingPollInterval("cancelling"), 1000);
assert.equal(processingPollInterval("cancelled"), false);
for (const status of ["cancelling", "cancelled"]) {
  const stoppedJob = {
    ...rendering, status, cancellationRequestedAt: new Date().toISOString(),
    progressPercent: 100, estimatedRemainingSeconds: 100,
    clips: rendering.clips.map((clip, index) => ({
      ...clip,
      status: index === 0 ? "completed" : "cancelled",
      processingState: index === 0 ? "ready" : "cancelled",
    })),
  };
  const stoppedHtml = render(JobProcessingView, { job: stoppedJob });
  assert.match(stoppedHtml, status === "cancelling" ? /Cancelling processing/ : /Processing cancelled/);
  assert.doesNotMatch(stoppedHtml, /animate-spin|sec remaining|min remaining|100%/);
  assert.match(stoppedHtml, /data-ready-clip/);
  assert.match(stoppedHtml, status === "cancelling" ? /Stopping remaining work/ : /Processing cancelled/);
}
console.log("Cancellation UI checks passed");
