import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { encode } from "next-auth/jwt";
const root = path.resolve(import.meta.dirname, "../../..");
const runtime = process.env.STUDIO_PLAYWRIGHT_PATH;
if (!runtime)
  throw new Error(
    "Set STUDIO_PLAYWRIGHT_PATH to an installed playwright package.",
  );
const require = createRequire(import.meta.url);
const { chromium } = require(runtime);
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const port = probe.address().port;
    probe.close((error) => (error ? reject(error) : resolve(port)));
  });
});
const origin = `http://localhost:${port}`;
const secret = "studio-workspace-test-only-secret-32-characters";
const log = fs.createWriteStream(
  path.join(root, ".test-results/studio-workspace.log"),
);
const server = spawn(
  process.execPath,
  [
    path.join(root, "apps/studio/node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "-p",
    String(port),
  ],
  {
    cwd: path.join(root, "apps/studio"),
    windowsHide: true,
    env: {
      ...process.env,
      CENTRAL_AUTH_ENABLED: "false",
      AUTH_COOKIE_DOMAIN: "",
      AUTH_SECRET: secret,
      AUTH_TRUST_HOST: "true",
      NEXTAUTH_URL: origin,
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:59999",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.pipe(log);
server.stderr.pipe(log);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null)
      throw new Error("Next test server exited before readiness");
    try {
      await fetch(`${origin}/api/auth/session`);
      ready = true;
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Next dev server did not start");
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.STUDIO_CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const token = await encode({
    token: {
      id: "alice",
      name: "Studio tester",
      email: "studio@example.invalid",
      role: "user",
      accessToken: "synthetic-test-token",
    },
    secret,
    salt: "authjs.session-token",
  });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const asset = {
    id: "image-1",
    name: "Workspace test image",
    kind: "image",
    duration: 5,
    origin: "Upload",
    status: "ready",
    src: `${origin}/test-media.svg`,
  };
  const clip = {
    id: "clip-1",
    assetId: asset.id,
    name: asset.name,
    kind: "image",
    trackId: "video",
    start: 0,
    duration: 5,
    offset: 0,
    opacity: 100,
    scale: 100,
    rotation: 0,
    volume: 80,
    speed: 1,
    x: 0,
    y: 0,
    fontSize: 34,
    color: "#ffffff",
    fadeIn: 0,
    fadeOut: 0,
    fit: "contain",
  };
  let project = {
    id: "507f1f77bcf86cd799439011",
    name: "Workspace integration test",
    ratio: "16:9",
    updatedAt: new Date().toISOString(),
    revision: 0,
    version: 1,
    demo: false,
    assets: [asset],
    clips: [clip],
    tracks: [
      { id: "text", name: "Text 1", kind: "text", muted: false, hidden: false },
      {
        id: "video",
        name: "Video 1",
        kind: "video",
        muted: false,
        hidden: false,
      },
      {
        id: "audio",
        name: "Audio 1",
        kind: "audio",
        muted: false,
        hidden: false,
      },
    ],
  };
  await page.route("**/api/session-check", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.route("**/test-media.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#193f47"/><circle cx="800" cy="300" r="160" fill="#608b80"/><text x="100" y="550" font-family="Arial" font-size="70" fill="white">Blynta workspace test</text></svg>',
    }),
  );
  await page.route("**/api/studio/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith("/timeline")) {
      const input = route.request().postDataJSON();
      if (input.revision !== project.revision)
        return route.fulfill({
          status: 409,
          json: { success: false, error: { message: "Project changed" } },
        });
      project = {
        ...project,
        ...input.document,
        revision: project.revision + 1,
      };
      return route.fulfill({
        json: { success: true, data: { revision: project.revision } },
      });
    }
    if (url.pathname.endsWith("/ai/propose"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: "proposal",
            prompt: "Make this 9:16",
            actions: [{ type: "ratio", ratio: "9:16" }],
            descriptions: ["Convert canvas to 9:16"],
            applied: false,
          },
        },
      });
    if (url.pathname.endsWith("/renders") && method === "POST")
      return route.fulfill({
        json: {
          success: true,
          data: { id: "render-1", status: "queued", progress: 0 },
        },
      });
    if (url.pathname.includes("/renders/"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: "render-1",
            status: "completed",
            progress: 100,
            outputUrl: `${origin}/video.mp4`,
          },
        },
      });
    return route.fulfill({
      json: {
        success: true,
        data: url.pathname.endsWith("/assets")
          ? [asset]
          : url.pathname.endsWith("/projects")
            ? [project]
            : project,
      },
    });
  });
  await page.goto(`${origin}/editor/${project.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.locator(".editor-shell").waitFor();
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  const geometry = async () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return {
        preview: rect(".preview-area"),
        timeline: rect(".timeline-area"),
        rail: rect(".tool-rail"),
        context: rect(".tool-panel"),
        right: rect(".right-workspace"),
        frame: rect(".preview-frame"),
      };
    });
  await page.screenshot({
    animations: "disabled",
    path: path.join(root, ".test-results/studio-editor-initial.png"),
  });
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    true,
  );
  assert.equal(
    await page
      .locator('.tool-panel [data-slot="tabs-list"]')
      .first()
      .getAttribute("data-variant"),
    "default",
  );
  let bounds = await geometry();
  assert.equal(bounds.timeline.w, 1440);
  assert.ok(
    bounds.preview.w >= 1000 && bounds.frame.w > 500,
    JSON.stringify(bounds),
  );
  assert.ok(bounds.timeline.h >= 280 && bounds.timeline.h <= 380);
  assert.equal(bounds.rail.w, 72);
  assert.equal(await page.locator(".property-rail").count(), 0);
  assert.equal(await page.locator(".right-workspace").isVisible(), false);
  // Selection opens a contextual inspector. AI replaces it and returns it on close.
  await page.locator(".timeline-clip").first().click();
  await page.getByText("Clip inspector", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Image", exact: true }).waitFor();
  bounds = await geometry();
  assert.equal(bounds.right.w, 300);
  // Playback and seeking update the transport without losing editing commands.
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Pause video", exact: true }).click();
  assert.ok(
    Number(
      await page
        .getByRole("slider", { name: "Timeline playhead", exact: true })
        .getAttribute("aria-valuenow"),
    ) > 0,
  );
  await page
    .getByRole("button", { name: "Split clip at playhead", exact: true })
    .click();
  assert.equal(await page.locator(".timeline-clip").count(), 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".timeline-clip").count(), 1);
  await page.locator(".timeline-clip").first().focus();
  await page.keyboard.press("Delete");
  assert.equal(await page.locator(".timeline-clip").count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".timeline-clip").count(), 1);
  await page
    .getByRole("slider", { name: "Timeline playhead", exact: true })
    .press("Home");
  await page.locator(".timeline-clip").first().click();

  await page
    .getByRole("button", { name: "Open Blynta AI chat", exact: true })
    .click();
  await page.getByText("What should we edit?").waitFor();
  assert.equal(await page.locator(".inspector-task").isVisible(), false);
  bounds = await geometry();
  assert.equal(bounds.right.w, 400);
  await page
    .getByRole("button", { name: "Make this 9:16", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply 1 edit" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".preview-frame").style.aspectRatio === "9 / 16",
  );
  bounds = await geometry();
  assert.ok(Math.abs(bounds.frame.w / bounds.frame.h - 9 / 16) < 0.01);
  await page.getByRole("button", { name: "Undo changes" }).click();
  await page.getByRole("button", { name: "Close Blynta AI" }).click();
  assert.equal(await page.locator(".inspector-task").isVisible(), true);
  // Both side panels can be collapsed to reclaim all center space.
  await page.getByRole("button", { name: "Toggle media panel" }).click();
  await page.getByRole("button", { name: "Close properties panel" }).click();
  bounds = await geometry();
  assert.ok(bounds.preview.w >= 1360);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  assert.equal(await page.locator(".timeline-clip").count(), 2);
  await page.locator(".timeline-clip.clip-text").click();
  await page.getByRole("tab", { name: "Text", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("tab", { name: "Audio", exact: true }).count(),
    0,
  );
  const name = page.getByRole("textbox", { name: "Project name", exact: true });
  await name.fill("Saved from workspace test");
  await name.press("Control+k");
  assert.equal(
    await page.locator(".ai-chat").isVisible(),
    false,
    "AI shortcut must be ignored in a text input",
  );
  await page.waitForTimeout(1100);
  assert.equal(project.name, "Saved from workspace test");
  // Resizing is local and must not save the project.
  const revisionBeforeResize = project.revision;
  const mediaResize = page.getByRole("separator", {
    name: "Resize media panel",
  });
  const handle = await mediaResize.boundingBox();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 20,
    handle.y + handle.height / 2,
    { steps: 4 },
  );
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector(".editor-shell")
        .style.getPropertyValue("--media-width"),
    ),
    "320px",
  );
  await page.mouse.up();

  const divider = page.getByRole("separator", { name: "Resize timeline" });
  await divider.focus();
  await divider.press("ArrowUp");
  await page.waitForTimeout(900);
  assert.equal(project.revision, revisionBeforeResize);
  bounds = await geometry();
  assert.ok(bounds.timeline.h > 324);
  const savedHeight = JSON.parse(
    await page.evaluate(() =>
      localStorage.getItem("blynta-studio:workspace:v5"),
    ),
  ).timelineHeight;
  await page.reload();
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  bounds = await geometry();
  assert.equal(bounds.timeline.h, savedHeight);
  // Preserve source fit when canvas ratios change.
  assert.equal(
    await page
      .locator(".preview-media")
      .first()
      .evaluate((element) => getComputedStyle(element).objectFit),
    "contain",
  );
  await page
    .getByRole("button", { name: "Show all tracks", exact: true })
    .click();
  assert.equal(await page.locator(".track-header").count(), 3);
  for (const width of [2560, 1920, 1600, 1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    await page.locator(".timeline-clip.clip-image").click();
    await page
      .getByRole("button", { name: "Open Blynta AI chat", exact: true })
      .click();
    bounds = await geometry();
    assert.equal(bounds.timeline.w, width);
    assert.equal(bounds.right.w, 400);
    assert.ok(bounds.preview.w >= 460, `${width}: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.frame.w > 180 && bounds.frame.h > 150);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      animations: "disabled",
      path: path.join(root, `.test-results/studio-editor-${width}.png`),
    });
    await page.getByRole("button", { name: "Close Blynta AI" }).click();
  }
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Close properties panel" }).click();
  bounds = await geometry();
  assert.ok(bounds.preview.w >= 900);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  assert.ok(await page.locator(".tool-panel").isVisible());
  await page.screenshot({
    animations: "disabled",
    path: path.join(root, ".test-results/studio-editor-1000.png"),
  });
  await page.getByRole("button", { name: "Collapse contextual panel" }).click();
  await page
    .getByRole("button", { name: "Export project", exact: true })
    .click();
  await page.getByRole("button", { name: "Export video", exact: true }).click();
  await page.getByRole("link", { name: "Download video" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Workspace browser checks passed: desktop widths 2560/1920/1600/1440/1280/1000, contextual inspector, alternate AI dock, collapse, resizing persistence without autosave, aspect ratio/source fit, clip history, input shortcut safety, autosave and export UI. API transport is mocked in this UI suite.",
  );
} finally {
  // Next's Windows dev CLI forks a listener. Stop only this test's allocated port.
  if (process.platform === "win32") {
    try {
      const rows = execFileSync("netstat", ["-ano"], {
        encoding: "utf8",
        timeout: 5000,
      }).split("\n");
      const listeners = new Set(
        rows
          .map((row) => row.trim().split(/\s+/))
          .filter(
            (columns) =>
              columns[0] === "TCP" &&
              columns[1]?.endsWith(`:${port}`) &&
              columns[3] === "LISTENING",
          )
          .map((columns) => Number(columns[4])),
      );
      for (const pid of listeners) {
        try {
          process.kill(pid);
        } catch {}
      }
    } catch {}
  }
  server.kill();
  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
  log.end();
  await browser?.close();
}
