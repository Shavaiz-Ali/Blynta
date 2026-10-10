const fs = require("node:fs");
const path = require("node:path");
const { open, geometry, chromium, output } = require("./ui-audit-browser.cjs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const checks = [];
  const views = [
    ...[
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
      "usage",
    ].map((view) => ["admin", view, 1440]),
    ...["users", "jobs", "billing"].map((view) => ["admin", view, 375]),
    ...[
      "clips",
      "clip-detail",
      "studio",
      "billing",
      "profile",
      "publications",
    ].map((view) => ["app", view, 1440]),
  ];
  try {
    for (let i = 0; i < views.length; i += 3)
      await Promise.all(
        views.slice(i, i + 3).map(async ([app, view, width]) => {
          const ctx = await open(browser, app, view, width);
          try {
            const screenshot = `${app}-${view}-ready-${width}.png`;
            await ctx.page.screenshot({
              path: path.join(output, screenshot),
              fullPage: true,
            });
            checks.push({
              app,
              view,
              width,
              ...(await geometry(ctx.page)),
              pageErrors: ctx.errors,
              screenshot,
            });
          } finally {
            await ctx.context.close();
          }
        }),
      );
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(output, "gallery-results.json"),
      JSON.stringify(checks, null, 2),
    );
  }
  console.log(`Captured ${checks.length} additional page screenshots.`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
