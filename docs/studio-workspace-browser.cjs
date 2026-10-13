const { open } = require("./ai-native-browser.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { ids } = require("./ui-audit-data.cjs");
const ownedAssetId = "77777777-7777-4777-8777-777777777777";
const { chromium } = require(
  path.join(
    process.env.UI_AUDIT_NODE_MODULES ||
      "C:/Users/Shavaiz Ali/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    "playwright",
  ),
);
const out = path.join(__dirname, "studio-workspace-evidence");
fs.mkdirSync(out, { recursive: true });
const results = [];
async function record(c, label, width) {
  await c.page.waitForTimeout(400);
  const g = await c.page.evaluate(() => {
    const bounds = (selector) => {
      const e = document.querySelector(selector);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
      };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      workspace: bounds("[data-studio-workspace]"),
      composer: bounds('[aria-label="Editing prompt composer"]'),
      canvas: bounds(".studio-canvas"),
      video: bounds("video"),
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      dialog: bounds('[role="dialog"]'),
    };
  });
  assert.equal(g.documentWidth, width, label + " horizontal overflow");
  if (g.dialog) {
    if (width >= 1024) {
      assert.ok(
        Math.abs(g.dialog.x - (width - 384)) < 2,
        label + " desktop tools position",
      );
      assert.ok(Math.abs(g.dialog.width - 384) < 2);
    } else
      assert.ok(
        Math.abs(g.dialog.bottom - g.height) < 2,
        label + " mobile bottom sheet",
      );
  }
  assert.deepEqual(c.errors, [], label + " page errors");
  if (label === "welcome")
    assert.ok(
      g.composer.bottom <= g.height + 2,
      label + " mobile composer offscreen",
    );
  if (width >= 1024) {
    assert.ok(
      g.workspace.bottom <= g.height + 2,
      label + " workspace exceeds viewport",
    );
    assert.ok(g.composer.bottom <= g.height + 2, label + " composer offscreen");
  }
  await c.page.screenshot({
    path: path.join(out, `${label}-${width}.png`),
    fullPage: true,
  });
  results.push({ label, ...g, pageErrors: c.errors });
  console.log(label + " " + width + " passed");
}
async function create(browser, width, scenario = "ready") {
  const c = await open(browser, "workspace", width, scenario, {
    assetId: ownedAssetId,
  });
  await c.context.addInitScript(() => {
    const install = () => {
      const style = document.createElement("style");
      style.textContent =
        "nextjs-portal,.tsqd-parent-container{display:none!important}";
      document.head.appendChild(style);
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  });
  await c.page.addStyleTag({
    content: "nextjs-portal,.tsqd-parent-container{display:none!important}",
  });
  await c.page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
  await c.page.evaluate(() => document.documentElement.classList.add("dark"));
  await c.page.waitForTimeout(400);
  return c;
}
async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    if (process.env.STUDIO_FIRST_LOOK) {
      const c = await create(browser, 1440);
      await record(c, "pending", 1440);
      await c.context.close();
      return;
    }
    for (const width of [375, 390, 640, 768, 1024, 1280, 1440, 1920]) {
      const c = await create(browser, width, "empty");
      try {
        await record(c, "welcome", width);
        assert.equal(await c.page.getByRole("dialog").count(), 0);
        assert.equal(
          await c.page
            .getByRole("button", { name: "Download preview", exact: true })
            .count(),
          0,
        );
        const prompt = c.page.locator("#studio-prompt");
        await c.page
          .getByRole("button", {
            name: "Lower the original audio to 70%.",
            exact: true,
          })
          .click();
        assert.equal(
          await prompt.inputValue(),
          "Lower the original audio to 70%.",
        );
        assert.equal(c.state.promptPayload, undefined);
      } finally {
        await c.context.close();
      }
    }
    for (const width of [390, 1024, 1440]) {
      const c = await create(browser, width);
      const p = c.page;
      try {
        await record(c, "pending", width);
        await p.getByRole("button", { name: "History", exact: true }).click();
        await p.getByRole("dialog").waitFor();
        await record(c, "history", width);
        await p.keyboard.press("Escape");
        await p.getByRole("dialog").waitFor({ state: "hidden" });
        assert.equal(
          await p
            .getByRole("button", { name: "History", exact: true })
            .evaluate((e) => document.activeElement === e),
          true,
        );
        await p.getByRole("button", { name: "Media", exact: true }).click();
        await p
          .getByRole("dialog")
          .getByRole("button", { name: /Opening brand mark/ })
          .click();
        await p.getByRole("list", { name: "Prompt attachments" }).waitFor();
        await p
          .getByRole("button", { name: /Remove Opening brand mark/ })
          .click();
        await p.getByRole("combobox", { name: "AI model" }).click();
        await p.getByRole("option", { name: /Creator model/ }).click();
        await p.locator("#studio-prompt").fill("Use my attached image.");
        await p.getByRole("button", { name: "Attach", exact: true }).click();
        await p
          .getByRole("button", { name: "Choose from your assets" })
          .click();
        await p.getByRole("button", { name: /Opening brand mark/ }).click();
        await p.locator("#studio-prompt").press("Shift+Enter");
        assert.ok(
          (await p.locator("#studio-prompt").inputValue()).endsWith("\n"),
        );
        assert.equal(c.state.promptPayload, undefined);
        await p.locator("#studio-prompt").press("Enter");
        await p.waitForTimeout(500);
        assert.deepEqual(c.state.promptPayload.selectedAssetIds, [
          ownedAssetId,
        ]);
        assert.equal(c.state.promptPayload.modelId, ids.model);
        assert.equal(c.state.rendered, false);
        await record(c, "active", width);
        await p
          .getByRole("button", { name: "Apply changes", exact: true })
          .click();
        await p.getByText("Changes applied", { exact: true }).waitFor();
        assert.equal(c.state.rendered, false);
        await c.context.route("**/ai-editor/plans/*/versions?*", (route) => {
          if (!c.state.renderStarted) return route.fallback();
          return route.fulfill({
            json: {
              success: true,
              data: {
                items: [
                  {
                    _id: ids.version,
                    planId: ids.plan,
                    revision: 1,
                    status: c.state.rendered ? "completed" : "processing",
                    progress: c.state.rendered ? 100 : 42,
                    createdAt: "2026-10-13T06:00:00Z",
                  },
                ],
                page: 1,
                pageSize: 25,
              },
            },
          });
        });
        await c.context.route("**/ai-editor/plans/*/preview", (route) => {
          c.state.renderStarted = true;
          return route.fulfill({
            json: {
              success: true,
              data: {
                _id: ids.version,
                planId: ids.plan,
                revision: 1,
                status: "processing",
                progress: 42,
                createdAt: "2026-10-13T06:00:00Z",
              },
            },
          });
        });
        await p
          .getByRole("button", { name: "Render preview", exact: true })
          .click();
        await p.getByText("Rendering preview", { exact: true }).waitFor();
        assert.equal(
          await p
            .getByRole("progressbar", { name: "Render progress" })
            .getAttribute("value"),
          "42",
        );
        await record(c, "rendering", width);
        c.state.rendered = true;
        await p
          .getByText("Preview ready", { exact: true })
          .last()
          .waitFor({ timeout: 12000 });
        await p.waitForFunction(
          () => document.querySelector("video")?.readyState >= 2,
        );
        await p.getByRole("tab", { name: "Original", exact: true }).click();
        await p
          .getByRole("tab", { name: "Edited preview", exact: true })
          .click();
        await record(c, "completed", width);
        await p.getByRole("button", { name: "History", exact: true }).click();
        await p
          .getByRole("dialog")
          .getByRole("button", { name: /Revision 1/ })
          .click();
        await p.getByRole("dialog").waitFor({ state: "hidden" });
        const player = p.getByRole("region", {
          name: /Edited preview revision/,
        });
        await player.focus();
        await p.keyboard.press("Space");
        await p.waitForFunction(
          () => document.querySelector("video")?.paused === false,
        );
        await p.keyboard.press("Space");
        await p.waitForFunction(
          () => document.querySelector("video")?.paused === true,
        );
        const scrub = p.getByRole("slider", { name: "Video position" });
        await scrub.focus();
        await p.keyboard.press("Home");
        await p.keyboard.press("ArrowRight");
        await p.waitForFunction(
          () => document.querySelector("video")?.currentTime >= 0.9,
        );
        if (width >= 1024) {
          await p
            .getByRole("button", { name: "Enter fullscreen", exact: true })
            .click();
          await p.waitForFunction(() => !!document.fullscreenElement);
          await p
            .getByRole("button", { name: "Exit fullscreen", exact: true })
            .click();
        }
        const dl = p.waitForEvent("download");
        await p
          .getByRole("button", { name: "Download preview", exact: true })
          .click();
        assert.ok((await dl).suggestedFilename().endsWith(".mp4"));
        let release;
        const gate = new Promise((r) => (release = r));
        await c.context.route(
          "https://upload.example.test/**",
          async (route) => {
            await gate;
            await route.fulfill({
              status: 200,
              headers: { "access-control-allow-origin": "*" },
              body: "",
            });
          },
        );
        await p.locator("input[type=file]").setInputFiles({
          name: "logo.png",
          mimeType: "image/png",
          buffer: Buffer.from("synthetic png transport"),
        });
        await p
          .getByRole("list", { name: "Prompt attachments" })
          .getByText("uploading", { exact: true })
          .waitFor();
        await record(c, "uploading", width);
        assert.equal(
          await p
            .getByRole("button", { name: "Send", exact: true })
            .isDisabled(),
          true,
        );
        release();
        await p.getByText("Validating", { exact: true }).waitFor();
        c.state.validated = true;
        await p
          .getByRole("list", { name: "Prompt attachments" })
          .getByText("ready", { exact: true })
          .waitFor({ timeout: 12000 });
        await c.context.route("**/ai/models/available?*", (route) =>
          route.fulfill({
            json: {
              success: true,
              data: {
                plan: "pro",
                selectionAllowed: true,
                defaultModelId: null,
                models: [],
              },
            },
          }),
        );
        await p.reload({ waitUntil: "networkidle" });
        await p.evaluate(() => document.documentElement.classList.add("dark"));
        await p
          .getByText("AI editing is unavailable.", { exact: false })
          .waitFor();
        await record(c, "unavailable", width);
        assert.equal(
          await p
            .getByRole("button", { name: "Send", exact: true })
            .isDisabled(),
          true,
        );
        results.push({
          interaction:
            "proposal apply render compare history upload download model-unavailable",
          width,
          passed: true,
        });
      } finally {
        await c.context.close();
      }
    }
    await extraChecks(browser);
    await historyPaginationCheck(browser);
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(results, null, 2),
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

async function extraChecks(browser) {
  let c = await create(browser, 1440);
  try {
    const p = c.page;
    let release;
    const gate = new Promise((r) => (release = r));
    const bodies = [];
    await c.context.route("**/ai-edit/propose", async (route) => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) {
        await gate;
        return route.fulfill({
          status: 503,
          json: { message: "Service unavailable" },
        });
      }
      return route.fallback();
    });
    await p.locator("#studio-prompt").fill("Lower the original audio to 70%.");
    await p.locator("#studio-prompt").evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        }),
      ),
    );
    await p.waitForTimeout(100);
    assert.equal(bodies.length, 0);
    await p.getByRole("button", { name: "Send", exact: true }).click();
    await p.getByRole("button", { name: "Working…", exact: true }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Working…", exact: true })
        .isDisabled(),
      true,
    );
    release();
    await p.getByRole("button", { name: "Retry same submission" }).waitFor();
    assert.equal(
      await p.locator("#studio-prompt").inputValue(),
      "Lower the original audio to 70%.",
    );
    await record(c, "submission-error", 1440);
    await p.getByRole("button", { name: "Retry same submission" }).click();
    await p.waitForTimeout(400);
    assert.deepEqual(bodies[0], bodies[1]);
    assert.equal(bodies.length, 2);
    results.push({
      interaction:
        "IME duplicate-send gate preserves prompt and idempotent error retry",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
  c = await create(browser, 1440);
  try {
    const p = c.page;
    let added = false;
    const messages = Array.from({ length: 35 }, (_, i) => ({
      _id: "m" + i,
      role: i % 2 ? "assistant" : "user",
      content:
        "Conversation message " +
        i +
        " — We are reviewing the timing and audio of this clip. ".repeat(3),
    }));
    await c.context.route("**/ai-edit/sessions/*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            messages: [
              ...messages,
              ...(added
                ? [
                    {
                      _id: "new-message",
                      role: "assistant",
                      content: "Your newest suggestion is ready.",
                    },
                  ]
                : []),
            ],
          },
        },
      }),
    );
    await p.reload({ waitUntil: "networkidle" });
    await p.evaluate(() => document.documentElement.classList.add("dark"));
    await p.waitForTimeout(400);
    const log = p.getByRole("log", { name: "Editing conversation" });
    await log.evaluate((e) => {
      e.scrollTop = 0;
      e.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    added = true;
    await p.locator("#studio-prompt").fill("Lower the original audio to 70%.");
    await p.getByRole("button", { name: "Send", exact: true }).click();
    await p
      .getByRole("button", { name: "New messages", exact: true })
      .waitFor();
    assert.ok(await log.evaluate((e) => e.scrollTop < 10));
    await record(c, "reading-history", 1440);
    await p.getByRole("button", { name: "New messages", exact: true }).click();
    assert.ok(
      await log.evaluate(
        (e) => e.scrollHeight - e.scrollTop - e.clientHeight < 96,
      ),
    );
    results.push({
      interaction:
        "older-message reading is preserved; explicit latest-message navigation",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
  c = await create(browser, 1024, "free");
  try {
    assert.equal(
      await c.page.getByRole("combobox", { name: "AI model" }).count(),
      0,
    );
    await record(c, "free-auto", 1024);
    results.push({
      interaction: "free account has readonly automatic model routing",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
  c = await create(browser, 390);
  try {
    const p = c.page;
    c.state.failUpload = true;
    await p.locator("input[type=file]").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic png"),
    });
    await p
      .getByRole("button", { name: "Retry logo.png", exact: true })
      .waitFor();
    await record(c, "upload-failed", 390);
    await p
      .getByRole("button", { name: "Retry logo.png", exact: true })
      .click();
    await p.getByText("Validating", { exact: true }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "Send", exact: true }).isDisabled(),
      true,
    );
    c.state.validated = true;
    await p
      .getByRole("list", { name: "Prompt attachments" })
      .getByText("ready", { exact: true })
      .waitFor({ timeout: 12000 });
    await p
      .getByRole("button", { name: "Remove logo.png from prompt" })
      .click();
    const data = await p.evaluateHandle(() => {
      const d = new DataTransfer();
      d.items.add(new File(["file"], "wrong.jpg", { type: "image/jpeg" }));
      return d;
    });
    await p
      .getByRole("form", { name: "Editing prompt composer" })
      .dispatchEvent("drop", { dataTransfer: data });
    await data.dispose();
    await p.getByText(/Choose a PNG, MP3/).waitFor();
    results.push({
      interaction:
        "upload failure retry validation gating remove and unsupported drop",
      passed: true,
    });
    await p.setViewportSize({ width: 390, height: 500 });
    await p.locator("#studio-prompt").focus();
    await p
      .getByRole("button", { name: "Attach", exact: true })
      .scrollIntoViewIfNeeded();
    assert.ok(
      await p.getByRole("button", { name: "Attach", exact: true }).isVisible(),
    );
    await record(c, "keyboard-height", 390);
  } finally {
    await c.context.close();
  }
  c = await create(browser, 1440);
  try {
    const p = c.page;
    const { fixture } = require("./ui-audit-data.cjs");
    await c.context.route("**/ai-editor/plans/" + ids.plan, (route) => {
      const data = fixture(
        "/ai-editor/plans/" + ids.plan,
        "GET",
        null,
        "ready",
        { ...c.state, revision: 2 },
        4100,
      );
      return route.fulfill({ status: 200, json: data.data });
    });
    await p.reload({ waitUntil: "networkidle" });
    await p.evaluate(() => document.documentElement.classList.add("dark"));
    await p.waitForTimeout(400);
    assert.equal(
      await p
        .getByRole("button", { name: "Apply changes", exact: true })
        .isDisabled(),
      true,
    );
    await p.getByText(/older revision/).waitFor();
    await record(c, "stale-proposal", 1440);
    await p.getByRole("button", { name: "Reject", exact: true }).click();
    await p.getByText("Suggestion rejected", { exact: true }).waitFor();
    assert.equal(c.state.revision, 0);
    results.push({
      interaction: "stale proposal blocks apply and remains rejectable",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
  c = await create(browser, 1024);
  try {
    await c.page.setViewportSize({ width: 1024, height: 600 });
    await c.page.emulateMedia({ reducedMotion: "reduce" });
    await record(c, "short-viewport-reduced-motion", 1024);
    results.push({
      interaction: "short desktop viewport keeps composer available",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
}

async function historyPaginationCheck(browser) {
  const c = await create(browser, 1440);
  try {
    const p = c.page;
    c.state.rendered = true;
    const olderId = "888888888888888888888888";
    const versionRequests = [];
    c.context.on("request", (req) => {
      if (new URL(req.url()).pathname.startsWith("/ai-editor/versions/"))
        versionRequests.push(req.url());
    });
    await c.context.route("**/ai-editor/plans/*/versions?*", (route) => {
      const page = new URL(route.request().url()).searchParams.get("page");
      const item = {
        _id: ids.version,
        planId: ids.plan,
        revision: 0,
        status: "completed",
        createdAt: "2026-10-13T06:00:00Z",
      };
      const items =
        page === "2"
          ? [{ ...item, _id: olderId, revision: 9 }]
          : Array.from({ length: 25 }, (_, i) => ({
              ...item,
              _id: i ? String(i).padStart(24, "0") : ids.version,
            }));
      return route.fulfill({
        json: {
          success: true,
          data: { items, page: Number(page), pageSize: 25 },
        },
      });
    });
    await p.reload({ waitUntil: "networkidle" });
    await p.evaluate(() => document.documentElement.classList.add("dark"));
    await p.getByRole("tab", { name: "Edited preview", exact: true }).click();
    await p.getByRole("button", { name: "History", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: /Revision 9/ })
      .waitFor();
    await p.waitForTimeout(400);
    assert.equal(
      versionRequests.some((url) => url.includes(olderId)),
      false,
    );
    await record(c, "history-pagination", 1440);
    results.push({
      interaction: "history pagination does not select an unrelated preview",
      passed: true,
    });
  } finally {
    await c.context.close();
  }
}
