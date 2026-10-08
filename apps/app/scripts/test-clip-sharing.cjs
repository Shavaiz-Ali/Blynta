const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const component = () => null;
const ui = Object.fromEntries(
  ["AppDropdown", "AppDialog", "AppButton", "AppInput", "AppSelect"].map(
    (name) => [name, function Stub() {}],
  ),
);
const ShareDialog = function SharedDialog() {};
const ClipHeader = function Header() {};
const job = {
  _id: "job-123",
  status: "completed",
  clips: [{ _id: "clip-456", startTime: 0, endTime: 30 }],
  highlights: [{ clipTitle: "Selected clip" }],
};

// Execute the production components with isolated hook state and API boundaries.
function harness(relativePath, mocks) {
  const state = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  const filename = path.join(root, relativePath);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (id) => {
    if (id === "react")
      return {
        ...React,
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = initial;
          return [
            state[index],
            (value) => {
              state[index] =
                typeof value === "function" ? value(state[index]) : value;
            },
          ];
        },
        useRef(initial) {
          const index = refCursor++;
          return (refs[index] ||= { current: initial });
        },
        useMemo: (fn) => fn(),
        useEffect() {},
      };
    if (id in mocks) return mocks[id];
    if (id === "@blynta/ui") return ui;
    if (id === "sonner")
      return { toast: { info() {}, success() {}, error() {} } };
    if (id === "@/features/dashboard/icons")
      return new Proxy({}, { get: () => component });
    return require(id);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return (...args) => {
    cursor = 0;
    refCursor = 0;
    return Object.values(mod.exports)[0](...args);
  };
}

function elements(tree) {
  if (!React.isValidElement(tree)) return [];
  return [
    tree,
    ...React.Children.toArray(tree.props.children).flatMap(elements),
    ...["footer", "media"].flatMap((key) => elements(tree.props[key])),
  ];
}
const find = (tree, type) => elements(tree).find((el) => el.type === type);
const button = (tree, label) =>
  elements(tree).find(
    (el) => el.type === ui.AppButton && el.props.children === label,
  );

test("card menu closes before opening the shared dialog for the selected clip", async () => {
  const downloads = [];
  const deletions = [];
  const navigation = [];
  global.window = { open() {} };
  const render = harness("features/jobs/components/GeneratedClipCard.tsx", {
    "next/navigation": {
      useRouter: () => ({ push: (url) => navigation.push(url) }),
    },
    "@/features/shares": { ShareDialog },
    "@/features/jobs": {
      useDeleteClip: () => ({
        mutateAsync: async (input) => deletions.push(input),
      }),
      useDownloadClip: () => ({
        mutateAsync: async (input) => {
          downloads.push(input);
          return { signedUrl: "https://example.com/download" };
        },
      }),
    },
    "@/lib/utils": { cn: (...values) => values.join(" ") },
    "./ClipCardLayout": new Proxy({}, { get: () => component }),
    "../clip-time": {
      clipTimeRange: () => ({ duration: 30, start: 0, end: 30 }),
      formatClipTime: String,
    },
  });
  const props = {
    job,
    clip: job.clips[0],
    highlight: job.highlights[0],
    clipIndex: 0,
  };
  let tree = render(props);
  let dropdown = find(tree, ui.AppDropdown);
  assert.deepEqual(
    dropdown.props.items.map((item) => item.label),
    ["Download MP4", "Share", "Delete Clip"],
  );
  dropdown.props.onOpenChange(true);
  tree = render(props);
  dropdown = find(tree, ui.AppDropdown);
  assert.equal(dropdown.props.open, true);
  dropdown.props.items[1].onClick();
  tree = render(props);
  assert.equal(find(tree, ui.AppDropdown).props.open, false);
  assert.equal(find(tree, ShareDialog).props.open, false);
  dropdown.props.onOpenChangeComplete(false);
  tree = render(props);
  const dialog = find(tree, ShareDialog);
  assert.equal(dialog.props.open, true);
  assert.equal(dialog.props.jobId, job._id);
  assert.equal(dialog.props.clipId, job.clips[0]._id);
  assert.equal(dialog.props.clipTitle, "Selected clip");
  assert.equal(
    dialog.props.finalFocus,
    find(tree, ui.AppDropdown).props.trigger.props.ref,
  );
  assert.deepEqual(navigation, []);
  assert.deepEqual(downloads, []);
  dialog.props.onOpenChange(false);
  assert.equal(find(render(props), ShareDialog).props.open, false);
  await dropdown.props.items[0].onClick();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].clipId, job.clips[0]._id);
  dropdown.props.items[2].onClick();
  tree = render(props);
  assert.equal(find(tree, ui.AppDialog).props.open, true);
  await button(tree, "Delete Clip").props.onClick();
  assert.deepEqual(deletions, [{ jobId: job._id, clipId: job.clips[0]._id }]);
});

test("details page uses the same dialog with the resolved clip ID", () => {
  const render = harness("features/jobs/components/ClipDetailView.tsx", {
    "next/link": { default: component },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@tanstack/react-query": { useQueryClient: () => ({ prefetchQuery() {} }) },
    "@/features/jobs": {
      useJob: () => ({ data: job }),
      useDeleteClip: () => ({}),
      useDownloadClip: () => ({}),
      useClipSignedUrl: () => ({}),
    },
    "@/config/axiosClient": { axiosClient: {} },
    "@/features/auth/queries": { useCurrentUser: () => ({}) },
    "@/features/dashboard/components/DashboardLayout": {
      DashboardLayout: component,
    },
    "@/features/dashboard/components/DashboardHeaderRight": {
      DashboardHeaderRight: component,
    },
    "@/components/ui/button": { Button: component },
    "./TranscriptDialog": { TranscriptDialog: component },
    "./ClipDetailsSkeleton": { ClipDetailsSkeleton: component },
    "@/features/dashboard/utils": { getJobDisplayTitle: () => "Job" },
    "./clip-detail": new Proxy(
      { ClipHeader },
      { get: (target, name) => target[name] || component },
    ),
    "@/features/shares": { ShareDialog },
    "@/features/youtube": { PublishToYouTubeDialog: component },
    "./ScheduleDialog": { ScheduleDialog: component },
    "./clip-detail/EditInStudioButton": { EditInStudioButton: component },
    "../clip-details-cache": { cachedClipJob: () => job },
  });
  for (const clipId of [job.clips[0]._id, "0"]) {
    let tree = render({ jobId: job._id, clipId });
    find(tree, ClipHeader).props.onShare();
    tree = render({ jobId: job._id, clipId });
    const dialog = find(tree, ShareDialog);
    assert.equal(dialog.props.open, true);
    assert.equal(dialog.props.clipId, job.clips[0]._id);
    assert.equal(dialog.props.jobId, job._id);
    assert.equal(dialog.props.clipTitle, "Selected clip");
    dialog.props.onOpenChange(false);
  }
});

test("shared dialog loads on demand, preserves expiration and existing links, and creates once", async () => {
  const requests = [];
  const queries = [];
  const copied = [];
  const errors = [];
  const revocations = [];
  let shares = [];
  let loading = false;
  let pending = false;
  let createOptions;
  let revokeOptions;
  const render = harness("features/shares/components/ShareDialog.tsx", {
    sonner: {
      toast: { success() {}, error: (message) => errors.push(message) },
    },
    "../queries": {
      useShares: (clipId, options) => {
        queries.push({ clipId, options });
        return { data: shares, isLoading: loading };
      },
      useCreateShare: (options) => {
        createOptions = options;
        return {
          isPending: pending,
          mutate: (input) => {
            requests.push(input);
          },
        };
      },
      useRevokeShare: (options) => {
        revokeOptions = options;
        return { isPending: false, mutate: (input) => revocations.push(input) };
      },
    },
  });
  global.window = { location: { origin: "https://blynta.example" } };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: {
      clipboard: { writeText: async (url) => copied.push(url) },
    },
  });
  const props = {
    open: false,
    onOpenChange() {},
    jobId: job._id,
    clipId: job.clips[0]._id,
  };
  render(props);
  assert.equal(queries.at(-1).options.enabled, false);
  props.open = true;
  let tree = render(props);
  assert.equal(queries.at(-1).clipId, props.clipId);
  assert.equal(queries.at(-1).options.enabled, true);
  assert.equal(find(tree, ui.AppDialog).props.title, "Share Clip");
  const select = find(tree, ui.AppSelect);
  assert.deepEqual(
    select.props.options.map((option) => option.value),
    ["1d", "7d", "30d"],
  );
  assert.equal(select.props.value, "7d");
  assert.deepEqual(requests, []);
  for (const [option, days] of [
    ["1d", 1],
    ["7d", 7],
    ["30d", 30],
  ]) {
    select.props.onValueChange(option);
    tree = render(props);
    const before = Date.now();
    button(tree, "Create Share Link").props.onClick();
    const input = requests.at(-1);
    assert.equal(input.jobId, props.jobId);
    assert.equal(input.clipId, props.clipId);
    assert.ok(
      Math.abs(Date.parse(input.expiresAt) - before - days * 86400000) < 1000,
    );
  }
  assert.equal(requests.length, 3);
  pending = true;
  assert.equal(
    button(render(props), "Create Share Link").props.isLoading,
    true,
  );
  pending = false;
  loading = true;
  assert.equal(button(render(props), "Create Share Link"), undefined);
  loading = false;
  shares = [
    {
      id: "share-1",
      token: "existing-token",
      isActive: true,
      revokedAt: null,
      accessCount: 2,
    },
  ];
  tree = render(props);
  assert.equal(button(tree, "Create Share Link"), undefined);
  assert.equal(
    find(tree, ui.AppInput).props.value,
    "https://blynta.example/share/existing-token",
  );
  button(tree, "Copy Link").props.onClick();
  assert.deepEqual(copied, ["https://blynta.example/share/existing-token"]);
  createOptions.onSuccess({ token: "new-token" });
  tree = render(props);
  assert.equal(
    find(tree, ui.AppInput).props.value,
    "https://blynta.example/share/new-token",
  );
  assert.equal(requests.length, 3);
  createOptions.onError(new Error("Creation failed"));
  revokeOptions.onError(new Error("Revocation failed"));
  assert.deepEqual(errors, ["Creation failed", "Revocation failed"]);
  button(tree, "Revoke Link").props.onClick();
  assert.deepEqual(revocations, [{ shareId: "share-1", clipId: props.clipId }]);
  shares = [];
  revokeOptions.onSuccess();
  assert.ok(button(render(props), "Create Share Link"));
});
