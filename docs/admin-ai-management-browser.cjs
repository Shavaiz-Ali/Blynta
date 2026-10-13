const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { open, chromium } = require("./ui-audit-browser.cjs");
const { ids, fixture } = require("./ui-audit-data.cjs");
const out = path.join(__dirname, "admin-ai-management-evidence");
fs.mkdirSync(out, { recursive: true });
const results = [];
async function capture(c, name, width) {
  await c.page.waitForTimeout(350);
  assert.deepEqual(c.errors, []);
  assert.equal(
    await c.page.evaluate(() => document.documentElement.scrollWidth),
    width,
  );
  await c.page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
  results.push({ capture: name, width, passed: true });
}
async function setup(b, width) {
  const c = await open(b, "admin", "providers", width);
  await c.page.setViewportSize({ width, height: 900 });
  await c.page.evaluate(() => document.documentElement.classList.add("dark"));
  await c.context.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        "nextjs-portal,.tsqd-parent-container{display:none!important}";
      document.head.appendChild(style);
    }),
  );
  await c.page.addStyleTag({
    content: "nextjs-portal,.tsqd-parent-container{display:none!important}",
  });
  const writes = [];
  let provider;
  await c.context.route("**/admin/ai/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === "GET") {
      const response = fixture(
        url.pathname,
        "GET",
        null,
        "ready",
        c.state,
        4101,
      );
      if (url.pathname === "/admin/ai/providers" && provider)
        response.data.data.items.push(provider);
      return route.fulfill({
        status: response.status,
        json: response.data,
        headers: { "access-control-allow-origin": "*" },
      });
    }
    const body = req.postDataJSON();
    writes.push({ path: url.pathname, body });
    if (c.fail) {
      c.fail = false;
      return route.fulfill({
        status: 503,
        json: { message: "Service unavailable" },
        headers: { "access-control-allow-origin": "*" },
      });
    }
    if (url.pathname === "/admin/ai/providers")
      provider = {
        ...body,
        _id: "abababababababababababab",
        configured: false,
        modelCount: 0,
      };
    return route.fulfill({
      json: { success: true, data: provider ?? { ...body, _id: ids.model } },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return Object.assign(c, { writes });
}
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    for (const width of [390, 1024, 1440]) {
      const c = await setup(b, width),
        p = c.page;
      try {
        await p
          .getByRole("button", { name: "Add provider", exact: true })
          .click();
        const dialog = p.getByRole("dialog");
        await dialog.getByLabel("Name", { exact: true }).fill("New provider");
        await dialog.getByLabel("Code", { exact: true }).fill("new-provider");
        await capture(c, "provider-dialog", width);
        await dialog
          .getByRole("button", { name: "Save provider", exact: true })
          .click();
        await dialog.waitFor({ state: "hidden" });
        assert.deepEqual(c.writes[0].body, {
          name: "New provider",
          code: "new-provider",
          adapter: "google",
          description: "",
          enabled: true,
        });
        await p.getByRole("cell", { name: /New provider/ }).waitFor();
        await p.getByRole("tab", { name: "Models", exact: true }).click();
        await p.getByRole("button", { name: "Add model", exact: true }).click();
        await dialog
          .getByLabel("Gemini model identifier", { exact: true })
          .fill("gemini-test-model");
        await dialog
          .getByLabel("Display name", { exact: true })
          .fill("Editing test");
        await capture(c, "model-dialog", width);
        const box = await dialog.boundingBox();
        if (width >= 1024)
          assert.ok(
            box.width >= 850,
            "Model dialog should use wide desktop layout",
          );
        const save = dialog.getByRole("button", {
          name: "Save model",
          exact: true,
        });
        assert.ok((await save.boundingBox()).y < 900, "Save must stay visible");
        await save.click();
        await dialog.waitFor({ state: "hidden" });
        const model = c.writes.find((w) => w.path === "/admin/ai/models").body;
        assert.equal(model.providerId, ids.provider);
        assert.equal(model.modelId, "gemini-test-model");
        assert.deepEqual(model.access.allowedPlans, [
          "free",
          "pro",
          "business",
        ]);
        assert.deepEqual(model.tasks, ["edit_planning", "edit_refinement"]);
        assert.equal(model.capabilities.structuredOutput, true);
        assert.equal(model.capabilities.toolCalling, true);
        assert.equal(model.enabled, false);
        assert.equal(model.settings.maxRetries, 0);
        await p.getByRole("tab", { name: "Providers", exact: true }).click();
        await p
          .getByRole("row")
          .filter({ hasText: "Google AI" })
          .getByRole("button", { name: "Credentials", exact: true })
          .click();
        await dialog.locator("[name=label]").fill("Browser test credential");
        await dialog
          .locator("[name=secret]")
          .fill("synthetic-test-key-not-real");
        const credentialResponse = p.waitForResponse(
          (r) =>
            r.url().endsWith("/credentials") && r.request().method() === "POST",
        );
        await dialog
          .getByRole("button", { name: "Add credential", exact: true })
          .click();
        await credentialResponse;
        await p.waitForTimeout(300);
        assert.ok(
          c.writes.some(
            (w) => w.path.endsWith("/credentials") && w.body.enabled === true,
          ),
        );
        await p.keyboard.press("Escape");
        await p.getByRole("tab", { name: "Usage", exact: true }).click();
        await capture(c, "usage-table", width);
        results.push({
          interaction:
            "provider model credential submit with shared form controls",
          width,
          passed: true,
        });
        console.log(width + " form workflows passed");
      } finally {
        await c.context.close();
      }
    }
    const c = await setup(b, 1440),
      p = c.page;
    try {
      await p
        .getByRole("button", { name: "Add provider", exact: true })
        .click();
      const d = p.getByRole("dialog");
      await d.getByLabel("Name", { exact: true }).fill("Retry provider");
      await d.getByLabel("Code", { exact: true }).fill("retry-provider");
      c.fail = true;
      await d
        .getByRole("button", { name: "Save provider", exact: true })
        .click();
      await d.getByRole("alert").waitFor();
      assert.equal(
        await d.getByLabel("Name", { exact: true }).inputValue(),
        "Retry provider",
      );
      await d
        .getByRole("button", { name: "Save provider", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      assert.equal(c.writes.length, 2);
      await p
        .getByRole("button", { name: "Add provider", exact: true })
        .click();
      await d.getByLabel("Name", { exact: true }).fill("Future adapter");
      await d.getByLabel("Code", { exact: true }).fill("future-adapter");
      await d.getByRole("radio", { name: /OpenAI/ }).click();
      await d
        .getByRole("button", { name: "Save provider", exact: true })
        .click();
      await d.getByText(/Uncheck Enabled/).waitFor();
      assert.equal(c.writes.length, 2);
      await d.getByRole("checkbox", { name: "Enabled", exact: true }).uncheck();
      await d
        .getByRole("button", { name: "Save provider", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      assert.equal(c.writes[2].body.enabled, false);
      assert.equal(c.writes[2].body.adapter, "openai");
      results.push({
        interaction:
          "request error preserves form and pending adapter requires disabled save",
        passed: true,
      });
      await p.getByRole("tab", { name: "Models", exact: true }).click();
      await p.getByRole("button", { name: "Add model", exact: true }).click();
      await d
        .getByLabel("Gemini model identifier", { exact: true })
        .fill("gemini-validation-test");
      await d
        .getByLabel("Display name", { exact: true })
        .fill("Validation test");
      await d
        .getByLabel("Input USD / million tokens", { exact: true })
        .fill("1");
      await d.getByRole("button", { name: "Save model", exact: true }).click();
      await d.getByText(/Enter both token prices/).waitFor();
      assert.equal(c.writes.length, 3);
      await d
        .getByLabel("Input USD / million tokens", { exact: true })
        .fill("");
      for (const name of ["edit planning", "edit refinement"])
        await d.getByRole("checkbox", { name, exact: true }).uncheck();
      await d.getByRole("button", { name: "Save model", exact: true }).click();
      await d
        .getByText("Select at least one supported task.", { exact: true })
        .waitFor();
      assert.equal(c.writes.length, 3);
      await d.getByRole("button", { name: "Cancel", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      results.push({
        interaction: "invalid pricing and missing tasks block API writes",
        passed: true,
      });
      await c.context.route("**/admin/ai/usage*", (route) =>
        route.fulfill({
          json: {
            success: true,
            data: { items: [], summary: [], page: 1, pageSize: 25 },
          },
        }),
      );
      await p.getByRole("tab", { name: "Usage", exact: true }).click();
      await p
        .getByRole("cell", { name: "No API usage recorded yet." })
        .waitFor();
      assert.equal(await p.getByRole("table").count(), 1);
      assert.equal(
        await p.getByRole("button", { name: "Next", exact: true }).count(),
        0,
      );
      await capture(c, "usage-empty", 1440);
      results.push({
        interaction:
          "empty state stays within shared table with no redundant pagination",
        passed: true,
      });
    } finally {
      await c.context.close();
    }
  } finally {
    await b.close();
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(results, null, 2),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
