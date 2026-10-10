// Runs against real frontend components with synthetic transport fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { open, geometry, chromium, output } = require("./ui-audit-browser.cjs");
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    await check(
      "Hero model/style selection, estimate confirmation and job payload",
      async () => {
        const ctx = await open(browser, "app", "dashboard", 375);
        try {
          const page = ctx.page;
          assert.equal(
            await page
              .getByRole("button", { name: "Review & Generate" })
              .isDisabled(),
            true,
          );
          await page
            .locator("#video-url-input")
            .fill("https://youtube.com/watch?v=example");
          await page.getByRole("button", { name: /Meme \/ Funny/ }).click();
          await page.getByRole("combobox", { name: "AI model" }).click();
          await page.getByRole("option", { name: /Creator model/ }).click();
          await page.getByRole("button", { name: "Review & Generate" }).click();
          await page.getByRole("dialog").waitFor();
          const bounds = await geometry(page);
          assert.equal(bounds.documentWidth, 375);
          await page.screenshot({
            path: path.join(output, "app-generation-confirmation-375.png"),
            fullPage: true,
          });
          await page.getByRole("button", { name: /Generate clips/ }).click();
          await page.waitForFunction(
            () => !document.querySelector('[role="dialog"]'),
          );
          assert.equal(ctx.state.jobsPayload.stylePreset, "meme");
          assert.equal(
            ctx.state.jobsPayload.modelId,
            "eeeeeeeeeeeeeeeeeeeeeeee",
          );
          assert.equal(ctx.state.jobsPayload.authorizedCredits, 5);
          assert.equal(
            ctx.state.jobsPayload.sourceUrl,
            "https://youtube.com/watch?v=example",
          );
          assert.match(ctx.state.jobsPayload.operationId, /^[a-f\d-]{36}$/i);
        } finally {
          await ctx.context.close();
        }
      },
    );
    await check("Admin mobile navigation and subscription filter", async () => {
      const ctx = await open(browser, "admin", "users", 375);
      try {
        await ctx.page
          .getByRole("combobox", { name: "Subscription plan" })
          .click();
        await ctx.page
          .getByRole("option", { name: "Pro", exact: true })
          .click();
        assert.match(
          await ctx.page
            .getByRole("combobox", { name: "Subscription plan" })
            .innerText(),
          /Pro/,
        );
        await ctx.page.getByRole("button", { name: "Toggle Sidebar" }).click();
        const nav = ctx.page.getByRole("dialog");
        await nav.waitFor();
        assert.equal(await nav.locator('a[href="/jobs"]').count(), 1);
        assert.equal(await nav.locator('a[href="/ai"]').count(), 1);
        await ctx.page.screenshot({
          path: path.join(output, "admin-navigation-375.png"),
          fullPage: true,
        });
      } finally {
        await ctx.context.close();
      }
    });
    await check(
      "Studio rejection, prompt submission and bounded mobile composer",
      async () => {
        const ctx = await open(browser, "app", "workspace", 375);
        try {
          await ctx.page
            .getByRole("button", { name: "Reject", exact: true })
            .click();
          await ctx.page.getByText("rejected", { exact: true }).waitFor();
          assert.equal(ctx.state.revision, 0);
          await ctx.page
            .locator("#studio-prompt")
            .fill("Keep original audio and add a gentle zoom.");
          await ctx.page
            .getByRole("button", { name: "Send", exact: true })
            .click();
          await ctx.page.waitForTimeout(800);
          assert.match(ctx.state.promptPayload.prompt, /Keep original audio/);
          assert.equal(ctx.state.rendered, false);
          const transcript = ctx.page.locator(
            '[aria-label="Editing conversation"]',
          );
          if (await transcript.count())
            assert.equal(
              await transcript.evaluate((e) => getComputedStyle(e).overflowY),
              "auto",
            );
        } finally {
          await ctx.context.close();
        }
      },
    );
    await check(
      "Admin charts, queue table and recent activity below the fold",
      async () => {
        const ctx = await open(browser, "admin", "overview", 1440);
        try {
          await ctx.page
            .locator("#main-content")
            .evaluate((e) => (e.scrollTop = e.scrollHeight));
          await ctx.page.screenshot({
            path: path.join(output, "admin-overview-bottom-1440.png"),
            fullPage: true,
          });
          assert.deepEqual(ctx.errors, []);
        } finally {
          await ctx.context.close();
        }
      },
    );
    await check(
      "Dark theme maintains Studio controls and preview playback",
      async () => {
        const ctx = await open(browser, "app", "workspace", 1440);
        try {
          await ctx.page.evaluate(() =>
            document.documentElement.classList.add("dark"),
          );
          await ctx.page.waitForFunction(
            () => document.querySelector("video")?.readyState >= 2,
          );
          await ctx.page.screenshot({
            path: path.join(output, "app-workspace-dark-1440.png"),
            fullPage: true,
          });
          assert.equal(
            await ctx.page
              .getByRole("button", { name: "Apply changes" })
              .isEnabled(),
            true,
          );
        } finally {
          await ctx.context.close();
        }
      },
    );
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(output, "interaction-results.json"),
      JSON.stringify(checks, null, 2),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
