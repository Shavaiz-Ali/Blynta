// Synthetic verification of the real listing components. No live API writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  path.join(
    process.env.UI_AUDIT_NODE_MODULES ||
      "C:/Users/Shavaiz Ali/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    "playwright",
  ),
);
const { fixture, user, ids } = require("./ui-audit-data.cjs");
const out = path.join(__dirname, "studio-listing-checkpoint-evidence");
fs.mkdirSync(out, { recursive: true });
const date = "2026-10-16T08:00:00Z";
const projects = [
  "Opening scene",
  "Quieter background music",
  "A stronger closing moment",
  "Captions and pacing",
].map((title, index) => ({
  _id: `${index}`.padStart(24, "d"),
  sourceClipId: ids.clip,
  sourceJobId: ids.job,
  clipTitle: title,
  thumbnailUrl: "http://127.0.0.1:4100/auth/listing-thumb.svg",
  outputDuration: 58,
  revision: 2,
  createdAt: date,
  updatedAt: date,
  latestPreview:
    index === 3
      ? null
      : { revision: 2, status: ["completed", "processing", "failed"][index] },
}));
const clips = projects.map((p, i) => ({
  _id: `${i}`.padStart(24, "c"),
  jobId: ids.job,
  title: p.clipTitle,
  thumbnailUrl: p.thumbnailUrl,
  duration: 58,
  createdAt: date,
  projectId: i === 0 ? p._id : null,
}));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const results = [];
  try {
    for (const width of (
      process.env.STUDIO_LISTING_WIDTHS || "375,768,1024,1440,1920"
    )
      .split(",")
      .map(Number)) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(90000);
      const errors = [],
        writes = [],
        queries = [];
      let empty = false,
        offline = false,
        delayed = false;
      page.on("pageerror", (error) => errors.push(error.message));
      await context.addInitScript(() => localStorage.setItem("theme", "dark"));
      await context.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.pathname === "/api/auth/session")
          return route.fulfill({
            json: {
              user,
              expires: "2099-01-01T00:00:00Z",
              accessToken: "synthetic-token",
            },
          });
        if (url.pathname === "/auth/listing-thumb.svg")
          return route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#273c63"/><circle cx="480" cy="120" r="110" fill="#45679c"/><text x="35" y="280" fill="white" font-family="sans-serif" font-size="35">A creative moment</text></svg>',
          });
        if (url.hostname === "127.0.0.1" && url.port === "4100")
          return route.continue();
        const headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        };
        if (req.method() === "OPTIONS")
          return route.fulfill({ status: 204, headers });
        if (req.method() !== "GET") writes.push(url.pathname);
        let response;
        if (["/ai-editor/plans", "/ai-editor/clips"].includes(url.pathname)) {
          queries.push(url.pathname + url.search);
          if (delayed) await new Promise((resolve) => setTimeout(resolve, 500));
          const data = url.pathname.endsWith("/plans") ? projects : clips;
          const items = empty
            ? []
            : data.filter((item) =>
                (item.clipTitle || item.title)
                  .toLowerCase()
                  .includes(
                    (url.searchParams.get("search") || "").toLowerCase(),
                  ),
              );
          if (offline)
            return route.fulfill({
              status: 503,
              headers,
              json: { success: false, error: { message: "Synthetic offline" } },
            });
          response = {
            status: 200,
            data: {
              success: true,
              data: {
                items,
                total: items.length ? 28 : 0,
                totalPages: items.length ? 3 : 1,
              },
            },
          };
        } else
          response = fixture(
            url.pathname,
            req.method(),
            undefined,
            "ready",
            {},
            4100,
          );
        return route.fulfill({
          status: response.status,
          headers,
          json: response.data,
        });
      });
      await page.goto("http://127.0.0.1:4100/auth/studio-preview?view=listing");
      await page
        .getByRole("link", { name: "Open project: Opening scene", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(out, `projects-grid-${width}.png`),
        fullPage: true,
      });
      await page.getByRole("tab", { name: "List", exact: true }).click();
      await page.screenshot({
        path: path.join(out, `projects-list-${width}.png`),
        fullPage: true,
      });
      assert.equal(
        await page.getByText("Continue editing", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("link", {
            name: "Open project: Opening scene",
            exact: true,
          })
          .getAttribute("href"),
        `/studio/${ids.clip}?jobId=${ids.job}`,
      );
      await page.getByRole("tab", { name: "All Clips", exact: true }).click();
      await page
        .getByRole("link", {
          name: "Edit with AI: Quieter background music",
          exact: true,
        })
        .waitFor();
      await page.getByRole("tab", { name: "Grid", exact: true }).click();
      await page.screenshot({
        path: path.join(out, `clips-grid-${width}.png`),
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false, `Overflow at ${width}`);
      await page.getByRole("tab", { name: "List", exact: true }).click();
      await page.screenshot({
        path: path.join(out, `clips-list-${width}.png`),
        fullPage: true,
      });
      if (width === 1440) {
        await page
          .getByRole("button", { name: "New AI Edit", exact: true })
          .click();
        await page.getByRole("dialog").waitFor();
        await page
          .getByRole("textbox", { name: "Search clips to edit" })
          .fill("Quieter");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /Quieter background music/ })
          .waitFor();
        await page.screenshot({ path: path.join(out, "clip-picker-1440.png") });
        await page.keyboard.press("Escape");
        await page
          .getByRole("tab", { name: "My Projects", exact: true })
          .click();
        const nextPage = page.waitForResponse(
          (res) =>
            res.url().includes("/ai-editor/plans?") &&
            res.url().includes("page=2"),
        );
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.getByText("Page 2 of 3", { exact: true }).waitFor();
        await nextPage;
        assert(queries.some((q) => q.includes("page=2")));
        await page
          .getByRole("textbox", { name: "Search projects", exact: true })
          .fill("no such title");
        await page.getByRole("heading", { name: "No matches found" }).waitFor();
        await page
          .getByRole("button", { name: "Clear search", exact: true })
          .click();
        await page
          .getByRole("link", {
            name: "Open project: Opening scene",
            exact: true,
          })
          .waitFor();
        empty = true;
        await page.reload();
        await page
          .getByRole("heading", { name: "No AI projects yet" })
          .waitFor();
        await page.screenshot({
          path: path.join(out, "projects-empty-1440.png"),
        });
        empty = false;
        offline = true;
        await page.reload();
        await page
          .getByText("Projects couldn’t be loaded", { exact: true })
          .waitFor({ timeout: 30000 });
        offline = false;
        delayed = true;
        await page.getByRole("button", { name: /Try again|Retry/ }).click();
        await page
          .getByRole("link", {
            name: "Open project: Opening scene",
            exact: true,
          })
          .waitFor();
        await page.goto(
          "http://127.0.0.1:4100/auth/studio-preview?view=reference",
        );
        await page.reload({ waitUntil: "networkidle" });
        await page
          .getByRole("heading", { name: "Clips Library.", exact: true })
          .waitFor();
        await page
          .getByText("How a small creative habit changes your day", {
            exact: true,
          })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: path.join(out, "my-clips-grid-reference-1440.png"),
          fullPage: true,
        });
        await page.getByRole("tab", { name: "List", exact: true }).click();
        await page
          .getByRole("button", { name: "View clips", exact: true })
          .waitFor();
        await page.screenshot({
          path: path.join(out, "my-clips-list-reference-1440.png"),
          fullPage: true,
        });
      }
      assert.equal(
        writes.length,
        0,
        "Browsing must not create plans or sessions",
      );
      assert.deepEqual(errors, []);
      results.push({ width, overflow, browserErrors: errors, writes });
      await context.close();
    }
    const previous =
      process.env.STUDIO_LISTING_WIDTHS &&
      fs.existsSync(path.join(out, "results.json"))
        ? JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8"))
        : [];
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(
        [
          ...previous.filter(
            (item) => !results.some((result) => result.width === item.width),
          ),
          ...results,
        ].sort((a, b) => a.width - b.width),
        null,
        2,
      ),
    );
    console.log(
      "Listing layouts, tabs, view modes, search, pagination, picker, empty/error/retry, and read-only browsing passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
