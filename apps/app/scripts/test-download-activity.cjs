const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
const {
  QueryClient,
  QueryObserver,
  MutationObserver,
} = require("@tanstack/react-query");
const root = path.resolve(__dirname, "..");
const requests = [];
let failNextPost = false;
const axiosClient = {
  get: async (url) => {
    requests.push({ method: "GET", url });
    return { data: { signedUrl: "https://example.test/preview" } };
  },
  post: async (url, body) => {
    requests.push({ method: "POST", url, body });
    if (failNextPost) {
      failNextPost = false;
      throw new Error("lost response");
    }
    return { data: { signedUrl: "https://example.test/download" } };
  },
};
function load(relative) {
  const filename = path.resolve(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id === "@tanstack/react-query")
      return {
        useMutation: (options) => options,
        useQuery: (options) => options,
      };
    if (id === "@/config/axiosClient") return { axiosClient };
    if (id.startsWith("."))
      return load(
        path.relative(root, path.resolve(path.dirname(filename), id + ".ts")),
      );
    return original(id);
  };
  mod._compile(compiled, filename);
  return mod.exports;
}
async function main() {
  const hooks = load("features/jobs/queries.ts");
  const client = new QueryClient();
  try {
    const previewOptions = hooks.useClipSignedUrl("video", "clip");
    const preview = new QueryObserver(client, previewOptions);
    const unsubscribe = preview.subscribe(() => {});
    await preview.refetch();
    await preview.refetch();
    await client.prefetchQuery({
      ...previewOptions,
      queryKey: ["clip-url", "video", "adjacent"],
    });
    unsubscribe();
    assert.ok(requests.length >= 3);
    assert.ok(
      requests.every(
        (request) =>
          request.method === "GET" && request.url.endsWith("/media-url"),
      ),
    );
    requests.length = 0;
    const download = new MutationObserver(client, hooks.useDownloadClip());
    const click = { jobId: "video", clipId: "clip", actionId: randomUUID() };
    await download.mutate(click);
    assert.equal(requests.length, 1, "One action sends one HTTP request");
    assert.deepEqual(requests[0], {
      method: "POST",
      url: "/jobs/video/clips/clip/download",
      body: { actionId: click.actionId },
    });
    const retried = new MutationObserver(
      client,
      hooks.useDownloadClip({ retry: 1, retryDelay: 0 }),
    );
    failNextPost = true;
    await retried.mutate(click);
    assert.equal(requests.length, 3);
    assert.equal(
      requests[1].body.actionId,
      requests[2].body.actionId,
      "Mutation retry retains action identity",
    );
    await download.mutate({ ...click, actionId: randomUUID() });
    assert.notEqual(
      requests[0].body.actionId,
      requests[3].body.actionId,
      "A separate click has a new identity",
    );
    // Guard the specific automatic callers that originally generated download rows.
    const source = (relative) =>
      fs.readFileSync(path.join(root, "features/jobs", relative), "utf8");
    const studio = source("components/StudioCenterPanel.tsx");
    assert.ok(studio.includes("useClipSignedUrl(jobId, clipId)"));
    assert.ok(
      !studio.includes("useDownloadClip") && !studio.includes("mutateAsync"),
    );
    const detail = source("components/ClipDetailView.tsx");
    assert.ok(
      detail.includes("${prevClipId}/media-url") &&
        detail.includes("${nextClipId}/media-url"),
    );
    assert.ok(!detail.includes("window.open(videoSrc"));
    for (const name of [
      "GeneratedClipCard",
      "StudioRightPanel",
      "ClipDetailView",
    ]) {
      assert.ok(
        source(`components/${name}.tsx`).includes(
          "actionId: crypto.randomUUID()",
        ),
      );
    }
    console.log(
      "PASS: one download action -> one POST; retry retains identity; next action changes identity; preview/refetch/prefetch -> GET media-url only; automatic callers guarded.",
    );
  } finally {
    client.clear();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
