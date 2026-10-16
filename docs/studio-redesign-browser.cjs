/* Synthetic browser verification. Every API request is intercepted; no real records or providers. */
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
const out = path.join(__dirname, "studio-editor-checkpoint-evidence");
fs.mkdirSync(out, { recursive: true });
const results = [];
if (
  process.env.STUDIO_INTERACTIONS_ONLY &&
  fs.existsSync(path.join(out, "results.json"))
)
  results.push(
    ...JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8"))
      .layouts,
  );
async function open(browser, width = 1440, view = "workspace", options = {}) {
  const state = {
    view,
    revision: options.recover ? 1 : 0,
    proposalStatus: options.recover ? "applied" : "pending",
    rendered: false,
    renderRequests: [],
    applyRequests: 0,
    previewRevision: 0,
    complete: false,
    failRender: !!options.failRender,
    newSessions: 0,
  };
  const sessions = [
    {
      _id: ids.session,
      planId: ids.plan,
      title: "Opening zoom",
      status: "active",
    },
    {
      _id: "555555555555555555555555",
      planId: ids.plan,
      title: "Audio adjustments",
      status: "active",
    },
  ];
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultNavigationTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  const version = () => ({
    _id: ids.version,
    planId: ids.plan,
    revision: state.previewRevision,
    status: state.complete ? "completed" : "processing",
    phase: state.complete ? "completed" : "encoding",
    progress: state.complete ? 100 : 42,
    createdAt: "2026-10-15T08:00:00Z",
    outputUrl: state.complete
      ? "http://127.0.0.1:4100/auth/studio-preview.mp4"
      : undefined,
  });
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method();
    if (url.pathname === "/api/auth/session")
      return route.fulfill({
        json: {
          user,
          expires: "2099-01-01T00:00:00Z",
          accessToken: "synthetic-token",
        },
      });
    if (url.hostname === "127.0.0.1" && url.port === "4100")
      return route.continue();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    let body;
    try {
      body = req.postDataJSON();
    } catch {}
    const ok = (data) => ({ status: 200, data: { success: true, data } });
    let response;
    if (url.pathname === "/ai-editor/clips")
      response = ok({
        items: [
          {
            _id: ids.clip,
            jobId: ids.job,
            title: "Make room for your next idea",
            duration: 18,
            createdAt: "2026-10-15T08:00:00Z",
          },
        ],
        totalPages: 1,
        total: 1,
      });
    else if (url.pathname.endsWith("/ai-edit/sessions") && method === "GET")
      response = ok({ items: sessions.filter((s) => s.status === "active") });
    else if (url.pathname.endsWith("/ai-edit/sessions") && method === "POST") {
      const session = {
        _id: "666666666666666666666666",
        planId: ids.plan,
        title: "New conversation",
        status: "active",
      };
      sessions.push(session);
      state.newSessions++;
      response = ok(session);
    } else if (
      url.pathname.includes("/ai-edit/sessions/") &&
      method === "PATCH"
    ) {
      const s = sessions.find((s) => s._id === url.pathname.split("/").pop());
      Object.assign(s, body);
      response = ok(s);
    } else if (url.pathname.endsWith("/apply") && options.failApply) {
      state.applyRequests++;
      response = {
        status: 409,
        data: {
          success: false,
          error: { code: "CONFLICT", message: "Synthetic stale proposal" },
        },
      };
    } else if (url.pathname.endsWith("/preview")) {
      state.renderRequests.push(body);
      if (state.failRender) {
        state.failRender = false;
        response = {
          status: 503,
          data: {
            success: false,
            error: { code: "OFFLINE", message: "Synthetic queue outage" },
          },
        };
      } else {
        state.previewRevision = body.expectedRevision;
        state.rendered = true;
        response = ok(version());
      }
    } else if (url.pathname.endsWith("/versions"))
      response = ok({
        items: state.rendered ? [version()] : [],
        page: 1,
        pageSize: 25,
      });
    else if (url.pathname.startsWith("/ai-editor/versions/"))
      response = ok(version());
    else {
      response = fixture(url.pathname, method, body, "ready", state, 4100);
      const data = response.data?.data;
      if (options.marker && data?._id === ids.plan && data.plan)
        data.lastAppliedProposalId = ids.proposal;
      if (url.pathname.endsWith("/apply")) state.applyRequests++;
      if (url.pathname.endsWith("/apply") && options.noOp) {
        state.revision = 0;
        data.noChanges = true;
      }
      if (data && typeof data === "object") {
        if ("revision" in data) data.revision = state.revision + 1;
        if ("planId" in data && "baseRevision" in data) {
          data.baseRevision = 1;
          data.patch.baseRevision = 1;
          data.appliedRevision = data.status === "applied" ? 2 : undefined;
        }
        for (const p of data.proposals || []) {
          p.baseRevision = 1;
          p.patch.baseRevision = 1;
          p.appliedRevision = p.status === "applied" ? 2 : undefined;
          if (options.noOp) p.noChanges = true;
        }
        for (const p of data.items || [])
          if ("revision" in p) p.revision = state.revision + 1;
        if (options.marker && data.proposals) data.proposals = [];
        if (url.pathname.includes("/ai-edit/sessions/")) {
          const id = url.pathname.split("/").pop();
          data.session = sessions.find((s) => s._id === id);
          data.proposals = [];
          if (id !== ids.session) data.messages = [];
        }
        if (options.clarification) {
          for (const p of data.proposals || []) {
            p.status = "clarification";
            p.summary = "Which phrase or timestamp should I use?";
            delete p.patch;
          }
          for (const message of data.messages || [])
            if (message.role === "assistant") {
              message.proposalId = ids.proposal;
              message.content = "An older wording of this clarification";
            }
        }
      }
    }
    return route.fulfill({
      status: response.status,
      headers,
      contentType: "application/json",
      body: JSON.stringify(response.data)
        .replaceAll(
          "/auth/ui-audit-video.mp4",
          options.landscape
            ? "/auth/studio-landscape.mp4"
            : "/auth/studio-preview.mp4",
        )
        .replaceAll("http://localhost:4100", "http://127.0.0.1:4100"),
    });
  });
  await page.goto(`http://127.0.0.1:4100/auth/studio-preview?view=${view}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.addStyleTag({
    content: "nextjs-portal,.tsqd-parent-container{display:none!important}",
  });
  await page
    .getByRole("heading", {
      name: view === "listing" ? "AI Studio" : "Make room for your next idea",
      exact: true,
    })
    .waitFor();
  if (view !== "listing") {
    await page.locator("video").waitFor();
    await page.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
    );
  }
  return { page, context, state, errors, sessions };
}
async function record(c, label, width, theme) {
  await c.page.evaluate((theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, theme);
  await c.page.waitForTimeout(350);
  const geometry = await c.page.evaluate(() => {
    const rect = (selector) => {
      const e = document.querySelector(selector);
      if (!e || !e.getClientRects().length) return null;
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
      workspace: rect("[data-studio-workspace]"),
      composer: rect('[aria-label="Editing prompt composer"]'),
      canvas: rect(".studio-canvas"),
      player: rect('[data-controls-layout="docked"]'),
      video: rect("video"),
      chat: rect("#studio-view-chat"),
    };
  });
  assert.equal(geometry.documentWidth, width, `${label} ${width} overflow`);
  if (geometry.workspace)
    assert.ok(
      geometry.workspace.bottom <= geometry.height + 2,
      `${label} workspace overflow`,
    );
  if (geometry.composer)
    assert.ok(
      geometry.composer.bottom <= geometry.height + 2,
      `${label} composer overflow`,
    );
  if (geometry.video && geometry.player && geometry.canvas) {
    assert(geometry.video.height > 100, "Media must be prominent");
    assert(
      geometry.player.bottom <= geometry.canvas.bottom + 2,
      "Player fits the stage",
    );
    const controls = await c.page
      .locator('[data-controls-layout="docked"] > div')
      .last()
      .boundingBox();
    assert(
      controls.y >= geometry.video.bottom - 2,
      "Playback controls must not cover footage",
    );
  }
  assert.deepEqual(c.errors, [], `${label} errors`);
  await c.page.screenshot({
    path: path.join(out, `${label}-${width}-${theme}.png`),
    fullPage: true,
  });
  results.push({ label, theme, ...geometry });
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    for (const width of process.env.STUDIO_INTERACTIONS_ONLY
      ? []
      : [360, 390, 768, 1024, 1440, 1920]) {
      const c = await open(browser, width);
      await record(c, "preview", width, "light");
      if (width < 1280)
        await c.page.getByRole("tab", { name: "Chat", exact: true }).click();
      await c.page
        .getByLabel("Describe your editing instructions")
        .fill("Draft for the opening zoom");
      await record(c, "chat", width, "dark");
      await c.context.close();
      console.log(`layouts ${width} passed`);
    }
    const clarification = await open(browser, 1440, "workspace", {
      clarification: true,
    });
    const question = clarification.page.getByText(
      "Which phrase or timestamp should I use?",
      { exact: true },
    );
    await question.waitFor();
    assert.equal(await question.count(), 1);
    assert.equal(
      await clarification.page
        .getByText("An older wording of this clarification", { exact: true })
        .count(),
      0,
    );
    await clarification.page
      .getByLabel("Describe your editing instructions")
      .fill("Keep this draft");
    await clarification.page
      .getByRole("button", { name: "Answer in chat", exact: true })
      .click();
    assert.equal(
      await clarification.page
        .getByLabel("Describe your editing instructions")
        .inputValue(),
      "Keep this draft",
    );
    await record(clarification, "clarification", 1440, "dark");
    await clarification.context.close();
    const landscape = await open(browser, 1440, "workspace", {
      landscape: true,
    });
    const dimensions = await landscape.page.locator("video").evaluate((v) => ({
      width: v.videoWidth,
      height: v.videoHeight,
      frame: v.getBoundingClientRect().width / v.getBoundingClientRect().height,
    }));
    assert(Math.abs(dimensions.width / dimensions.height - 16 / 9) < 0.01);
    assert(Math.abs(dimensions.frame - 16 / 9) < 0.01);
    await record(landscape, "landscape", 1440, "light");
    await landscape.page.setViewportSize({ width: 1440, height: 650 });
    await record(landscape, "short-height", 1440, "dark");
    await landscape.context.close();
    const c = await open(browser, 1440);
    await c.page
      .getByLabel("Describe your editing instructions")
      .fill("Keep this draft");
    await c.page
      .getByRole("button", { name: "Audio adjustments", exact: true })
      .click();
    await c.page
      .getByLabel("Describe your editing instructions")
      .fill("A separate audio draft");
    await c.page
      .getByRole("button", { name: "Opening zoom", exact: true })
      .click();
    assert.equal(
      await c.page
        .getByLabel("Describe your editing instructions")
        .inputValue(),
      "Keep this draft",
    );
    await c.page.reload({ waitUntil: "networkidle" });
    await c.page.waitForFunction(
      () =>
        document.querySelector("#studio-prompt")?.value === "Keep this draft",
    );
    assert.equal(
      await c.page
        .getByLabel("Describe your editing instructions")
        .inputValue(),
      "Keep this draft",
    );
    await c.page
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    await c.page.getByText("42%", { exact: false }).waitFor();
    assert.equal(c.state.applyRequests, 1);
    assert.deepEqual(c.state.renderRequests, [{ expectedRevision: 2 }]);
    c.state.complete = true;
    await c.page
      .getByRole("tab", { name: "Edited preview", exact: true })
      .waitFor();
    await c.page.waitForFunction(() =>
      Array.from(document.querySelectorAll('[role="tab"]')).some(
        (el) =>
          el.getAttribute("aria-selected") === "true" &&
          el.textContent === "Edited preview",
      ),
    );
    assert.equal(c.state.renderRequests.length, 1);
    await c.page.getByRole("button", { name: "New chat", exact: true }).click();
    await c.page
      .getByRole("button", { name: "New conversation", exact: true })
      .waitFor();
    assert.equal(c.state.newSessions, 1);
    assert.equal(c.state.applyRequests, 1);
    assert.deepEqual(c.errors, []);
    await c.context.close();
    console.log(
      "drafts, refresh, sessions, apply → progress → completed preview passed",
    );
    const failure = await open(browser, 1440, "workspace", {
      failRender: true,
    });
    await failure.page
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    await failure.page
      .getByRole("button", { name: "Retry render", exact: true })
      .click();
    await failure.page.getByText("42%", { exact: false }).waitFor();
    assert.equal(failure.state.applyRequests, 1);
    assert.equal(failure.state.renderRequests.length, 2);
    await failure.context.close();
    console.log(
      "saved edit with failed render request retries without reapply passed",
    );
    for (const scenario of [{ failApply: true }, { noOp: true }]) {
      const safe = await open(browser, 1440, "workspace", scenario);
      await safe.page
        .getByRole("button", { name: "Apply changes", exact: true })
        .click();
      await safe.page.waitForTimeout(700);
      assert.equal(safe.state.renderRequests.length, 0);
      assert.equal(safe.state.applyRequests, 1);
      await safe.context.close();
    }
    const recovered = await open(browser, 1440, "workspace", {
      recover: true,
      marker: true,
    });
    await recovered.page.getByText("42%", { exact: false }).waitFor();
    assert.deepEqual(recovered.state.renderRequests, [{ expectedRevision: 2 }]);
    await recovered.page.reload({ waitUntil: "networkidle" });
    assert.equal(recovered.state.renderRequests.length, 1);
    assert.equal(recovered.state.applyRequests, 0);
    await recovered.context.close();
    const stale = await open(browser, 1440, "workspace", { recover: true });
    await stale.page.getByText("42%", { exact: false }).waitFor();
    stale.state.previewRevision = 1;
    stale.state.complete = true;
    await stale.page.waitForTimeout(3100);
    assert.equal(
      await stale.page
        .getByRole("tab", { name: "Original", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await stale.context.close();
    const mobile = await open(browser, 390);
    await mobile.page
      .getByRole("tab", { name: "Preview", exact: true })
      .focus();
    await mobile.page.keyboard.press("ArrowRight");
    const input = mobile.page.getByLabel("Describe your editing instructions");
    await input.fill("Lower audio volume");
    await input.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });
    assert.equal(mobile.state.promptPayload, undefined);
    await input.press("Shift+Enter");
    assert.match(await input.inputValue(), /\n/);
    await input.press("Enter");
    await mobile.page.waitForFunction(
      () => document.querySelector("#studio-prompt")?.value === "",
    );
    assert.equal(mobile.state.renderRequests.length, 0);
    assert.equal(mobile.state.promptPayload.prompt, "Lower audio volume");
    await mobile.page
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    assert.equal(mobile.state.renderRequests.length, 0);
    await mobile.page
      .getByRole("button", { name: "Open conversations", exact: true })
      .click();
    await mobile.page
      .getByRole("dialog")
      .getByRole("button", { name: "Audio adjustments", exact: true })
      .click();
    await mobile.page
      .getByRole("button", { name: "Open conversations", exact: true })
      .click();
    await mobile.page
      .getByRole("dialog")
      .getByRole("button", {
        name: "Actions for Audio adjustments",
        exact: true,
      })
      .click();
    await mobile.page
      .getByRole("button", { name: "Rename", exact: true })
      .click();
    await mobile.page
      .getByLabel("Conversation title")
      .fill("Quieter original audio");
    await mobile.page
      .getByRole("button", { name: "Save name", exact: true })
      .click();
    await mobile.page
      .getByRole("button", { name: "Quieter original audio", exact: true })
      .waitFor();
    await mobile.page
      .getByRole("button", {
        name: "Actions for Quieter original audio",
        exact: true,
      })
      .click();
    await mobile.page
      .getByRole("button", { name: "Archive conversation", exact: true })
      .click();
    await mobile.page
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    await mobile.page
      .getByRole("button", { name: "Quieter original audio", exact: true })
      .waitFor({ state: "detached" });
    assert.equal(mobile.state.applyRequests, 0);
    await mobile.context.close();
    console.log(
      "failed/no-op applies, refresh recovery, IME, keyboard tabs, mobile sessions, rename and archive passed",
    );
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(
        {
          layouts: results,
          interactions: [
            "draft preservation",
            "session switching",
            "refresh restoration",
            "new chat shares plan",
            "automatic rendering",
            "encoding progress",
            "completion switches preview",
            "render retry without reapply",
            "no render after failed or no-op apply",
            "refresh recovers apply-render gap without reapply",
            "IME-safe Enter and Shift+Enter",
            "keyboard tabs and mobile session drawer",
            "rename and archive preserve the shared plan",
            "older completed renders do not replace the current preview",
            "rejected proposals do not render",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
