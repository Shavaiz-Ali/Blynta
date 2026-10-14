/* eslint-disable @typescript-eslint/no-require-imports -- Local CommonJS component harness. */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const root = path.resolve(__dirname, "..");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id in mocks) return mocks[id];
    let target;
    if (id.startsWith("@/")) target = path.join(root, id.slice(2));
    else if (id === "@blynta/ui")
      target = path.resolve(root, "../../packages/ui/src/index");
    else if (id.startsWith("@blynta/ui/"))
      target = path.resolve(
        root,
        "../../packages/ui/src",
        id.slice("@blynta/ui/".length),
      );
    else if (id.startsWith("."))
      target = path.resolve(path.dirname(filename), id);
    if (target) {
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"])
        if (fs.existsSync(target + ext))
          return load(target + ext, mocks, cache);
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

function elements(tree) {
  if (!React.isValidElement(tree)) return [];
  return [
    tree,
    ...React.Children.toArray(tree.props.children).flatMap(elements),
  ];
}

function createFixture() {
  let pathname = "/dashboard";
  const profile = {
    id: "fixture",
    name: "Layout Preview",
    email: "preview@example.test",
    plan: "pro",
    creditsBalance: 50,
    creditsReserved: 2,
  };
  const mocks = {
    "next/navigation": { usePathname: () => pathname },
    "next/link": {
      default: ({ href, ...props }) =>
        React.createElement("a", { href, ...props }),
    },
    "next-themes": { useTheme: () => ({ theme: "dark", setTheme() {} }) },
    "@blynta/auth/react": { useSession: () => ({ data: { user: profile } }) },
    "@blynta/auth/client": { logoutProduct() {} },
    "@/features/auth/queries": {
      useCurrentUser: () => ({ data: profile, isError: false }),
    },
    "@/features/notifications/queries": {
      useUnreadCountQuery: () => ({ data: { count: 3 } }),
    },
    "../queries": { useUnreadCountQuery: () => ({ data: { count: 3 } }) },
    "./NotificationDropdown": {
      NotificationDropdown: () =>
        React.createElement("div", null, "Preview notifications"),
    },
    "@/features/dashboard/components/InviteMembersDialog": {
      InviteMembersDialog: () => null,
    },
  };
  const { AppShell } = load("components/layout/AppShell.tsx", mocks);
  const { PageContent } = load("components/layout/PageContent.tsx", mocks);
  return {
    AppShell,
    PageContent,
    mocks,
    setPath(value) {
      pathname = value;
    },
  };
}

function workspaceMocks() {
  const clipId = "abcdefabcdefabcdefabcdef";
  const jobId = "123456123456123456123456";
  const result = (data) => ({
    data,
    isPending: false,
    isError: false,
    refetch: async () => ({ isSuccess: true }),
    mutate() {},
    mutateAsync: async () => ({}),
  });
  const queries = Object.fromEntries(
    [
      "useEditingAssets",
      "useEditingPlan",
      "useEditingSession",
      "useEditingState",
      "useEditingVersion",
      "useEditingVersions",
      "useInitializePlan",
      "useProposal",
      "useProposalAction",
      "useProposeEdit",
      "useRenderAction",
    ].map((name) => [name, () => result(undefined)]),
  );
  const plan = { _id: "plan", revision: 1, actions: [], outputDuration: 30 };
  Object.assign(queries, {
    useInitializePlan: () => result(plan),
    useEditingPlan: () => result(plan),
    useEditingState: () => result({ proposals: [] }),
    useEditingSession: () => result({ messages: [] }),
    useEditingVersions: () => result({ items: [], totalPages: 1 }),
    useEditingAssets: () => result({ items: [] }),
    studioError: String,
    downloadEditingVersion: async () => ({}),
  });
  return {
    clipId,
    jobId,
    mocks: {
      "@blynta/types/contracts": { APP_ROUTES: {} },
      "./queries": queries,
      "@/features/jobs": {
        JobStatus: { COMPLETED: "completed" },
        useJob: () =>
          result({
            clips: [
              { _id: clipId, status: "completed", startTime: 0, endTime: 30 },
            ],
            highlights: [
              { startTime: 0, endTime: 30, clipTitle: "A clip ready to edit" },
            ],
          }),
        useClipSignedUrl: () => result(undefined),
      },
      "./models": {
        useAvailableEditingModels: () =>
          result({
            plan: "pro",
            selectionAllowed: true,
            defaultModelId: "preview",
            models: [],
          }),
      },
      "./attachments": {
        useStudioAttachments: () => ({
          selectedAssetIds: [],
          items: [],
          error: "",
          validationError: "",
          addFiles() {},
          retry() {},
          recheck() {},
          blocked: false,
          select() {},
          clear() {},
          upload() {},
          remove() {},
        }),
      },
      "./studio-scrollbars.module.css": { default: {} },
      "next-themes": { useTheme: () => ({ theme: "dark", setTheme() {} }) },
    },
  };
}

module.exports = { load, elements, createFixture, workspaceMocks };
