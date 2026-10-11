/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser verification harness. */
// Real Chrome UI with isolated synthetic HTTP/session/R2 transport; no production mutations.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { fixture, user, ids } = require("./ui-audit-data.cjs");
const { chromium } = require(
  path.join(
    process.env.UI_AUDIT_NODE_MODULES ||
      "C:/Users/Shavaiz Ali/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
    "playwright",
  ),
);
const out = path.join(__dirname, "ai-native-evidence");
fs.mkdirSync(out, { recursive: true });
const results = [];
async function open(browser, view, width, scenario = "ready") {
  const state = {
    view,
    revision: 0,
    proposalStatus: "pending",
    rendered: false,
    validated: false,
    uploads: 0,
  };
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const envelope = (data) => ({ status: 200, data: { success: true, data } });
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/ui-audit-video.mp4")) {
      const video = fs.readFileSync(
        path.join(__dirname, "../apps/app/public/ui-audit-video.mp4"),
      );
      const range = req.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end =
        range && range[2]
          ? Math.min(Number(range[2]), video.length - 1)
          : video.length - 1;
      return route.fulfill({
        status: range ? 206 : 200,
        contentType: "video/mp4",
        headers: {
          "accept-ranges": "bytes",
          ...(range
            ? { "content-range": `bytes ${start}-${end}/${video.length}` }
            : {}),
          ...(url.searchParams.has("download")
            ? { "content-disposition": "attachment; filename=preview.mp4" }
            : {}),
        },
        body: video.subarray(start, end + 1),
      });
    }
    if (url.pathname === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { ...user, plan: scenario === "free" ? "free" : user.plan },
          expires: "2099-01-01T00:00:00Z",
          accessToken: "fake-ui-token",
        },
      });
    if (url.hostname === "localhost" && url.port === "4100")
      return route.continue();
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (url.hostname === "upload.example.test") {
      if (state.failUpload) {
        state.failUpload = false;
        return route.fulfill({
          status: 503,
          headers: { "access-control-allow-origin": "*" },
          body: "Upload unavailable",
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*" },
        body: "",
      });
    }
    let body;
    try {
      body = req.postDataJSON();
    } catch {}
    let response = fixture(
      url.pathname,
      req.method(),
      body,
      scenario === "free" ? "ready" : scenario,
      state,
      4100,
    );
    if (url.pathname === "/studio/projects")
      response = envelope([
        { id: "555555555555555555555555", name: "AI Studio assets" },
      ]);
    else if (url.pathname.endsWith("/assets/upload")) {
      state.uploads++;
      state.uploadBody = body;
      response = envelope({
        assetId: "66666666-6666-4666-8666-666666666666",
        uploadUrl: "https://upload.example.test/file",
      });
    } else if (url.pathname.endsWith("/assets/complete"))
      response = envelope({ assetId: body.assetId, status: "processing" });
    else if (
      url.pathname.endsWith("/assets") &&
      url.pathname.startsWith("/studio/projects/")
    )
      response = envelope([
        {
          id: "66666666-6666-4666-8666-666666666666",
          name: state.uploadBody?.name,
          status: state.validated ? "ready" : "processing",
        },
      ]);
    if (scenario === "free") {
      if (url.pathname === "/users/me") response.data.data.plan = "free";
      if (url.pathname.includes("/ai/models/available")) {
        response.data.data.selectionAllowed = false;
        response.data.data.plan = "free";
      }
    }
    if (url.pathname === "/ai-editor/plans" && response.data?.data?.items)
      for (const p of response.data.data.items) {
        p.clipTitle = "Make room for your next idea";
        p.sourceTitle = "Creative habits";
      }
    if (scenario === "empty" && response.data?.data) {
      if (url.pathname === "/jobs")
        response = envelope({ jobs: [], page: 1, total: 0, totalPages: 1 });
      if (url.pathname === "/ai-editor/plans")
        response = envelope({ items: [] });
      if (url.pathname.endsWith("/ai-edit/state"))
        response = envelope({ session: null, proposals: [] });
      if (url.pathname.includes("/ai-edit/sessions/"))
        response = envelope({ messages: [] });
    }
    if (url.pathname === "/jobs" && response.data?.data?.jobs)
      response.data.data.totalPages = scenario === "empty" ? 1 : 2;
    return route.fulfill({
      status: response.status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(response.data),
    });
  });
  await page.goto("http://localhost:4100/auth/ui-audit?view=" + view, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(400);
  return { page, context, state, errors };
}
async function record(ctx, label, width, screenshot = true) {
  const geometry = await ctx.page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    composer: (() => {
      const e = document.querySelector(
        '[aria-label="Editing prompt composer"]',
      );
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })(),
  }));
  assert.equal(geometry.documentWidth, width, label + " overflow");
  assert.deepEqual(ctx.errors, [], label + " JS errors");
  if (screenshot)
    await ctx.page.screenshot({
      path: path.join(out, label + "-" + width + ".png"),
      fullPage: true,
    });
  results.push({ label, width, ...geometry, pageErrors: ctx.errors });
  console.log(label + " " + width + " passed");
}
async function check(name, fn) {
  if (process.env.AI_NATIVE_ONLY_RENDER && !name.startsWith("proposal apply"))
    return;
  await fn();
  results.push({ interaction: name, passed: true });
  console.log(name + " passed");
}
module.exports = { open, record };
if (require.main === module)
  (async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    });
    try {
      for (const view of process.env.AI_NATIVE_INTERACTIONS_ONLY
        ? []
        : ["dashboard", "studio", "workspace"])
        for (const width of [375, 640, 768, 1024, 1280, 1440, 1920]) {
          const ctx = await open(browser, view, width);
          try {
            await record(ctx, view, width);
            if (view === "workspace") {
              assert.equal(
                await ctx.page.locator("video[controls]").count(),
                0,
              );
              assert.ok(
                await ctx.page
                  .getByRole("tab", { name: "Original", exact: true })
                  .count(),
              );
            }
          } finally {
            await ctx.context.close();
          }
        }
      await check(
        "generation custom prompt persistence and credit authorization",
        async () => {
          const c = await open(browser, "dashboard", 375);
          try {
            const p = c.page;
            await p
              .locator("#video-url-input")
              .fill("https://youtube.com/watch?v=example");
            await p.getByRole("combobox", { name: "Highlight style" }).click();
            await p.getByRole("option", { name: /Meme/ }).click();
            await p.getByRole("combobox", { name: "AI model" }).click();
            await p.getByRole("option", { name: /Creator model/ }).click();
            await p.getByRole("button", { name: /Customize/ }).click();
            await p
              .locator("#custom-focus-instructions")
              .fill("Find practical advice. Avoid introductions.");
            await record(c, "customize", 375);
            await p.getByRole("button", { name: "Done", exact: true }).click();
            await p.getByRole("button", { name: /Customize/ }).click();
            assert.equal(
              await p.locator("#custom-focus-instructions").inputValue(),
              "Find practical advice. Avoid introductions.",
            );
            await p.getByRole("button", { name: "Done", exact: true }).click();
            await p
              .getByRole("button", { name: "Review & Generate", exact: true })
              .click();
            await p.getByRole("dialog").waitFor();
            await record(c, "credit-review", 375);
            await p.getByRole("button", { name: /Generate clips/ }).click();
            await p.waitForTimeout(500);
            assert.equal(c.state.jobsPayload.stylePreset, "meme");
            assert.equal(c.state.jobsPayload.modelId, ids.model);
            assert.equal(
              c.state.jobsPayload.customPrompt,
              "Find practical advice. Avoid introductions.",
            );
            assert.equal(c.state.jobsPayload.authorizedCredits, 5);
          } finally {
            await c.context.close();
          }
        },
      );
      await check("free style and model gating", async () => {
        const c = await open(browser, "dashboard", 375, "free");
        try {
          await c.page
            .getByRole("combobox", { name: "Highlight style" })
            .click();
          assert.equal(
            await c.page
              .getByRole("option", { name: /Meme/ })
              .getAttribute("aria-disabled"),
            "true",
          );
          await c.page.keyboard.press("Escape");
          assert.equal(
            await c.page.getByRole("combobox", { name: "AI model" }).count(),
            0,
          );
          await record(c, "free-composer", 375);
        } finally {
          await c.context.close();
        }
      });
      await check(
        "landing scoped search clear filters pagination and real links",
        async () => {
          const c = await open(browser, "studio", 1440);
          try {
            const p = c.page;
            assert.ok(
              await p
                .getByRole("link", { name: "Continue editing", exact: true })
                .count(),
            );
            assert.ok(
              await p
                .getByRole("link", { name: "Edit with AI", exact: true })
                .count(),
            );
            await p
              .getByRole("textbox", { name: "Search clip titles on this page" })
              .fill("missing-title");
            await p.getByText("No matching clips on this page").waitFor();
            await p.getByRole("button", { name: "Clear filters" }).click();
            await p.getByRole("button", { name: "Next", exact: true }).click();
            await p.getByText("Page 2 of 2").waitFor();
            await record(c, "landing-page2", 1440);
          } finally {
            await c.context.close();
          }
        },
      );
      await check(
        "selected library attachment structured context and removal",
        async () => {
          const c = await open(browser, "workspace", 1440);
          try {
            const p = c.page;
            await p
              .getByRole("button", { name: "Attach", exact: true })
              .click();
            await p
              .getByRole("button", { name: "Choose from your assets" })
              .click();
            await p.getByRole("button", { name: /Opening brand mark/ }).click();
            await p
              .getByRole("button", { name: /Remove Opening brand mark/ })
              .click();
            assert.equal(
              await p.getByRole("list", { name: "Prompt attachments" }).count(),
              0,
            );
            await p.getByRole("tab", { name: "Your assets" }).click();
            await p.getByRole("button", { name: /Opening brand mark/ }).click();
            await p
              .locator("#studio-prompt")
              .fill("Add my image in the opening.");
            await p.locator("#studio-prompt").press("Shift+Enter");
            assert.match(await p.locator("#studio-prompt").inputValue(), /\n$/);
            await p.locator("#studio-prompt").press("Enter");
            await p.waitForTimeout(600);
            assert.deepEqual(c.state.promptPayload.selectedAssetIds, [
              "asset-1",
            ]);
            assert.equal(c.state.rendered, false);
            await record(c, "attached-proposal", 1440);
          } finally {
            await c.context.close();
          }
        },
      );
      await check(
        "upload failure retry validation gate and structured IDs",
        async () => {
          const c = await open(browser, "workspace", 375);
          try {
            const p = c.page;
            c.state.failUpload = true;
            await p.locator("#studio-prompt").fill("Use my attached image.");
            await p.getByLabel("Upload editing media").setInputFiles({
              name: "logo.png",
              mimeType: "image/png",
              buffer: Buffer.from("synthetic PNG upload transport"),
            });
            await p.getByRole("button", { name: "Retry logo.png" }).waitFor();
            assert.equal(
              await p
                .getByRole("button", { name: "Send", exact: true })
                .isDisabled(),
              true,
            );
            await record(c, "upload-failed", 375);
            await p.getByRole("button", { name: "Retry logo.png" }).click();
            await p.getByText("Validating", { exact: true }).waitFor();
            assert.equal(
              await p
                .getByRole("button", { name: "Send", exact: true })
                .isDisabled(),
              true,
            );
            await record(c, "upload-validating", 375);
            c.state.validated = true;
            await p
              .getByRole("list", { name: "Prompt attachments" })
              .getByText("ready", { exact: true })
              .waitFor();
            await p.getByRole("button", { name: "Send", exact: true }).click();
            await p.waitForTimeout(500);
            assert.deepEqual(c.state.promptPayload.selectedAssetIds, [
              "66666666-6666-4666-8666-666666666666",
            ]);
            assert.equal(c.state.uploadBody.mimeType, "image/png");
            assert.equal(c.state.rendered, false);
          } finally {
            await c.context.close();
          }
        },
      );
      await check(
        "drag and drop rejects JPEG and validates audio",
        async () => {
          const c = await open(browser, "workspace", 1440);
          try {
            const p = c.page;
            async function drop(name, type) {
              const data = await p.evaluateHandle(
                ({ name, type }) => {
                  const d = new DataTransfer();
                  d.items.add(new File(["synthetic media"], name, { type }));
                  return d;
                },
                { name, type },
              );
              await p
                .getByRole("form", { name: "Editing prompt composer" })
                .dispatchEvent("drop", { dataTransfer: data });
              await data.dispose();
            }
            await drop("wrong.jpg", "image/jpeg");
            await p.getByText(/Choose a PNG, MP3/).waitFor();
            await drop("music.wav", "audio/wav");
            await p.getByText("Validating", { exact: true }).waitFor();
            c.state.validated = true;
            await p
              .getByRole("list", { name: "Prompt attachments" })
              .getByText("ready", { exact: true })
              .waitFor();
            assert.equal(c.state.uploadBody.mimeType, "audio/wav");
            await record(c, "dropped-audio", 1440);
          } finally {
            await c.context.close();
          }
        },
      );
      await check(
        "proposal apply explicit render playback history and download",
        async () => {
          const c = await open(browser, "workspace", 1440);
          try {
            const p = c.page;
            await p.getByRole("button", { name: "Apply changes" }).click();
            await p.getByText("Changes applied", { exact: true }).waitFor();
            assert.equal(c.state.rendered, false);
            await p
              .getByRole("button", { name: "Render preview", exact: true })
              .click();
            await p.getByText("Preview ready", { exact: true }).waitFor();
            await p.waitForFunction(
              () => document.querySelector("video")?.readyState >= 2,
            );
            await p.getByRole("tab", { name: "Original", exact: true }).click();
            await p
              .getByRole("tab", { name: "Edited preview", exact: true })
              .click();
            await p
              .getByRole("tab", { name: "Preview history", exact: true })
              .click();
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
            await p.getByRole("slider", { name: "Video position" }).focus();
            await p.keyboard.press("Home");
            await p.waitForFunction(
              () => document.querySelector("video")?.currentTime < 0.1,
            );
            await p.keyboard.press("ArrowRight");
            await p.waitForFunction(() => {
              const v = document.querySelector("video");
              return v && v.currentTime >= 0.9 && v.currentTime <= 1.1;
            });
            assert.ok(
              await p
                .locator("video")
                .evaluate((v) => v.currentTime >= 0.9 && v.currentTime <= 1.1),
            );
            await p
              .getByRole("button", { name: "Enter fullscreen", exact: true })
              .click();
            await p.waitForFunction(() => !!document.fullscreenElement);
            await p
              .getByRole("button", { name: "Exit fullscreen", exact: true })
              .click();
            await record(c, "rendered-preview", 1440);
            const download = p.waitForEvent("download");
            await p
              .getByRole("button", { name: "Download preview", exact: true })
              .click();
            assert.ok((await download).suggestedFilename().endsWith(".mp4"));
          } finally {
            await c.context.close();
          }
        },
      );
      if (!process.env.AI_NATIVE_ONLY_RENDER) {
        await check("proposal rejection and follow-up prompt", async () => {
          const c = await open(browser, "workspace", 375);
          try {
            await c.page
              .getByRole("button", { name: "Reject", exact: true })
              .click();
            await c.page.getByText("rejected", { exact: true }).waitFor();
            assert.equal(c.state.revision, 0);
            await c.page
              .locator("#studio-prompt")
              .fill("Lower the original audio to 70%.");
            await c.page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await c.page.waitForTimeout(500);
            assert.equal(c.state.promptPayload.sessionId, ids.session);
            assert.equal(c.state.rendered, false);
          } finally {
            await c.context.close();
          }
        });
        for (const view of ["studio", "workspace"]) {
          const c = await open(browser, view, 375, "empty");
          try {
            await record(c, view + "-empty", 375);
            if (view === "studio")
              assert.equal(
                await c.page
                  .getByRole("heading", { name: "Continue editing" })
                  .count(),
                0,
              );
          } finally {
            await c.context.close();
          }
        }
      }
      await check("existing clip media stage keyboard regression", async () => {
        const c = await open(browser, "clip-detail", 1440);
        try {
          const p = c.page;
          await p.getByRole("button", { name: /Watch Make room/ }).click();
          const player = p.getByRole("region", { name: "Clip player" });
          await player.waitFor();
          await p.waitForFunction(
            () => document.querySelector("video")?.readyState >= 2,
          );
          if (
            await p
              .getByRole("button", { name: "Pause video", exact: true })
              .count()
          )
            await p
              .getByRole("button", { name: "Pause video", exact: true })
              .click();
          await p.waitForFunction(
            () => document.querySelector("video")?.paused === true,
          );
          await player.focus();
          await p.keyboard.press("Space");
          await p.waitForFunction(
            () => document.querySelector("video")?.paused === false,
          );
          await record(c, "existing-clip-player", 1440);
        } finally {
          await c.context.close();
        }
      });
      for (const view of ["dashboard", "workspace"])
        for (const width of [375, 1440]) {
          const c = await open(browser, view, width, "offline");
          try {
            await record(c, view + "-offline", width);
          } finally {
            await c.context.close();
          }
        }
      const dark = await open(browser, "workspace", 1440);
      try {
        await dark.page.evaluate(() =>
          document.documentElement.classList.add("dark"),
        );
        await record(dark, "workspace-dark", 1440);
      } finally {
        await dark.context.close();
      }
    } finally {
      await browser.close();
      fs.writeFileSync(
        path.join(out, "results.json"),
        JSON.stringify(results, null, 2),
      );
    }
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
