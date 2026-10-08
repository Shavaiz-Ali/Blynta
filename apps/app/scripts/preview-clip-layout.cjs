// Local visual fixture using the production card components and shared theme.
// Run from apps/app: node scripts/preview-clip-layout.cjs
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const http = require("node:http");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const lucide = require("lucide-react");
const root = path.resolve(__dirname, "..");
const ui = path.resolve(root, "../../packages/ui/src");
const cache = new Map();
let expanded = false;
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id === "react" && filename.endsWith("FailedClipCard.tsx"))
      return { ...React, useState: () => React.useState(expanded) };
    if (id === "@blynta/ui")
      return {
        AppCardRoot: load(path.join(ui, "primitives/card.tsx")).Card,
        AppButton: load(path.join(ui, "components/AppButton.tsx")).AppButton,
        AppDialog: () => null,
        AppDropdown: ({ trigger }) => trigger,
      };
    if (id === "next/navigation") return { useRouter: () => ({ push() {} }) };
    if (id === "../queries" || id === "@/features/jobs")
      return {
        useRetryJob: () => ({
          isPending: false,
          mutateAsync: async () => ({}),
        }),
        useRetryClip: () => ({
          isPending: false,
          mutateAsync: async () => ({}),
        }),
        useDeleteClip: () => ({ isPending: false }),
        useDownloadClip: () => ({ isPending: false }),
      };
    if (id === "@/features/jobs/types")
      return load(path.join(root, "features/jobs/types.ts"));
    if (id === "@/features/dashboard/utils")
      return { getJobDisplayTitle: (job) => job.videoTitle || job.sourceUrl };
    if (id === "@/lib/utils") return load(path.join(ui, "lib/utils.ts"));
    if (id === "@/features/dashboard/icons")
      return Object.fromEntries(
        Object.entries(lucide).map(([name, value]) => [name + "Icon", value]),
      );
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), id);
      for (const ext of [".ts", ".tsx"])
        if (fs.existsSync(target + ext)) return load(target + ext);
    }
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
  cache.set(filename, mod.exports);
  return mod.exports;
}
async function start() {
  const postcss = Module.createRequire(require.resolve("@tailwindcss/postcss"))(
    "postcss",
  );
  const css = await postcss([require("@tailwindcss/postcss")()]).process(
    fs.readFileSync(path.join(root, "app/globals.css"), "utf8"),
    { from: path.join(root, "app/globals.css") },
  );
  const { GeneratedClipCard } = load(
    path.join(root, "features/jobs/components/GeneratedClipCard.tsx"),
  );
  const { ClipProcessingCard } = load(
    path.join(root, "features/jobs/components/ClipProcessingCard.tsx"),
  );
  const clips = [
    "failed",
    "completed",
    "cutting_clips",
    "pending",
    "failed",
    "completed",
  ].map((status, index) => ({
    _id: "clip-" + index,
    startTime: index * 50,
    endTime: index * 50 + 48,
    status,
    processingState: status === "cutting_clips" ? "captioning" : "queued",
    ...(status === "failed" && index === 0
      ? {
          failure: {
            message: "Captions could not be added to this clip.",
            stage: "Adding captions",
            reason:
              "Caption rendering stopped before the clip finished. Retry to create it again.",
            attempt: 2,
            retryAvailable: true,
          },
        }
      : {}),
  }));
  const highlights = clips.map((clip, index) => ({
    ...clip,
    clipTitle: [
      "A surprising introduction",
      "A moment worth sharing",
      "An unexpectedly long clip title that should truncate gracefully",
      "The next highlight",
      "Another moment",
      "The perfect ending",
    ][index],
    score: 0.96,
    reason:
      index === 1
        ? "An unexpected reveal turns into the standout moment of the conversation."
        : undefined,
  }));
  const job = {
    _id: "preview",
    clips,
    highlights,
    render: {
      clips: [
        {
          clipId: clips[2]._id,
          status: "captioning",
          progress: 45,
          processedSeconds: 22,
          durationSeconds: 48,
          etaSeconds: 90,
        },
      ],
    },
  };
  const server = http.createServer((request, response) => {
    if (request.url === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css.css);
      return;
    }
    expanded = request.url.includes("expanded");
    if (request.url.includes("failure")) {
      const failedJob = {
        ...job,
        status: "failed",
        errorStage: request.url.includes("transcript")
          ? "transcribing"
          : "pending",
        videoTitle: "Long title already shown in the main video header",
        clips: [],
        highlights: [],
        render: undefined,
        processingFailure: {
          code: request.url.includes("transcript")
            ? "processing_failed"
            : "source_authentication_required",
          message: request.url.includes("transcript")
            ? "We couldn’t generate the transcript for this video. Retry processing to continue."
            : "Couldn’t access this YouTube video. The source may require authentication. Please try again later.",
        },
      };
      const content = React.createElement(
        "main",
        { className: "mx-auto max-w-3xl space-y-4 p-4 sm:p-6" },
        React.createElement(
          load(
            path.join(root, "features/jobs/components/JobProcessingView.tsx"),
          ).JobProcessingView,
          { job: failedJob },
        ),
        React.createElement(
          load(path.join(root, "features/jobs/components/FailedStateCard.tsx"))
            .FailedStateCard,
          { job: failedJob },
        ),
      );
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><html class="dark"><head><title>Blynta failure preview</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-background text-foreground">' +
          renderToStaticMarkup(content) +
          "</body></html>",
      );
      return;
    }
    const width = request.url.includes("mobile")
      ? 390
      : request.url.includes("tablet")
        ? 820
        : undefined;
    const scenarioClips = clips.map((clip, index) =>
      request.url.includes("multiple") && index < 3
        ? {
            ...clip,
            status: "cutting_clips",
            processingState: ["cutting", "captioning", "uploading"][index],
          }
        : request.url.includes("multiple") && index === 4
          ? { ...clip, status: "cancelled", processingState: "cancelled" }
          : request.url.includes("ring") && index === 0
            ? { ...clip, status: "completed" }
            : clip,
    );
    const scenarioJob = request.url.includes("multiple")
      ? {
          ...job,
          render: {
            ...job.render,
            clips: scenarioClips.slice(0, 3).map((clip, index) => ({
              clipId: clip._id,
              status: clip.processingState,
              progress: [0, 38, 99][index],
              durationSeconds: 48,
              processedSeconds: 22,
              etaSeconds: 90,
            })),
          },
        }
      : job;
    const cards = scenarioClips.map((clip, index) =>
      React.createElement(
        clip.status === "completed" ? GeneratedClipCard : ClipProcessingCard,
        {
          key: clip._id,
          job: scenarioJob,
          clip,
          highlight: highlights[index],
          clipIndex: index,
          index,
        },
      ),
    );
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html><html class="dark"><head><title>Blynta mixed clip layout</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-background text-foreground"><main style="${width ? `width:${width}px;` : "max-width:1200px;"}margin:32px auto;padding:24px"><h1 class="mb-6 text-lg font-semibold">Creating your clips</h1><div class="grid grid-cols-1 gap-x-3 gap-y-4 ${width === 390 ? "" : width === 820 ? "grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}">${renderToStaticMarkup(React.createElement(React.Fragment, null, ...cards))}</div></main></body></html>`,
    );
  });
  server.listen(4317, "127.0.0.1", () =>
    console.log(
      "Clip layout preview: http://127.0.0.1:4317 (also /expanded, /mobile, /tablet)",
    ),
  );
}
start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
