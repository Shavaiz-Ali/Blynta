/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS and a TypeScript loader. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
test("query cache is isolated when the authenticated account changes", () => {
  const {
    QueryClient,
    defaultShouldDehydrateQuery,
  } = require("@tanstack/react-query");
  let owner = "account-one",
    captured;
  const { QueryProvider } = load("providers/QueryProvider.tsx", {
    "@blynta/auth/react": {
      useSession: () => ({
        status: "authenticated",
        data: { user: { id: owner } },
      }),
    },
    "@tanstack/react-query": {
      QueryClient,
      defaultShouldDehydrateQuery,
      isServer: false,
      QueryClientProvider: ({ client, children }) => {
        captured = client;
        return children;
      },
    },
    "@tanstack/react-query-devtools": { ReactQueryDevtools: () => null },
  });
  renderToStaticMarkup(React.createElement(QueryProvider, {}, "Workspace"));
  const previous = captured;
  previous.setQueryData(["ai-editor", "session"], "private conversation");
  owner = "account-two";
  renderToStaticMarkup(React.createElement(QueryProvider, {}, "Workspace"));
  assert.notEqual(captured, previous);
  assert.equal(captured.getQueryData(["ai-editor", "session"]), undefined);
  previous.clear();
  captured.clear();
});
function load(relative, mocks = {}) {
  const filename = path.join(root, relative),
    mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id in mocks) return mocks[id];
    if (id === "@blynta/ui")
      return load("../../packages/ui/src/index.ts", mocks);
    if (id.startsWith("@blynta/ui/"))
      return load(
        "../../packages/ui/src/" + id.slice("@blynta/ui/".length) + ".tsx",
        mocks,
      );
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), id);
      for (const ext of [".ts", ".tsx"])
        if (fs.existsSync(target + ext))
          return load(path.relative(root, target + ext), mocks);
    }
    return original(id);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const ui = {
  Skeleton: () => React.createElement("div", { "data-loading": true }),
};
const selector = load("features/ai-editor/ModelSelector.tsx", {
  "@/components/ui/skeleton": ui,
});
const availability = {
  plan: "pro",
  selectionAllowed: true,
  defaultModelId: "registered-1",
  models: [
    {
      id: "registered-1",
      displayName: "Registered model",
      provider: "google",
      description: "Tested model",
      selectable: true,
    },
    {
      id: "default-only",
      displayName: "Auto only",
      provider: "google",
      selectable: false,
    },
  ],
};
test("premium selector renders only registered selectable choices and Auto", () => {
  const html = renderToStaticMarkup(
    React.createElement(selector.ModelSelector, {
      data: availability,
      loading: false,
      selected: "auto",
      onChange: () => {},
    }),
  );
  assert.match(html, /Auto \(Recommended\)/);
  const chosen = renderToStaticMarkup(
    React.createElement(selector.ModelSelector, {
      data: availability,
      loading: false,
      selected: "registered-1",
      onChange: () => {},
    }),
  );
  assert.match(chosen, /Registered model/);
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /Auto only/);
  assert.doesNotMatch(html, /gpt-4o|claude|credential/);
});
test("free selector cannot override Auto and rejects forged explicit selections", () => {
  const data = { ...availability, plan: "free", selectionAllowed: false };
  const html = renderToStaticMarkup(
    React.createElement(selector.ModelSelector, {
      data,
      loading: false,
      selected: "auto",
      onChange: () => {},
    }),
  );
  assert.doesNotMatch(html, /role="combobox"/);
  const downgraded = renderToStaticMarkup(
    React.createElement(selector.ModelSelector, {
      data,
      loading: false,
      selected: "registered-1",
      onChange: () => {},
    }),
  );
  assert.doesNotMatch(downgraded, /role="combobox"/);
  assert.match(downgraded, /Use Auto for your current plan/);
  assert.match(
    selector.modelSelectionError(data, "registered-1"),
    /current plan uses Auto/,
  );
});
test("stale selections remain visible and fail instead of switching models", () => {
  assert.match(
    selector.modelSelectionError(availability, "disabled-model"),
    /unavailable/,
  );
  assert.match(
    selector.modelSelectionError(
      { ...availability, defaultModelId: null },
      "auto",
    ),
    /No default/,
  );
  assert.equal(
    selector.modelSelectionError(
      { ...availability, defaultModelId: null, compatibilityMode: true },
      "auto",
    ),
    undefined,
  );
});
const presentation = load("features/ai-editor/presentation.ts");
test("render and proposal polling stops on terminal statuses", () => {
  for (const state of ["queued", "processing"])
    assert.equal(presentation.renderPollInterval(state), 2500);
  for (const state of ["completed", "failed", "cancelled", undefined])
    assert.equal(presentation.renderPollInterval(state), false);
  for (const state of ["generating", "applying"])
    assert.equal(presentation.proposalPollInterval(state), 2500);
  for (const state of [
    "pending",
    "clarification",
    "unsupported",
    "failed",
    "applied",
    "rejected",
  ])
    assert.equal(presentation.proposalPollInterval(state), false);
});
const change = {
  action: "add",
  operation: {
    id: "zoom",
    type: "zoom",
    start: 12.4,
    end: 14.4,
    params: { fromScale: 1, toScale: 1.3, easing: "easeInOut" },
  },
};
test("proposal descriptions derive timing and parameters from validated patch data", () => {
  assert.deepEqual(presentation.describeChange(change), {
    title: "Add Zoom",
    detail: "00:12.4 – 00:14.4 · 1× → 1.3× · Smooth",
  });
  assert.match(
    presentation.describeChange({
      action: "update_original_audio",
      controls: {
        gain: 0.7,
        enabled: true,
        fadeIn: 1,
        fadeOut: 2,
        mutes: [],
        automation: [],
      },
    }).detail,
    /Volume 70%/,
  );
});
function transportHarness() {
  const calls = [],
    invalidations = [];
  let mutation;
  const axiosClient = {
    post: async (...args) => {
      calls.push(args);
      return {
        data: { _id: "proposal-1", sessionId: "session-1", status: "pending" },
      };
    },
    get: async (...args) => {
      calls.push(args);
      return { data: availability };
    },
  };
  const client = {
    setQueryData: () => {},
    invalidateQueries: (arg) => {
      invalidations.push(arg.queryKey);
      return Promise.resolve();
    },
  };
  const mocks = {
    "@tanstack/react-query": {
      useQuery: (o) => o,
      useMutation: (o) => (mutation = o),
      useQueryClient: () => client,
    },
    "@/config/axiosClient": { axiosClient, ApiError: class extends Error {} },
  };
  return { calls, invalidations, mocks, getMutation: () => mutation };
}
test("task-specific availability query uses the existing API and cancellation signal", async () => {
  const h = transportHarness();
  const hook = load(
    "features/ai-editor/models.ts",
    h.mocks,
  ).useAvailableEditingModels;
  const options = hook("highlight_detection");
  const signal = new AbortController().signal;
  await options.queryFn({ signal });
  assert.deepEqual(options.queryKey, [
    "ai-editor",
    "available-models",
    "highlight_detection",
  ]);
  assert.equal(h.calls[0][1].params.task, "highlight_detection");
  assert.equal(h.calls[0][1].signal, signal);
});
test("retry executes the same proposal body and UUID with no automatic expensive retries", async () => {
  const h = transportHarness(),
    hooks = load("features/ai-editor/queries.ts", h.mocks);
  const options = hooks.useProposeEdit("clip", "plan");
  const body = {
    planId: "plan",
    prompt: "Add a zoom",
    requestId: "fixed-request-id",
    sessionId: "session",
    modelId: "registered-id",
  };
  await options.mutationFn(body);
  await options.mutationFn(body);
  assert.equal(options.retry, false);
  assert.equal(h.calls[0][1], body);
  assert.equal(h.calls[1][1], body);
  assert.equal(h.calls[0][2].timeout, 100000);
});
test("approval invalidates plan, history and proposals without triggering render", async () => {
  const h = transportHarness(),
    hooks = load("features/ai-editor/queries.ts", h.mocks);
  const options = hooks.useProposalAction("clip", "plan", "apply");
  await options.mutationFn("proposal");
  options.onSettled();
  assert.equal(h.calls[0][0], "/clips/clip/ai-edit/proposals/proposal/apply");
  assert.equal(h.calls.length, 1);
  assert.ok(h.invalidations.some((k) => k.join("/") === "ai-editor/plan/plan"));
  assert.ok(h.invalidations.some((k) => k.includes("session")));
});
test("explicit rendering, cancellation and retry invoke the existing version API", async () => {
  const h = transportHarness(),
    hooks = load("features/ai-editor/queries.ts", h.mocks);
  await hooks.useRenderAction("plan", "preview").mutationFn("plan");
  await hooks.useRenderAction("plan", "cancel").mutationFn("version");
  await hooks.useRenderAction("plan", "retry").mutationFn("version");
  assert.deepEqual(
    h.calls.map((c) => c[0]),
    [
      "/ai-editor/plans/plan/preview",
      "/ai-editor/versions/version/cancel",
      "/ai-editor/versions/version/retry",
    ],
  );
});
test("hero job payload forwards registered ID with credit authorization unchanged", async () => {
  const h = transportHarness(),
    hooks = load("features/jobs/queries.ts", {
      ...h.mocks,
      "@/features/billing/queries": { invalidateCurrentUser: () => {} },
    });
  const input = {
    sourceUrl: "https://youtube.com/watch?v=source",
    sourcePlatform: "youtube",
    modelId: "registered-id",
    operationId: "same-credit-operation",
    sourceSeconds: 60,
    maxOutputSeconds: 30,
    authorizedCredits: 10,
    pricingVersion: "current",
  };
  const options = hooks.useCreateJob();
  await options.mutationFn(input);
  assert.equal(h.calls[0][1].modelId, "registered-id");
  assert.equal(h.calls[0][1].authorizedCredits, 10);
  assert.equal(h.calls[0][1].operationId, input.operationId);
  assert.equal(h.calls[0][1].aiModel, undefined);
});
test("proposal card escapes untrusted summaries and disables stale approval", () => {
  const Button = ({ children, ...props }) =>
    React.createElement("button", props, children);
  const { ProposalCard } = load("features/ai-editor/ProposalCard.tsx", {
    "@/components/ui/button": { Button },
  });
  const html = renderToStaticMarkup(
    React.createElement(ProposalCard, {
      proposal: {
        status: "pending",
        baseRevision: 1,
        summary: "<script>unsafe</script>",
        patch: { changes: [change] },
      },
      plan: { revision: 2 },
      busy: false,
      onApply: () => {},
      onReject: () => {},
    }),
  );
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /older revision/);
  assert.match(html, /<button\b[^>]*disabled=""/);
  assert.match(html, /1.3×/);
});
test("actual admin provider page renders safe metadata through its existing query boundary", () => {
  const wrapper = ({ children }) => React.createElement("div", {}, children);
  const mocks = {
    "@tanstack/react-query": {
      useQuery: ({ queryKey }) => ({
        data: {
          items:
            queryKey.includes("providers") ||
            queryKey.includes("provider-catalog")
              ? [
                  {
                    _id: "provider-id",
                    name: "Configured provider",
                    code: "google",
                    adapter: "google",
                    enabled: true,
                    configured: true,
                    modelCount: 2,
                  },
                ]
              : [],
          page: 1,
          pageSize: 25,
          summary: [],
        },
        isPending: false,
        error: null,
      }),
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    },
    "@/config/axiosClient": { axiosClient: {} },
    "@/components/ui/button": {
      Button: ({ children }) => React.createElement("button", {}, children),
    },
    "@/components/ui/input": { Input: () => React.createElement("input") },
    "@/components/ui/label": { Label: wrapper },
    "@/components/ui/badge": { Badge: wrapper },
    "@/components/ui/skeleton": { Skeleton: wrapper },
    "@/components/ui/card": Object.fromEntries(
      ["Card", "CardContent", "CardHeader", "CardTitle"].map((name) => [
        name,
        wrapper,
      ]),
    ),
    "@/components/ui/dialog": {
      Dialog: ({ open, children }) => (open ? children : null),
      DialogContent: wrapper,
      DialogHeader: wrapper,
      DialogTitle: wrapper,
    },
    "@/components/ui/table": Object.fromEntries(
      [
        "Table",
        "TableBody",
        "TableCell",
        "TableHead",
        "TableHeader",
        "TableRow",
      ].map((name) => [name, wrapper]),
    ),
    "@/components/ui/tabs": Object.fromEntries(
      ["Tabs", "TabsContent", "TabsList", "TabsTrigger"].map((name) => [
        name,
        wrapper,
      ]),
    ),
  };
  const { AIManagement } = load(
    "../admin/features/admin-ai/AIManagement.tsx",
    mocks,
  );
  const html = renderToStaticMarkup(React.createElement(AIManagement));
  assert.match(html, /Configured provider/);
  assert.match(html, /Manage providers/);
  assert.doesNotMatch(html, /ciphertext|API_KEY|synthetic-registry-key/);
});
test("actual admin layout rejects signed-in non-admin accounts", async () => {
  const wrapper = ({ children }) => children;
  const { default: layout } = load("../admin/app/(main)/layout.tsx", {
    "@/auth": { auth: async () => ({ user: { role: "user" } }) },
    "next/navigation": {
      redirect: () => {
        throw new Error("ADMIN_ACCESS_DENIED");
      },
    },
    "@/lib/permissions": load("../admin/lib/permissions.ts"),
    "@/components/common/AdminSidebar": { AdminSidebar: wrapper },
    "@/components/common/AdminTopbar": { AdminTopbar: wrapper },
    "@/components/ui/sidebar": {
      SidebarInset: wrapper,
      SidebarProvider: wrapper,
    },
  });
  await assert.rejects(
    () => layout({ children: "Protected AI management" }),
    /ADMIN_ACCESS_DENIED/,
  );
});

// Shared composition regressions render the real package, not substitute controls.
test("compound cards keep headers and body as separate block boundaries", () => {
  const { AppCardRoot, AppCardHeader, AppCardContent } = load(
    "../../packages/ui/src/index.ts",
  );
  const html = renderToStaticMarkup(
    React.createElement(
      AppCardRoot,
      {},
      React.createElement(AppCardHeader, {}, "Metric"),
      React.createElement(AppCardContent, {}, "3200"),
    ),
  );
  assert.equal((html.match(/data-slot="card-content"/g) || []).length, 1);
  assert.match(html, /min-w-0/);
});
test("horizontal tabs stack their list above the content", () => {
  const { Tabs, TabsList, TabsTrigger, TabsContent } = load(
    "../../packages/ui/src/primitives/tabs.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(
      Tabs,
      { defaultValue: "history" },
      React.createElement(
        TabsList,
        {},
        React.createElement(TabsTrigger, { value: "history" }, "History"),
      ),
      React.createElement(TabsContent, { value: "history" }, "Versions"),
    ),
  );
  assert.match(html, /data-orientation="horizontal"/);
  assert.match(html, /flex-col/);
});
test("custom select children expose the selected label and preserve form names", () => {
  const { AppSelect } = load("../../packages/ui/src/index.ts");
  const { SelectItem: AppSelectItem } = load(
    "../../packages/ui/src/primitives/select.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(
      AppSelect,
      {
        name: "providerId",
        value: "provider-id",
        onValueChange: () => {},
        "aria-label": "Provider",
      },
      React.createElement(AppSelectItem, { value: "provider-id" }, "Google AI"),
    ),
  );
  assert.match(html, /Google AI/);
  assert.match(html, /name="providerId"/);
  assert.match(html, /aria-label="Provider"/);
});
test("pagination prevents moving beyond the first and final page", () => {
  const { AppPagination } = load("../../packages/ui/src/index.ts");
  const html = renderToStaticMarkup(
    React.createElement(AppPagination, {
      page: 1,
      totalPages: 1,
      onPageChange: () => {},
    }),
  );
  assert.equal((html.match(/<button\b[^>]* disabled=""/g) || []).length, 2);
  assert.match(html, /Pagination/);
});
