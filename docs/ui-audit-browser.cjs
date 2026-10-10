// Browser checks render real app components; all backend/session traffic is mocked.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { fixture, user } = require("./ui-audit-data.cjs");
const runtime =
  process.env.UI_AUDIT_NODE_MODULES ||
  "C:/Users/Shavaiz Ali/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { chromium } = require(path.join(runtime, "playwright"));
const output = path.join(__dirname, "ui-audit-evidence");
fs.mkdirSync(output, { recursive: true });
const widths = [375, 640, 768, 1024, 1280, 1440, 1920];
const records = [];
if (process.env.UI_AUDIT_RESUME && fs.existsSync(process.env.UI_AUDIT_RESUME)) {
  const source = fs.readFileSync(process.env.UI_AUDIT_RESUME, "utf8");
  if (source.trim().startsWith("[")) records.push(...JSON.parse(source));
  else
    for (const line of fs
      .readFileSync(process.env.UI_AUDIT_RESUME, "utf8")
      .split("\n")) {
      try {
        const r = JSON.parse(line);
        if (r.app && r.documentWidth === r.width && !r.pageErrors.length)
          records.push(r);
      } catch {}
    }
}
const adminViews = [
  "overview",
  "users",
  "user-detail",
  "jobs",
  "job-detail",
  "queues",
  "billing",
  "analytics",
  "audit",
  "clips",
  "system",
  "notifications",
  "settings",
  "flags",
  "providers",
  "models",
  "usage",
];
const mainViews = [
  "dashboard",
  "clips",
  "clip-detail",
  "studio",
  "workspace",
  "billing",
  "profile",
  "publications",
];
async function open(browser, app, view, width, scenario = "ready") {
  const port = app === "admin" ? 4101 : 4100;
  const state = {
    view,
    revision: 0,
    proposalStatus: "pending",
    rendered: false,
  };
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width, height: 1000 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/ui-audit-video.mp4"))
      return route.fulfill({
        contentType: "video/mp4",
        headers: url.searchParams.has("download")
          ? { "content-disposition": "attachment; filename=preview.mp4" }
          : {},
        body: fs.readFileSync(
          path.join(__dirname, "../apps/app/public/ui-audit-video.mp4"),
        ),
      });
    if (url.pathname === "/api/auth/session")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          user,
          expires: "2099-01-01T00:00:00.000Z",
          accessToken: "ui-audit-fake-not-a-token",
        }),
      });
    if (["4100", "4101"].includes(url.port) && url.hostname === "localhost")
      return route.continue();
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    let body;
    try {
      body = req.postDataJSON();
    } catch {}
    const response = fixture(
      url.pathname,
      req.method(),
      body,
      scenario,
      state,
      port,
    );
    return route.fulfill({
      status: response.status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(response.data),
    });
  });
  await page.goto(`http://localhost:${port}/auth/ui-audit?view=${view}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(900);
  return { page, context, state, errors };
}
async function geometry(page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    dialogs: [...document.querySelectorAll('[data-slot="dialog-content"]')].map(
      (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      },
    ),
  }));
}
async function record(
  app,
  view,
  width,
  ctx,
  scenario = "ready",
  screenshot = false,
) {
  const result = {
    app,
    view,
    width,
    scenario,
    ...(await geometry(ctx.page)),
    pageErrors: ctx.errors,
  };
  if (screenshot) {
    const file = `${app}-${view}-${scenario}-${width}.png`;
    await ctx.page.screenshot({
      path: path.join(output, file),
      fullPage: true,
    });
    result.screenshot = file;
  }
  const previous = records.findIndex(
    (r) =>
      r.app === app &&
      r.view === view &&
      r.width === width &&
      r.scenario === scenario,
  );
  if (previous >= 0) records[previous] = result;
  else records.push(result);
  console.log(JSON.stringify(result));
  assert.equal(
    result.documentWidth,
    width,
    `${app}/${view} overflows at ${width}`,
  );
  assert.deepEqual(ctx.errors, [], `${app}/${view} browser errors`);
}
async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const quick = process.argv.includes("--quick");
    for (const [app, views] of [
      ["admin", quick ? ["overview", "models"] : adminViews],
      ["app", quick ? ["dashboard", "workspace"] : mainViews],
    ]) {
      for (const view of views) {
        const sizes = quick ? [375, 1440] : widths;
        for (let i = 0; i < sizes.length; i += 3) {
          await Promise.all(
            sizes.slice(i, i + 3).map(async (width) => {
              if (
                records.some(
                  (r) =>
                    r.app === app &&
                    r.view === view &&
                    r.width === width &&
                    r.scenario === "ready",
                )
              )
                return;
              const ctx = await open(browser, app, view, width);
              try {
                await record(
                  app,
                  view,
                  width,
                  ctx,
                  "ready",
                  ["overview", "dashboard", "workspace", "models"].includes(
                    view,
                  ),
                );
              } finally {
                await ctx.context.close();
              }
            }),
          );
        }
      }
    }
    if (!quick) {
      for (const [app, view] of [
        ["admin", "overview"],
        ["app", "workspace"],
        ["app", "dashboard"],
        ["app", "profile"],
      ])
        for (const width of [375, 1440]) {
          const ctx = await open(browser, app, view, width, "offline");
          await record(app, view, width, ctx, "offline", true);
          await ctx.context.close();
        }
      // Management forms use actual shared selects and native FormData.
      const admin = await open(browser, "admin", "models", 375);
      await admin.page
        .getByRole("button", { name: "Edit", exact: true })
        .first()
        .click();
      await admin.page.getByRole("dialog").waitFor();
      await record("admin", "model-dialog", 375, admin, "ready", true);
      const formNames = await admin.page
        .locator("form")
        .last()
        .evaluate((form) => [...new FormData(form).keys()]);
      assert(
        formNames.includes("providerId") && formNames.includes("credentialId"),
      );
      await admin.context.close();
      // Actual workflow controls; mutations are intercepted at the HTTP boundary.
      const edit = await open(browser, "app", "workspace", 1440);
      await edit.page
        .getByRole("button", { name: "Apply changes", exact: true })
        .click();
      await edit.page.getByText("Changes applied", { exact: true }).waitFor();
      assert.equal(edit.state.revision, 1);
      assert.equal(edit.state.rendered, false);
      await edit.page
        .getByRole("button", { name: "Render preview", exact: true })
        .click();
      await edit.page.getByText("Preview ready", { exact: true }).waitFor();
      assert.equal(edit.state.rendered, true);

      await edit.page.getByRole("tab", { name: "Your assets" }).click();
      await edit.page
        .getByRole("button", { name: /Opening brand mark/ })
        .click();
      assert.match(
        await edit.page.locator("#studio-prompt").inputValue(),
        /Opening brand mark/,
      );
      const downloadEvent = edit.page.waitForEvent("download");
      await edit.page
        .getByRole("button", { name: "Download preview", exact: true })
        .click();
      const downloaded = await downloadEvent;
      assert.equal(await downloaded.failure(), null);
      await record("app", "workspace-applied", 1440, edit, "ready", true);
      await edit.context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(
        output,
        process.argv.includes("--quick")
          ? "quick-results.json"
          : "results.json",
      ),
      JSON.stringify(records, null, 2),
    );
  }
}
module.exports = { open, record, geometry, chromium, output };
if (require.main === module)
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
