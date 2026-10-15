/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node component test approach. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  load,
  elements,
  createFixture,
  workspaceMocks,
} = require("./app-shell-harness.cjs");
const root = path.resolve(__dirname, "..");
const { getAppRoute } = load("components/layout/routes.ts");

for (const [route, title] of Object.entries({
  "/dashboard": "Home",
  "/studio": "AI Studio",
  "/studio/clip-1": "AI Studio",
  "/my-clips": "My Clips",
  "/my-clips/job-1/clips/clip-1": "My Clips",
  "/publications": "Publications",
  "/calendar": "Calendar",
  "/social-accounts": "Social Accounts",
  "/profile": "Profile",
  "/billing": "Billing",
  "/activity": "Activity",
})) {
  test(`${route} inherits one global header and all right controls`, () => {
    const fixture = createFixture();
    fixture.setPath(route);
    const html = renderToStaticMarkup(
      React.createElement(
        fixture.AppShell,
        null,
        React.createElement(fixture.PageContent, null, "Feature content"),
      ),
    );
    assert.equal((html.match(/data-app-header=/g) || []).length, 1);
    assert.equal((html.match(/<header\b/g) || []).length, 1);
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.match(html, new RegExp(`>${title}</h1>`));
    assert.equal(
      (html.match(/aria-label="View credit balance"/g) || []).length,
      1,
    );
    assert.match(html, /Notifications/);
    assert.match(html, /Layout Preview/);
    assert.equal(getAppRoute(route).workspace, route === "/studio/clip-1");
  });
}

test("section metadata does not match similarly named paths", () => {
  for (const route of ["/studio-old/clip", "/my-clips-backup", "/billing-old"])
    assert.equal(getAppRoute(route).title, "Blynta");
});

test("shared shell owns collapse and drawer state across route changes", () => {
  const state = [];
  let cursor = 0,
    pathname = "/dashboard",
    profileQueries = 0;
  function Header() {}
  function Sidebar() {}
  function Sheet() {}
  const { AppShell } = load("components/layout/AppShell.tsx", {
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
    },
    "next/navigation": { usePathname: () => pathname },
    "@/features/auth/queries": {
      useCurrentUser: () => {
        profileQueries++;
        return {};
      },
    },
    "@blynta/ui": { AppSidebar: Sidebar },
    "./AppHeader": { AppHeader: Header },
    "@/components/ui/sheet": { Sheet },
    "@/features/dashboard/components/InviteMembersDialog": {
      InviteMembersDialog() {},
    },
  });
  const render = () => {
    cursor = 0;
    return elements(AppShell({ children: "content" }));
  };
  let tree = render();
  assert.equal(tree.find((el) => el.type === Sidebar).props.collapsed, false);
  tree.find((el) => el.type === Header).props.onCollapse();
  pathname = "/studio/clip-1";
  tree = render();
  assert.equal(tree.find((el) => el.type === Sidebar).props.collapsed, true);
  assert.equal(tree.find((el) => el.type === Header).props.collapsed, true);
  tree.find((el) => el.type === Header).props.onMenu();
  tree = render();
  assert.equal(tree.find((el) => el.type === Sheet).props.open, true);
  // The production sidebar's mobile link callback closes the same drawer.
  const content = elements(tree.find((el) => el.type === Sheet)).find(
    (el) => el.props.onNavigate,
  );
  assert.ok(content);
  content.props.onNavigate();
  tree = render();
  assert.equal(tree.find((el) => el.type === Sheet).props.open, false);
  assert.equal(profileQueries, 4); // One observer per shell render, shared with both sidebars.
});

test("notifications still open through the existing controlled component", () => {
  let open = false;
  const { NotificationBell } = load(
    "features/notifications/components/NotificationBell.tsx",
    {
      react: {
        ...React,
        useState: () => [
          open,
          (value) => {
            open = value;
          },
        ],
      },
      "@blynta/ui": { AppNotificationControl() {} },
      "../queries": { useUnreadCountQuery: () => ({ data: { count: 7 } }) },
      "./NotificationDropdown": { NotificationDropdown() {} },
    },
  );
  let tree = NotificationBell({});
  assert.equal(tree.props.unreadCount, 7);
  tree.props.onOpenChange(true);
  tree = NotificationBell({});
  assert.equal(tree.props.open, true);
  tree.props.children.props.onClose();
  assert.equal(NotificationBell({}).props.open, false);
});

test("editor toolbar remains contextual and History, Media, Changes and preview switching work", () => {
  const fixture = workspaceMocks();
  const state = [];
  let cursor = 0;
  function Library() {}
  function Preview() {}
  const { StudioWorkspace } = load("features/ai-editor/StudioWorkspace.tsx", {
    ...fixture.mocks,
    react: {
      ...React,
      useEffect() {},
      useRef: (value) => ({ current: value }),
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
    },
    "./StudioLibraryPanel": { StudioLibraryPanel: Library },
    "./StudioPreviewPanel": { StudioPreviewPanel: Preview },
    "./StudioConversation": { StudioConversation() {} },
    "./StudioPromptComposer": { StudioPromptComposer() {} },
  });
  const render = () => {
    cursor = 0;
    return elements(StudioWorkspace(fixture));
  };
  let tree = render();
  assert.equal(tree[0].props.workspace, true);
  assert.equal(tree.filter((el) => el.type === "header").length, 2); // Clip toolbar and assistant heading, both within feature content.
  for (const [label, tab] of [
    ["History", "history"],
    ["Media", "media"],
    ["Changes", "changes"],
  ]) {
    elements(tree.find((el) => el.type === Preview).props.tools)
      .find((el) => el.props["aria-label"] === label)
      .props.onClick();
    tree = render();
    assert.equal(tree.find((el) => el.type === Library).props.open, true);
    assert.equal(tree.find((el) => el.type === Library).props.tab, tab);
  }
  const preview = tree.find((el) => el.type === Preview);
  assert.equal(preview.props.mode, "original");
  preview.props.onModeChange("preview");
  assert.equal(
    render().find((el) => el.type === Preview).props.mode,
    "preview",
  );
});

test("profile keeps the shared account menu and existing destinations", () => {
  const { UserDropdown } = load(
    "features/dashboard/components/UserDropdown.tsx",
    {
      "@blynta/ui": { AppAccountMenu() {} },
      "@blynta/auth/client": { logoutProduct() {} },
    },
  );
  const tree = UserDropdown({ profile: { name: "Account" } });
  assert.deepEqual(
    tree.props.links.map((link) => link.render.props.href),
    ["/profile", "/billing"],
  );
  assert.equal(typeof tree.props.onSignOut, "function");
});

test("loading and failed profile queries retain all global controls and session identity", () => {
  const fixture = createFixture();
  const { AppHeaderRight } = load("components/layout/AppHeaderRight.tsx", {
    "@blynta/auth/react": {
      useSession: () => ({ data: { user: { name: "Session User" } } }),
    },
    "@blynta/auth/client": { logoutProduct() {} },
    "next-themes": { useTheme: () => ({ theme: "dark", setTheme() {} }) },
    "@/features/notifications/components/NotificationBell": {
      NotificationBell: () =>
        React.createElement("button", null, "Notifications"),
    },
  });
  for (const profileError of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(AppHeaderRight, { profileError }),
    );
    assert.match(html, /View credit balance/);
    assert.match(html, /Notifications/);
    assert.match(html, /Session User/);
  }
  assert.ok(fixture.AppShell);
});

test("only authenticated route layout mounts the shell; providers stay above it", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  assert.match(
    read("app/(main)/layout.tsx"),
    /<AppShell>\{children\}<\/AppShell>/,
  );
  for (const file of [
    "app/layout.tsx",
    "app/(auth)/layout.tsx",
    "app/share/[token]/page.tsx",
    "app/auth/callback/route.ts",
  ])
    assert.doesNotMatch(read(file), /AppShell|AppProductHeader/);
  assert.match(read("app/layout.tsx"), /<Providers>\{children\}<\/Providers>/);
  function audit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) audit(file);
      else if (file.endsWith(".tsx"))
        assert.doesNotMatch(
          fs.readFileSync(file, "utf8"),
          /DashboardLayout|DashboardHeaderRight|<AppProductHeader|<AppSidebar\b/,
        );
    }
  }
  audit(path.join(root, "features"));
});

test("mobile Studio viewport follows the visual viewport when a keyboard reduces usable space", () => {
  const fixture = workspaceMocks(),
    effects = [];
  const previousWindow = global.window;
  const viewport = new EventTarget();
  viewport.height = 900;
  viewport.offsetTop = 0;
  let narrow = true;
  const browser = new EventTarget();
  browser.visualViewport = viewport;
  browser.matchMedia = () => ({ matches: narrow });
  global.window = browser;
  try {
    const { StudioWorkspace } = load("features/ai-editor/StudioWorkspace.tsx", {
      ...fixture.mocks,
      react: {
        ...React,
        useEffect: (fn) => effects.push(fn),
        useRef: (value) => ({ current: value }),
        useState: (value) => [value, () => {}],
      },
    });
    const workspace = elements(StudioWorkspace(fixture)).find(
      (el) => "data-studio-workspace" in el.props,
    );
    const surface = { style: {}, getBoundingClientRect: () => ({ top: 56 }) };
    workspace.props.ref.current = surface;
    const cleanup = effects
      .map((effect) => effect())
      .filter((fn) => typeof fn === "function");
    assert.equal(surface.style.maxHeight, "844px");
    viewport.height = 480;
    viewport.dispatchEvent(new Event("resize"));
    assert.equal(surface.style.maxHeight, "424px");
    viewport.height = 900;
    viewport.dispatchEvent(new Event("resize"));
    assert.equal(surface.style.maxHeight, "844px");
    narrow = false;
    browser.dispatchEvent(new Event("resize"));
    assert.equal(surface.style.maxHeight, "");
    cleanup.forEach((fn) => fn());
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});
