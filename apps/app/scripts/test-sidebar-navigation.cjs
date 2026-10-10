const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");

// Use the app's existing TypeScript-transpilation test approach, without a new runner.
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.join(root, "scripts"));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (id in overrides) return overrides[id];
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), id);
      for (const extension of [".ts", ".tsx"])
        if (fs.existsSync(target + extension))
          return load(path.relative(root, target + extension), overrides);
    }
    return original(id);
  };
  mod._compile(compiled, filename);
  return mod.exports;
}

const { isNavItemActive } = load("features/dashboard/navigation.ts");
const clips = { href: "/my-clips" };
const productionPath = "/my-clips/6ac6a144602fca3fa7eb8677";

for (const [pathname, expected] of [
  ["/my-clips", true],
  ["/my-clips/123", true],
  ["/my-clips/123/clips", true],
  ["/my-clips/123/clips/456", true],
  [productionPath, true],
  ["/my-clips-old", false],
  ["/my-clips-backup", false],
  ["/billing", false],
]) {
  test(`My Clips matches ${pathname}: ${expected}`, () => {
    assert.equal(isNavItemActive(pathname, clips), expected);
  });
}

test("root Home matches only / and Billing does not activate Home", () => {
  const home = { href: "/" };
  assert.equal(isNavItemActive("/", home), true);
  for (const pathname of ["/billing", "/my-clips", productionPath])
    assert.equal(isNavItemActive(pathname, home), false);
  assert.equal(isNavItemActive("/billing", { href: "/billing" }), true);
});

test("disabled items never activate", () => {
  const settings = { href: "/settings", disabled: true };
  assert.equal(isNavItemActive("/settings", settings), false);
  assert.equal(isNavItemActive("/settings/account", settings), false);
});

// Render the actual layout and shared sidebar item. Stub unrelated profile,
// icons, dialogs and containers; expose both desktop and mobile navigation.
const container = ({ children }) => React.createElement("div", null, children);
const tooltip = {
  Tooltip: container,
  TooltipContent: container,
  TooltipTrigger: ({ render, children }) => render || children,
};
const workspace = load("../../packages/ui/src/components/AppWorkspace.tsx", {
  "../primitives/tooltip": tooltip,
});
let currentPath = productionPath;
const icon = () => React.createElement("svg");
const { DashboardLayout, navGroups } = load(
  "features/dashboard/components/DashboardLayout.tsx",
  {
    "next/navigation": { usePathname: () => currentPath },
    "next/link": { default: (props) => React.createElement("a", props) },
    "@/components/logo": { BlyntaLogo: () => null },
    "@blynta/ui": {
      ...workspace,
      AppButton: container,
      AppProductHeader: container,
    },
    "@/components/ui/separator": { Separator: () => null },
    "@/components/ui/sheet": {
      Sheet: container,
      SheetContent: container,
      SheetTitle: container,
    },
    "@/components/ui/tooltip": tooltip,
    "@/components/ui/badge": { Badge: container },
    "@/components/ui/avatar": {
      Avatar: container,
      AvatarFallback: container,
    },
    "@/lib/utils": load("lib/utils.ts"),
    "@/features/auth/queries": { useCurrentUser: () => ({ data: null }) },
    "./InviteMembersDialog": { InviteMembersDialog: () => null },
    "../icons": Object.fromEntries(
      [
        "UserPlus",
        "Film",
        "Clock",
        "CreditCard",
        "Settings",
        "Upload",
        "Share2",
        "User",
        "Activity",
      ].map((name) => [`${name}Icon`, icon]),
    ),
  },
);

const items = navGroups.flatMap((group) => group.items);

test("every actual sidebar item uses segment-safe section matching", () => {
  assert.equal(items.length, 10);
  for (const item of items) {
    assert.equal(isNavItemActive(item.href, item), !item.disabled, item.label);
    assert.equal(
      isNavItemActive(`${item.href}/123/details`, item),
      !item.disabled,
      item.label,
    );
    assert.equal(isNavItemActive(`${item.href}-old`, item), false, item.label);
    for (const other of items.filter((other) => other !== item))
      assert.equal(isNavItemActive(other.href, item), false, item.label);
  }
});

for (const pathname of [
  "/studio",
  "/studio/123",
  "/my-clips",
  "/my-clips/123",
  "/my-clips/123/clips/456",
  productionPath,
  "/my-clips-old",
  "/my-clips-backup",
  "/dashboard",
  "/billing",
]) {
  test(`rendered desktop and mobile sidebar highlights at ${pathname}`, () => {
    currentPath = pathname;
    const html = renderToStaticMarkup(React.createElement(DashboardLayout));
    const navs = [...html.matchAll(/<nav\b[^>]*>(.*?)<\/nav>/gs)];
    assert.equal(navs.length, 2);
    const expectedHref =
      pathname.startsWith("/my-clips/") || pathname === "/my-clips"
        ? "/my-clips"
        : pathname === "/studio" || pathname.startsWith("/studio/")
          ? "/studio"
          : ["/dashboard", "/billing"].includes(pathname)
            ? pathname
            : undefined;
    for (const [, nav] of navs) {
      const active = [...nav.matchAll(/<a\b([^>]*)>/g)].filter(([, attrs]) =>
        attrs.includes('aria-current="page"'),
      );
      assert.equal(active.length, expectedHref ? 1 : 0);
      if (expectedHref) {
        assert.ok(active[0][1].includes(`href="${expectedHref}"`));
        assert.match(active[0][1], /\bbg-primary\b/);
        assert.match(active[0][1], /\btext-primary-foreground\b/);
      }
    }
  });
}
