const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript"),
  React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(relative) {
  const filename = path.resolve(__dirname, "../features/jobs", relative);
  const mod = new Module(filename, module);
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) =>
    id.startsWith(".")
      ? load(
          path.relative(
            path.resolve(__dirname, "../features/jobs"),
            path.resolve(path.dirname(filename), id),
          ) + ".ts",
        )
      : original(id);
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const { CircularClipProgress } = load("components/CircularClipProgress.tsx");
for (const value of [0, 30, 38, 99, 100]) {
  const html = renderToStaticMarkup(
    React.createElement(CircularClipProgress, {
      value,
      stage: "Adding captions",
    }),
  );
  assert.match(html, new RegExp('aria-valuenow="' + Math.min(value, 99) + '"'));
  assert.match(html, /transition-\[stroke-dashoffset\]/);
  assert.match(html, /motion-reduce:animate-none/);
  const svgs = html.match(/<svg.*?<\/svg>/g);
  assert.equal(svgs.length, 2);
  assert.doesNotMatch(svgs[0], /animate-spin/);
  assert.match(svgs[1], /animate-spin/);
}
for (const value of [undefined, NaN, Infinity]) {
  const html = renderToStaticMarkup(
    React.createElement(CircularClipProgress, {
      value,
      stage: "Cutting video",
    }),
  );
  assert.doesNotMatch(html, /aria-valuenow/);
  assert.match(html, /Waiting for progress update/);
}
const { mergeJobProgress } = load("merge-job-progress.ts");
const sample = (progress, status = "captioning", updatedAt = 200) => ({
  clipId: "clip",
  status,
  progress,
  durationSeconds: 50,
  updatedAt,
});
const job = (entry) => ({
  _id: "job",
  updatedAt: "2026-10-08T01:00:00Z",
  clips: [
    { _id: "clip", status: "cutting_clips", updatedAt: "2026-10-08T01:00:00Z" },
  ],
  render: { clips: [entry] },
});
const old = job(sample(60));
const missing = mergeJobProgress(old, { ...old, render: undefined });
assert.equal(
  missing.render.clips[0].progress,
  60,
  "Missing samples retain known overall progress",
);
assert.equal(
  missing.render.clips[0].etaSeconds,
  undefined,
  "Missing samples never retain an old ETA",
);
assert.equal(
  mergeJobProgress(missing, job(sample(30, "captioning", 300))).render.clips[0]
    .progress,
  60,
);
assert.equal(
  mergeJobProgress(old, job(sample(30, "captioning", 300))).render.clips[0]
    .progress,
  60,
);
assert.equal(
  mergeJobProgress(old, job(sample(90, "uploading", 100))).render.clips[0],
  old.render.clips[0],
);
assert.equal(
  mergeJobProgress(old, job(sample(20, "cutting", 300))).render.clips[0],
  old.render.clips[0],
);
assert.equal(
  mergeJobProgress(old, job(sample(90, "uploading", 300))).render.clips[0]
    .progress,
  90,
);
assert.equal(
  mergeJobProgress(old, {
    ...job(sample(70)),
    updatedAt: "2026-10-08T00:00:00Z",
  }),
  old,
);
assert.equal(
  mergeJobProgress({ ...old, render: undefined }, job(sample(0, "queued", 300)))
    .render.clips[0].progress,
  0,
  "Confirmed retry resets progress",
);
const externalRetry = job(sample(0, "queued", 300));
externalRetry.clips[0].updatedAt = "2026-10-08T01:01:00Z";
assert.equal(mergeJobProgress(old, externalRetry).render.clips[0].progress, 0);
assert.equal(
  mergeJobProgress(old, { ...job(sample(0)), _id: "another" }).render.clips[0]
    .progress,
  0,
);
console.log(
  "PASS: circular arc accuracy, unknown/0/99% progress, anchored arc, reduced motion, stage transitions, stale polls, monotonic progress, retry resets, and job isolation.",
);
