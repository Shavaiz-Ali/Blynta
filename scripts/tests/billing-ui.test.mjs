import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(
  new URL("../../apps/app/package.json", import.meta.url),
);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(relative, mocks = {}) {
  const filename = fileURLToPath(new URL(`../../${relative}`, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    (id) => {
      if (id === "@blynta/ui" && mocks[id]) {
        const wrapper = ({ children }) =>
          React.createElement("div", null, children);
        const defaults = {
          AppCardRoot: wrapper,
          AppCardHeader: wrapper,
          AppCardTitle: wrapper,
          AppCardDescription: wrapper,
          AppCardContent: wrapper,
          AppCardFooter: wrapper,
          AppBadge: wrapper,
          AppSkeleton: wrapper,
          Table: ({ children }) => React.createElement("table", null, children),
          TableBody: "tbody",
          TableCell: "td",
          TableHead: "th",
          TableHeader: "thead",
          TableRow: "tr",
          TableCaption: "caption",
          AppSelect: ({ "aria-label": label, value, options }) =>
            React.createElement(
              "span",
              { "aria-label": label },
              options.find((o) => o.value === value)?.label,
            ),
          AppPagination: ({ page, totalPages }) =>
            React.createElement("nav", null, `Page ${page} of ${totalPages}`),
        };
        return new Proxy(
          {},
          { get: (_, key) => mocks[id][key] ?? defaults[key] },
        );
      }
      if (id === "@/features/ai-editor/models")
        return {
          useAvailableEditingModels: () => ({
            data: {
              plan: "pro",
              selectionAllowed: true,
              defaultModelId: "fixture-default",
              models: [
                {
                  id: "fixture-default",
                  displayName: "Fixture model",
                  selectable: true,
                },
              ],
            },
            isPending: false,
            isError: false,
          }),
        };
      if (id === "@/features/ai-editor/ModelSelector")
        return load("apps/app/features/ai-editor/ModelSelector.tsx", mocks);
      if (id.startsWith(".") && !mocks[id]) {
        for (const ext of [".ts", ".tsx"]) {
          const candidate = path.resolve(path.dirname(filename), id + ext);
          if (existsSync(candidate))
            return load(
              path
                .relative(
                  fileURLToPath(new URL("../../", import.meta.url)),
                  candidate,
                )
                .replaceAll("\\", "/"),
              mocks,
            );
        }
      }
      return mocks[id] || require(id);
    },
    fixtureModule,
    fixtureModule.exports,
  );
  return fixtureModule.exports;
}
function history(query) {
  const { CreditHistory } = load(
    "apps/app/features/billing/components/CreditHistory.tsx",
    {
      "../queries": { useCreditHistory: () => ({ refetch() {}, ...query }) },
      "@blynta/ui": {
        AppButton: ({ children, contentClassName, ...props }) => {
          void contentClassName;
          return React.createElement("button", props, children);
        },
        AppDropdown: ({ trigger }) => trigger,
      },
    },
  );
  return renderToStaticMarkup(React.createElement(CreditHistory));
}

test("Paddle environment rejects missing, secret and mismatched tokens", () => {
  const { checkoutEnvironment } = load(
    "apps/app/features/billing/paddle-client.ts",
  );
  assert.equal(checkoutEnvironment("test_fixture", "sandbox"), "sandbox");
  assert.equal(checkoutEnvironment("live_fixture", "production"), "production");
  assert.throws(() => checkoutEnvironment(undefined, "sandbox"), /missing/);
  assert.throws(
    () => checkoutEnvironment("pdl_apikey_private", "sandbox"),
    /client-side token/,
  );
  assert.throws(
    () => checkoutEnvironment("test_fixture", "production"),
    /mismatch/,
  );
  assert.throws(
    () => checkoutEnvironment("test_fixture", "sandbox", "production"),
    /mismatch/,
  );
});

test("Paddle initialization is shared, retryable after failure, and has a bounded timeout", async () => {
  const { createPaddleLoader } = load(
    "apps/app/features/billing/paddle-client.ts",
  );
  let calls = 0;
  const paddle = { Checkout: { open() {} } };
  const loader = createPaddleLoader(async () => {
    calls++;
    if (calls === 1) throw new Error("Script blocked");
    return paddle;
  });
  await assert.rejects(
    loader("test_fixture", "sandbox", () => {}),
    /Could not load/,
  );
  const results = await Promise.all([
    loader("test_fixture", "sandbox", () => {}),
    loader("test_fixture", "sandbox", () => {}),
  ]);
  assert.equal(calls, 2);
  assert.equal(results[0], paddle);
  await assert.rejects(
    loader("live_other", "production", () => {}),
    /configuration changed/,
  );
  const hung = createPaddleLoader(() => new Promise(() => {}), 5);
  await assert.rejects(
    hung("test_fixture", "sandbox", () => {}),
    /Could not load/,
  );
});

test("subscriptions and credit packs initialize first and explicitly open the server transaction without redirecting", async () => {
  const calls = [];
  let rejectOpen = false;
  const payload = {
    transactionId: "txn_01234567890123456789012345",
    environment: "sandbox",
  };
  const queries = load("apps/app/features/billing/queries.ts", {
    "@tanstack/react-query": { useMutation: (options) => options },
    "@/config/axiosClient": {
      axiosClient: {
        post: async (url) => {
          calls.push(url);
          return { data: payload };
        },
      },
    },
    "@/features/auth/queries": { userQueryKeys: { me: () => ["user"] } },
    "./cache": { invalidateCurrentUser() {} },
    "./paddle-context": {
      usePaddle: () => ({
        prepare: async () => calls.push("prepare"),
        openCheckout: async (data) => {
          calls.push(data);
          if (rejectOpen) throw new Error("Overlay blocked");
        },
      }),
    },
  });
  await queries.useCreateCheckoutSession().mutationFn({ plan: "pro" });
  await queries.useCreditPackCheckout().mutationFn("25");
  assert.deepEqual(calls, [
    "prepare",
    "/billing/checkout-session",
    payload,
    "prepare",
    "/billing/credit-packs/checkout",
    payload,
  ]);
  rejectOpen = true;
  await assert.rejects(
    queries.useCreateCheckoutSession().mutationFn({ plan: "business" }),
    /Overlay blocked/,
  );
});

test("Free billing overview retains the server balance and hides even an erroneous Free renewal date", () => {
  const { BillingPage } = load(
    "apps/app/features/billing/components/BillingPage.tsx",
    {
      "@blynta/ui": {
        AppButton: ({ children }) =>
          React.createElement("button", null, children),
      },
      "@/components/layout/PageContent": {
        PageContent: ({ children }) =>
          React.createElement("main", null, children),
      },
      "@/features/auth/queries": {
        useCurrentUser: () => ({ data: { plan: "free" } }),
      },
      "../queries": {
        useCreditBalance: () => ({
          data: {
            plan: "free",
            available: 2,
            reserved: 0,
            monthlyCredits: 0,
            nextRenewal: "2026-11-01",
            planAllocations: { free: 30, pro: 50, business: 200 },
          },
        }),
        useCreateCheckoutSession: () => ({ isPending: false }),
        useCustomerPortal: () => ({ isPending: false }),
      },
      "../paddle-context": { usePaddle: () => ({ status: "ready" }) },
      "./CreditHistory": { CreditHistory: () => null },
      "./CreditPacks": { CreditPacks: () => null },
      "./HowCreditsWork": { HowCreditsWork: () => null },
    },
  );
  const html = renderToStaticMarkup(React.createElement(BillingPage));
  assert.match(html, /30 one-time credits/);
  assert.match(html, /no renewal/);
  assert.match(html, />2<\/dd>/);
  assert.doesNotMatch(html, /Next credit allocation|2026-11-01|5 credits/);
  assert.match(html, /\$12/);
  assert.match(html, /\$39/);
});

test("credit packs explain missing configuration and configured buttons initiate checkout", () => {
  const previousToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_fixture";
  try {
    const calls = [];
    const AppButton = ({ children, isLoading, ...props }) => {
      void isLoading;
      return React.createElement("button", props, children);
    };
    const { CreditPacks } = load(
      "apps/app/features/billing/components/CreditPacks.tsx",
      {
        "@blynta/ui": { AppButton },
        "../paddle-context": { usePaddle: () => ({ status: "ready" }) },
        "../queries": {
          useCreditPacks: () => ({
            data: [
              {
                id: "25",
                credits: 25,
                enabled: true,
                configurationError: null,
                price: { amount: "500", currencyCode: "USD" },
              },
              {
                id: "50",
                credits: 50,
                enabled: false,
                configurationError: "Missing PADDLE_PRICE_ID_CREDITS_50",
              },
            ],
          }),
          useCreditPackCheckout: () => ({
            isPending: false,
            mutate: (id) => calls.push(id),
          }),
        },
      },
    );
    const tree = CreditPacks();
    const buttons = elements(tree, (e) => e.type === AppButton);
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].props.disabled, false);
    assert.equal(buttons[1].props.disabled, true);
    buttons[0].props.onClick();
    assert.deepEqual(calls, ["25"]);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /This credit pack is temporarily unavailable/);
    assert.doesNotMatch(html, /PADDLE_PRICE_ID/);
    assert.match(html, /5\.00/);
    assert.match(html, /id="buy-credits"/);
  } finally {
    if (previousToken === undefined)
      delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    else process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = previousToken;
  }
});
test("insufficient credits communicates required, available, and supported upgrade route", () => {
  const { InsufficientCredits } = load(
    "packages/ui/src/components/InsufficientCredits.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(InsufficientCredits, {
      required: 18,
      available: 5,
      billingUrl: "/billing",
    }),
  );
  assert.match(html, /18 credits/);
  assert.match(html, /5 available/);
  assert.match(html, /13 additional credits/);
  assert.match(html, /href="\/billing#buy-credits"/);
  assert.match(html, /href="\/billing"/);
  assert.match(html, /role="alert"/);
});
test("history distinguishes charges, holds and released holds", () => {
  const rows = ["reserve", "charge", "release", "grant"].map((type, index) => ({
    _id: String(index),
    type,
    product: "ai-clips",
    amount: 5,
    availableDelta: 5,
    description: "Video work",
    createdAt: "2026-10-08T00:00:00Z",
  }));
  const html = history({ data: { rows, page: 1, totalPages: 2 } });
  assert.match(html, /5 held/);
  assert.match(html, /−5/);
  assert.match(html, /5 unlocked/);
  assert.match(html, /\+5/);
  assert.match(html, /not new credit grants/);
  assert.match(html, /Filter by product/);
  assert.match(html, /Page 1 of 2/);
});
test("history loading, failure, and empty states are accessible", () => {
  assert.match(history({ isPending: true }), /role="status"/);
  assert.match(
    history({ error: new Error("Unavailable") }),
    /Could not load credit history/,
  );
  assert.match(
    history({ data: { rows: [], totalPages: 0 } }),
    /No transactions match/,
  );
});

test("submission clearly reports inactive usage billing without advertising a flat rate", () => {
  const component = ({ children, disabled }) =>
    React.createElement("div", { "data-disabled": disabled }, children);
  const icons = new Proxy({}, { get: () => () => null });
  const { HeroInput } = load(
    "apps/app/features/dashboard/components/HeroInput.tsx",
    {
      "@/features/jobs": {
        SourcePlatform: { YOUTUBE: "youtube" },
        useStylePresets: () => ({ data: [] }),
        useCreateJob: () => ({ mutate() {}, reset() {}, isPending: false }),
      },
      "@/features/auth/queries": {
        useCurrentUser: () => ({ data: { plan: "free" } }),
      },
      "@/features/billing/queries": {
        useCreditBalance: () => ({ data: { enabled: false, available: 20 } }),
      },
      "@/config/axiosClient": { axiosClient: {} },
      "@/lib/utils": { cn: (...args) => args.join(" ") },
      "../icons": icons,
      "./GenerationConfirmation": { GenerationConfirmation: () => null },
      "@blynta/ui": new Proxy({}, { get: () => component }),
      "@/features/billing/components/HowCreditsWork": {
        HowCreditsWork: () => null,
      },
      "next/link": { default: component },
      "next/navigation": { useRouter: () => ({ push() {} }) },
      sonner: { toast: {} },
    },
  );
  const html = renderToStaticMarkup(React.createElement(HeroInput));
  assert.doesNotMatch(html, /1 credit per job|1 credit per video/);
  assert.match(html, /New processing is temporarily unavailable/);
});

function hookHarness() {
  let cursor = 0;
  const state = [];
  return {
    react: {
      ...React,
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = { current: initial };
        return state[i];
      },
    },
    render(Component, props = {}) {
      cursor = 0;
      return Component(props);
    },
  };
}
test("checkout resume does not reopen an explicit overlay and completion waits for the verified ledger", async () => {
  const hooks = hookHarness();
  const effects = [],
    cleanups = [],
    successes = [];
  let callback,
    opens = 0,
    verified = false,
    paid = false;
  const id = "txn_01234567890123456789012345";
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { href: "http://localhost/billing" },
    history: {
      replaceState(_a, _b, url) {
        globalThis.window.location.href = String(url);
      },
    },
  };
  const flush = async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };
  try {
    const { PaddleProvider } = load(
      "apps/app/features/billing/components/PaddleProvider.tsx",
      {
        react: {
          ...hooks.react,
          useCallback: (fn) => fn,
          useEffect: (fn) => effects.push(fn),
        },
        "next/navigation": {
          useSearchParams: () => ({
            get: (name) => new URL(window.location.href).searchParams.get(name),
          }),
        },
        "next-themes": { useTheme: () => ({ resolvedTheme: "light" }) },
        "@tanstack/react-query": { useQueryClient: () => ({}) },
        "@/config/axiosClient": {
          axiosClient: {
            get: async (url) => ({
              data: url.endsWith("checkout-config")
                ? { environment: "sandbox" }
                : {
                    environment: "sandbox",
                    status: paid ? "completed" : "draft",
                    verified,
                  },
            }),
          },
        },
        "../cache": { invalidateCurrentUser() {} },
        "../paddle-client": {
          checkoutEnvironment: () => "sandbox",
          createPaddleLoader: () => async (_token, _env, listener) => {
            callback = listener;
            return {
              Checkout: {
                open() {
                  opens++;
                  callback({ name: "checkout.loaded" });
                },
              },
            };
          },
        },
        sonner: {
          toast: { success: (message) => successes.push(message), error() {} },
        },
      },
    );
    let context = hooks.render(PaddleProvider).props.value;
    effects.slice().forEach((fn) => {
      const cleanup = fn();
      if (cleanup) cleanups.push(cleanup);
    });
    await flush();
    await context.openCheckout({ transactionId: id, environment: "sandbox" });
    effects[1](); // Simulate Next's search-param update after replaceState.
    await flush();
    assert.equal(opens, 1);
    paid = true;
    callback({ name: "checkout.completed", data: { transaction_id: id } });
    await flush();
    callback({ name: "checkout.closed" });
    context = hooks.render(PaddleProvider).props.value;
    assert.equal(context.status, "confirming");
    assert.match(window.location.href, /_ptxn=/);
    assert.equal(successes.length, 0);
    verified = true;
    await context.retry();
    await flush();
    context = hooks.render(PaddleProvider).props.value;
    assert.equal(context.status, "verified");
    assert.equal(successes.length, 1);
    assert.doesNotMatch(window.location.href, /_ptxn=/);
    assert.equal(opens, 1);
  } finally {
    cleanups.forEach((fn) => fn());
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

function elements(root, predicate) {
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root))
    return root.flatMap((child) => elements(child, predicate));
  return [
    ...(predicate(root) ? [root] : []),
    ...elements(root.props?.children, predicate),
  ];
}
test("history dropdown selections reset pagination and preserve both query filters", () => {
  const hooks = hookHarness();
  let latest;
  const ui = {
    AppButton: function Button() {},
    AppSelect: function Select() {},
    AppPagination: function Pagination() {},
  };
  const { CreditHistory } = load(
    "apps/app/features/billing/components/CreditHistory.tsx",
    {
      react: hooks.react,
      "@blynta/ui": ui,
      "../queries": {
        useCreditHistory: (page, product, type) => {
          latest = { page, product, type };
          return { data: { rows: [], totalPages: 3, total: 40 } };
        },
      },
    },
  );
  let tree = hooks.render(CreditHistory);
  elements(tree, (e) => e.type === ui.AppPagination)[0].props.onPageChange(2);
  tree = hooks.render(CreditHistory);
  assert.equal(latest.page, 2);
  elements(tree, (e) => e.type === ui.AppSelect)[0].props.onValueChange(
    "studio",
  );
  tree = hooks.render(CreditHistory);
  assert.deepEqual(latest, { page: 1, product: "studio", type: "" });
  elements(tree, (e) => e.type === ui.AppSelect)[1].props.onValueChange(
    "refund",
  );
  tree = hooks.render(CreditHistory);
  assert.deepEqual(latest, { page: 1, product: "studio", type: "refund" });
  assert.equal(
    elements(tree, (e) => e.type === ui.AppSelect)[1].props.value,
    "refund",
  );
});
test("automatic budget is reviewed before approval and an insufficient balance blocks submission", async () => {
  const hooks = hookHarness();
  const calls = [];
  const submissions = [];
  let mutationOptions;
  let estimateError = false;
  const component = () => null;
  const ui = {
    AppDialog: component,
    AppButton: function Button() {},
    AppCard: component,
    AppCardRoot: component,
    AppInput: function Input() {},
    AppTextarea: component,
    AppSelect: component,
    InsufficientCredits: component,
  };
  const balance = { enabled: true, available: 20 };
  const estimate = {
    totalCredits: 15,
    available: 20,
    sourceSeconds: 1800,
    maxOutputSeconds: 540,
    sourceCredits: 6,
    renderCredits: 9,
    pricingVersion: "live-pricing",
    clipTargetMin: 6,
    clipTargetMax: 9,
  };
  const { GenerationConfirmation } = load(
    "apps/app/features/dashboard/components/GenerationConfirmation.tsx",
    { "@blynta/ui": ui },
  );
  const dialog = (tree) =>
    GenerationConfirmation(
      elements(tree, (e) => e.type === GenerationConfirmation)[0].props,
    );
  const approve = (tree) =>
    elements(
      tree,
      (e) => e.type === GenerationConfirmation,
    )[0].props.onApprove();
  const primary = (dialog) =>
    elements(
      dialog.props.footer,
      (e) => e.type === ui.AppButton && e.props.variant !== "outline",
    )[0];
  const { HeroInput } = load(
    "apps/app/features/dashboard/components/HeroInput.tsx",
    {
      react: hooks.react,
      "@/features/jobs": {
        SourcePlatform: { YOUTUBE: "youtube" },
        useStylePresets: () => ({ data: [] }),
        useCreateJob: (opts) => {
          mutationOptions = opts;
          return {
            mutate: (body) => submissions.push(body),
            reset() {},
            isPending: false,
          };
        },
      },
      "@/features/auth/queries": {
        useCurrentUser: () => ({ data: { plan: "pro" } }),
      },
      "@/features/billing/queries": {
        useCreditBalance: () => ({ data: balance, refetch() {} }),
      },
      "@/config/axiosClient": {
        axiosClient: {
          post: async (...args) => {
            calls.push(args);
            if (estimateError) throw new Error("network");
            return { data: { ...estimate } };
          },
        },
      },
      "@/lib/utils": { cn: (...args) => args.join(" ") },
      "../icons": new Proxy({}, { get: () => component }),
      "@blynta/ui": ui,
      "./GenerationConfirmation": { GenerationConfirmation },
      "@/features/billing/components/HowCreditsWork": {
        HowCreditsWork: function Help() {},
      },
      "next/link": { default: component },
      "next/navigation": { useRouter: () => ({ push() {} }) },
      sonner: { toast: { error() {}, success() {} } },
    },
  );
  let tree = hooks.render(HeroInput);
  assert.equal(
    elements(tree, (e) => e.type === "input" && e.props.type === "number")
      .length,
    0,
  );
  elements(
    tree,
    (e) => e.type === ui.AppInput && e.props.id === "video-url-input",
  )[0].props.onChange({
    target: { value: "https://youtube.com/watch?v=example" },
  });
  tree = hooks.render(HeroInput);
  const initialRequest = elements(
    tree,
    (e) => e.type === "form",
  )[0].props.onSubmit();
  const duplicateRequest = elements(
    tree,
    (e) => e.type === "form",
  )[0].props.onSubmit();
  const estimatingTree = hooks.render(HeroInput);
  assert.equal(
    elements(
      estimatingTree,
      (e) => e.type === ui.AppButton && e.props.isLoading,
    ).length,
    1,
  );
  await Promise.all([initialRequest, duplicateRequest]);
  tree = hooks.render(HeroInput);
  assert.deepEqual(calls[0], [
    "/jobs/estimate",
    { sourceUrl: "https://youtube.com/watch?v=example" },
  ]);
  assert.equal(submissions.length, 0);
  assert.equal(calls.length, 1);
  let confirmation = dialog(tree);
  assert.equal(confirmation.props.open, true);
  const confirmationHtml = renderToStaticMarkup(confirmation.props.children);
  assert.match(confirmationHtml, /Maximum credits reserved/);
  assert.match(confirmationHtml, /maximum reservation of/);
  assert.match(confirmationHtml, /final charge may be lower/);
  assert.equal(primary(confirmation).props.disabled, false);
  const firstApproval = approve(tree);
  const duplicateApproval = approve(tree);
  const loadingDialog = dialog(hooks.render(HeroInput));
  assert.equal(loadingDialog.props.dismissible, false);
  assert.equal(loadingDialog.props.showCloseButton, false);
  assert.equal(primary(loadingDialog).props.disabled, true);
  assert.equal(primary(loadingDialog).props.children, "Checking estimate…");
  await Promise.all([firstApproval, duplicateApproval]);
  assert.equal(submissions[0].authorizedCredits, 15);
  assert.equal(submissions[0].maxOutputSeconds, 540);
  assert.equal(submissions[0].pricingVersion, "live-pricing");
  assert.equal(submissions.length, 1);
  mutationOptions.onError(new Error("failed"));
  balance.available = 5;
  tree = hooks.render(HeroInput);
  confirmation = dialog(tree);
  assert.equal(primary(confirmation).props.disabled, true);
  const upgrade = elements(
    confirmation,
    (e) => e.type === ui.InsufficientCredits && e.props.billingUrl,
  )[0];
  assert.equal(upgrade.props.billingUrl, "/billing");
  assert.equal(upgrade.props.billingLabel, "View plans & upgrade");
  const Help = elements(tree, (e) => e.type?.name === "Help")[0].type;
  assert.equal(elements(tree, (e) => e.type === Help)[0].props.open, false);
  elements(
    tree,
    (e) =>
      e.type === ui.AppButton &&
      e.props.children?.includes?.("How credits work"),
  )[0].props.onClick();
  tree = hooks.render(HeroInput);
  assert.equal(elements(tree, (e) => e.type === Help)[0].props.open, true);
  elements(tree, (e) => e.type === Help)[0].props.onOpenChange(false);
  tree = hooks.render(HeroInput);
  assert.equal(elements(tree, (e) => e.type === Help)[0].props.open, false);
  // Recovery uses server-held measured evidence, then requires the same explicit confirmation.
  const recovery = {
    initialSourceUrl: "https://youtube.com/watch?v=example",
    reviewJobId: "6ac8c8e15feea2543bffc322",
  };
  tree = hooks.render(HeroInput, recovery);
  await elements(tree, (e) => e.type === "form")[0].props.onSubmit();
  assert.deepEqual(calls.at(-1), [
    "/jobs/estimate",
    { sourceUrl: recovery.initialSourceUrl, reviewJobId: recovery.reviewJobId },
  ]);
  assert.equal(submissions.length, 1);
  balance.available = 20;
  tree = hooks.render(HeroInput);
  estimate.totalCredits = 16;
  estimate.sourceCredits = 7;
  await approve(tree);
  tree = hooks.render(HeroInput);
  assert.match(
    elements(tree, (e) => e.type === GenerationConfirmation)[0].props.error,
    /estimate changed/,
  );
  assert.equal(submissions.length, 1);
  assert.equal(
    elements(tree, (e) => e.type === GenerationConfirmation)[0].props.estimate
      .totalCredits,
    16,
  );
  estimateError = true;
  await approve(tree);
  tree = hooks.render(HeroInput);
  assert.match(
    elements(tree, (e) => e.type === GenerationConfirmation)[0].props.error,
    /Couldn’t refresh/,
  );
  assert.equal(submissions.length, 1);
  estimateError = false;
  await approve(tree);
  assert.equal(submissions.length, 2);
  assert.equal(submissions[1].authorizedCredits, 16);
  assert.notEqual(submissions[1].operationId, submissions[0].operationId);
  mutationOptions.onError(new Error("failed"));
  tree = hooks.render(HeroInput);
  elements(tree, (e) => e.type === GenerationConfirmation)[0].props.onCancel();
  tree = hooks.render(HeroInput);
  assert.equal(dialog(tree).props.open, false);
  estimateError = true;
  await elements(tree, (e) => e.type === "form")[0].props.onSubmit();
  tree = hooks.render(HeroInput);
  assert.match(
    renderToStaticMarkup(elements(tree, (e) => e.type === "form")[0]),
    /Check your video link and try again/,
  );
  assert.equal(submissions.length, 2);
  estimateError = false;
  await elements(tree, (e) => e.type === "form")[0].props.onSubmit();
  tree = hooks.render(HeroInput);
  estimate.available = 5;
  await approve(tree);
  tree = hooks.render(HeroInput);
  assert.equal(
    elements(tree, (e) => e.type === GenerationConfirmation)[0].props.available,
    5,
  );
  assert.equal(primary(dialog(tree)).props.disabled, true);
  assert.equal(submissions.length, 2);
  balance.available = 30;
  estimate.available = 30;
  tree = hooks.render(HeroInput);
  assert.equal(
    elements(tree, (e) => e.type === GenerationConfirmation)[0].props.available,
    30,
  );
});

test("confirmation displays server-provided duration, authorization and plan target with explicit CTA consent", () => {
  const button = ({ children, isLoading, ...props }) => {
    void isLoading;
    return React.createElement("button", props, children);
  };
  const { GenerationConfirmation } = load(
    "apps/app/features/dashboard/components/GenerationConfirmation.tsx",
    {
      "@blynta/ui": {
        AppDialog: ({ title, children, footer }) =>
          React.createElement(
            "section",
            null,
            React.createElement("h2", null, title),
            children,
            footer,
          ),
        AppButton: button,
        InsufficientCredits: () => null,
      },
    },
  );
  const html = renderToStaticMarkup(
    React.createElement(GenerationConfirmation, {
      estimate: {
        totalCredits: 20,
        sourceCredits: 11,
        renderCredits: 9,
        sourceSeconds: 3233,
        maxOutputSeconds: 540,
        clipTargetMin: 6,
        clipTargetMax: 6,
      },
      available: 198,
      busy: false,
      checking: false,
      enabled: true,
      onCancel() {},
      onApprove() {},
    }),
  );
  assert.match(html, /Ready to create your clips/);
  assert.match(html, /53m 53s/);
  assert.match(html, /up to 9 min total/);
  assert.match(html, /11 credits/);
  assert.match(html, /9 credits/);
  assert.match(html, /Up to 20 credits/);
  assert.match(html, /Remaining spendable credits after reservation/);
  assert.match(html, />178<\/strong>/);
  assert.match(html, /creating up to 6 strong clips/);
  assert.doesNotMatch(html, /aiming for|minimum clip count/);
  assert.doesNotMatch(html, /6–9 clips/);
});

test("credit explanation presents the authoritative nine-credit example and omits duplicate billing sections", () => {
  const { HowCreditsWork } = load(
    "apps/app/features/billing/components/HowCreditsWork.tsx",
    {
      "@blynta/ui": {
        AppDialog: ({ children }) => React.createElement("div", null, children),
        AppButton: ({ children }) =>
          React.createElement("button", null, children),
      },
    },
  );
  const html = renderToStaticMarkup(
    React.createElement(HowCreditsWork, {
      open: true,
      onOpenChange() {},
      balance: {
        pricing: { sourceSeconds: 300, outputSeconds: 60 },
        clipExample: { sourceCredits: 6, renderCredits: 3, totalCredits: 9 },
      },
    }),
  );
  assert.match(html, /per 5 minutes/);
  assert.match(html, /per minute/);
  assert.match(html, /9 credits total/);
  assert.match(html, /6 source \+ 3 output/);
  assert.doesNotMatch(
    html,
    /Reserved before we start|You stay in control|Studio|Subscription/,
  );
});

test("authorization failure offers a new estimate instead of retrying the old reservation", () => {
  const hooks = hookHarness();
  let retries = 0;
  const ui = {
    AppButton: function Button() {},
    AppDialog: function Dialog() {},
  };
  const HeroInput = function Hero() {};
  const { FailedStateCard } = load(
    "apps/app/features/jobs/components/FailedStateCard.tsx",
    {
      react: hooks.react,
      "../queries": {
        useRetryJob: () => ({
          mutateAsync: () => {
            retries++;
          },
          isPending: false,
        }),
      },
      "./helpers": { getJobId: (job) => job._id },
      "@blynta/ui": ui,
      "@/features/dashboard/components/HeroInput": { HeroInput },
      "lucide-react": { AlertTriangle: () => null, RefreshCw: () => null },
      sonner: { toast: {} },
    },
  );
  const job = {
    _id: "6ac8c8e15feea2543bffc322",
    sourceUrl: "https://youtu.be/example",
    processingFailure: {
      message: "Review a new source budget.",
      requiresApproval: true,
      retryAvailable: false,
    },
  };
  let tree = hooks.render(FailedStateCard, { job });
  const button = elements(tree, (e) => e.type === ui.AppButton)[0];
  assert.equal(button.props.children, "Review new credit estimate");
  assert.equal(elements(tree, (e) => e.type === HeroInput).length, 0);
  button.props.onClick();
  tree = hooks.render(FailedStateCard, { job });
  assert.equal(retries, 0);
  assert.equal(
    elements(tree, (e) => e.type === ui.AppDialog)[0].props.open,
    true,
  );
  const form = elements(tree, (e) => e.type === HeroInput)[0];
  assert.equal(form.props.initialSourceUrl, job.sourceUrl);
  assert.equal(form.props.reviewJobId, job._id);
});

test("insufficient-credit upgrade action links to the actual billing page", () => {
  const { InsufficientCredits } = load(
    "packages/ui/src/components/InsufficientCredits.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(InsufficientCredits, {
      required: 15,
      available: 5,
      billingUrl: "/billing",
      billingLabel: "View plans & upgrade",
    }),
  );
  assert.match(html, /href="\/billing"/);
  assert.match(html, /View plans &amp; upgrade/);
  assert.match(html, /15 credits/);
  assert.match(html, /5 available/);
});

test("credit explanation displays backend rates and example without assuming initial pricing", () => {
  const { HowCreditsWork } = load(
    "apps/app/features/billing/components/HowCreditsWork.tsx",
    {
      "@blynta/ui": {
        AppDialog: ({ children }) => React.createElement("div", null, children),
        AppButton: ({ children }) =>
          React.createElement("button", null, children),
      },
    },
  );
  const html = renderToStaticMarkup(
    React.createElement(HowCreditsWork, {
      open: true,
      onOpenChange() {},
      balance: {
        pricing: {
          sourceSeconds: 600,
          outputSeconds: 90,
          studioSeconds: 120,
          studioModifier: 2,
        },
        clipExample: { sourceCredits: 3, renderCredits: 2, totalCredits: 5 },
      },
    }),
  );
  assert.match(html, /per 10 minutes/);
  assert.match(html, /per 90 seconds/);
  assert.match(html, /5 credits total/);
  assert.doesNotMatch(html, /9 credits total/);
  assert.match(html, /rounded up once per job/);
});
