import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(
    (id) => mocks[id] || require(id),
    module,
    module.exports,
  );
  return module.exports;
}
function history(query) {
  const { CreditHistory } = load(
    "apps/app/features/billing/components/CreditHistory.tsx",
    {
      "../queries": { useCreditHistory: () => ({ refetch() {}, ...query }) },
      "@blynta/ui": {
        AppButton: ({ children, contentClassName, ...props }) =>
          React.createElement("button", props, children),
        AppDropdown: ({ trigger }) => trigger,
      },
    },
  );
  return renderToStaticMarkup(React.createElement(CreditHistory));
}
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
    render(Component) {
      cursor = 0;
      return Component({});
    },
  };
}
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
    AppDropdown: function Dropdown() {},
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
  elements(
    tree,
    (e) => e.type === ui.AppButton && e.props.children === "Next",
  )[0].props.onClick();
  tree = hooks.render(CreditHistory);
  assert.equal(latest.page, 2);
  elements(tree, (e) => e.type === ui.AppDropdown)[0]
    .props.items.find((i) => i.key === "Studio")
    .onClick();
  tree = hooks.render(CreditHistory);
  assert.deepEqual(latest, { page: 1, product: "studio", type: "" });
  elements(tree, (e) => e.type === ui.AppDropdown)[1]
    .props.items.find((i) => i.key === "Refunds")
    .onClick();
  tree = hooks.render(CreditHistory);
  assert.deepEqual(latest, { page: 1, product: "studio", type: "refund" });
  assert.match(
    elements(tree, (e) => e.type === ui.AppDropdown)[1].props.trigger.props[
      "aria-label"
    ],
    /Refunds/,
  );
});
test("automatic budget is reviewed before approval and an insufficient balance blocks submission", async () => {
  const hooks = hookHarness();
  const calls = [];
  const submissions = [];
  const component = () => null;
  const ui = {
    AppDialog: component,
    AppButton: function Button() {},
    AppCard: component,
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
  const { HeroInput } = load(
    "apps/app/features/dashboard/components/HeroInput.tsx",
    {
      react: hooks.react,
      "@/features/jobs": {
        SourcePlatform: { YOUTUBE: "youtube" },
        useStylePresets: () => ({ data: [] }),
        useCreateJob: () => ({
          mutate: (body) => submissions.push(body),
          reset() {},
          isPending: false,
        }),
      },
      "@/features/auth/queries": {
        useCurrentUser: () => ({ data: { plan: "pro" } }),
      },
      "@/features/billing/queries": {
        useCreditBalance: () => ({ data: balance }),
      },
      "@/config/axiosClient": {
        axiosClient: {
          post: async (...args) => {
            calls.push(args);
            return { data: estimate };
          },
        },
      },
      "@/lib/utils": { cn: (...args) => args.join(" ") },
      "../icons": new Proxy({}, { get: () => component }),
      "@blynta/ui": ui,
      "@/features/billing/components/HowCreditsWork": {
        HowCreditsWork: function Help() {},
      },
      "next/link": { default: component },
      "next/navigation": { useRouter: () => ({ push() {} }) },
      sonner: { toast: {} },
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
    (e) => e.type === "input" && e.props.id === "video-url-input",
  )[0].props.onChange({
    target: { value: "https://youtube.com/watch?v=example" },
  });
  tree = hooks.render(HeroInput);
  await elements(tree, (e) => e.type === "form")[0].props.onSubmit();
  tree = hooks.render(HeroInput);
  assert.deepEqual(calls[0], [
    "/jobs/estimate",
    { sourceUrl: "https://youtube.com/watch?v=example" },
  ]);
  assert.equal(submissions.length, 0);
  let confirmation = elements(
    tree,
    (e) => e.type === ui.AppDialog && e.props.title === "Ready to generate?",
  )[0];
  assert.equal(confirmation.props.open, true);
  const confirmationHtml = renderToStaticMarkup(confirmation.props.children);
  assert.match(confirmationHtml, /Maximum approved cost/);
  assert.match(confirmationHtml, /maximum reservation, not your final charge/);
  assert.match(
    confirmationHtml,
    /actual charge is calculated after processing/,
  );
  assert.equal(confirmation.props.footer.props.disabled, false);
  confirmation.props.footer.props.onClick();
  assert.equal(submissions[0].authorizedCredits, 15);
  assert.equal(submissions[0].maxOutputSeconds, 540);
  assert.equal(submissions[0].pricingVersion, "live-pricing");
  balance.available = 5;
  tree = hooks.render(HeroInput);
  confirmation = elements(
    tree,
    (e) => e.type === ui.AppDialog && e.props.title === "Ready to generate?",
  )[0];
  assert.equal(confirmation.props.footer.props.disabled, true);
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
      e.type === "button" && e.props.children?.includes?.("How credits work"),
  )[0].props.onClick();
  tree = hooks.render(HeroInput);
  assert.equal(elements(tree, (e) => e.type === Help)[0].props.open, true);
  elements(tree, (e) => e.type === Help)[0].props.onOpenChange(false);
  tree = hooks.render(HeroInput);
  assert.equal(elements(tree, (e) => e.type === Help)[0].props.open, false);
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
