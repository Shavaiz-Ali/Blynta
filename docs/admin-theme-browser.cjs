// Real admin components with synthetic API/session responses; no live writes.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { open, chromium } = require("./ui-audit-browser.cjs");
const output = path.join(__dirname, "admin-theme-evidence");
fs.mkdirSync(output, { recursive: true });
const results = [];
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [390, 1440]) {
      for (const view of [
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
      ]) {
        const c = await open(browser, "admin", view, width);
        try {
          await c.page.evaluate(() =>
            document.documentElement.classList.add("dark"),
          );
          await c.page.addStyleTag({
            content:
              "nextjs-portal,.tsqd-parent-container{display:none!important}",
          });
          await c.page.waitForTimeout(400);
          assert.deepEqual(c.errors, [], view);
          assert.equal(
            await c.page.evaluate(() => document.documentElement.scrollWidth),
            width,
            view,
          );
          const font = await c.page.evaluate(
            () => getComputedStyle(document.body).fontFamily,
          );
          assert.match(font, /Inter/i, "Admin must use the main app font");
          if (["providers", "models", "users", "billing"].includes(view))
            await c.page.screenshot({
              path: path.join(output, `${view}-${width}.png`),
            });
          if (view === "models") {
            await c.page
              .getByRole("button", { name: "Add model", exact: true })
              .click();
            const dialog = c.page.getByRole("dialog");
            const before = await dialog.boundingBox();
            const highlight = dialog.getByRole("checkbox", {
              name: "highlight detection",
              exact: true,
            });
            await highlight.check();
            await highlight.uncheck();
            await highlight.check();
            const after = await dialog.boundingBox();
            assert.ok(
              Math.abs(before.y - after.y) < 2,
              "Checkbox focus must not move the dialog",
            );
            assert.ok(
              Math.abs(before.height - after.height) < 2,
              "Checkbox must not resize the dialog",
            );
            const title = await dialog
              .locator('[data-slot="dialog-header"]')
              .boundingBox();
            const save = await dialog
              .getByRole("button", { name: "Save model", exact: true })
              .boundingBox();
            assert.ok(
              title.y >= after.y &&
                save.y + save.height < after.y + after.height + 1,
            );
            await c.page.screenshot({
              path: path.join(output, `model-highlight-${width}.png`),
            });
            await c.page.keyboard.press("Escape");
            await dialog.waitFor({ state: "hidden" });
            await c.page
              .getByRole("button", { name: "Columns", exact: true })
              .click();
            const column = c.page.getByRole("checkbox", {
              name: "Priority",
              exact: true,
            });
            await column.uncheck();
            await c.page.keyboard.press("Escape");
            assert.equal(
              await c.page
                .getByRole("columnheader", { name: "Priority", exact: true })
                .count(),
              0,
            );
          }
          if (view === "providers" && width === 1440) {
            await c.page.evaluate(() =>
              document.documentElement.classList.remove("dark"),
            );
            await c.page.screenshot({
              path: path.join(output, "providers-light-1440.png"),
            });
          }
          results.push({ view, width, font, passed: true });
        } finally {
          await c.context.close();
        }
      }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(output, "results.json"),
      JSON.stringify(results, null, 2),
    );
  }
  console.log(`${results.length} admin route/viewport checks passed`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
