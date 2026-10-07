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
// Next persists a user badge position that overrides next.config. Keep the
// browser fixture's development badge clear of the real rail theme control.
const devToolsConfig = path.join(
  root,
  "apps/studio/.next/dev/cache/next-devtools-config.json",
);
fs.mkdirSync(path.dirname(devToolsConfig), { recursive: true });
const devToolsPreferences = fs.existsSync(devToolsConfig)
  ? JSON.parse(fs.readFileSync(devToolsConfig, "utf8"))
  : {};
fs.writeFileSync(
  devToolsConfig,
  JSON.stringify({ ...devToolsPreferences, devToolsPosition: "bottom-right" }),
);
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
let page;
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
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const videoBytes = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const drawing = canvas.getContext("2d");
      const stream = canvas.captureStream(15);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const finished = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      let count = 0;
      const draw = () => {
        drawing.fillStyle = "#204052";
        drawing.fillRect(0, 0, 320, 180);
        drawing.fillStyle = "#ffffff";
        drawing.font = "24px sans-serif";
        drawing.fillText(`Test footage ${count++}`, 20, 95);
      };
      draw();
      recorder.start();
      const timer = setInterval(draw, 60);
      await new Promise((resolve) => setTimeout(resolve, 2100));
      recorder.stop();
      await finished;
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
    }),
  );
  const audioBytes = Buffer.alloc(44 + 16000 * 2 * 2);
  audioBytes.write("RIFF", 0);
  audioBytes.writeUInt32LE(audioBytes.length - 8, 4);
  audioBytes.write("WAVEfmt ", 8);
  audioBytes.writeUInt32LE(16, 16);
  audioBytes.writeUInt16LE(1, 20);
  audioBytes.writeUInt16LE(1, 22);
  audioBytes.writeUInt32LE(16000, 24);
  audioBytes.writeUInt32LE(32000, 28);
  audioBytes.writeUInt16LE(2, 32);
  audioBytes.writeUInt16LE(16, 34);
  audioBytes.write("data", 36);
  audioBytes.writeUInt32LE(audioBytes.length - 44, 40);
  for (let sample = 0; sample < 32000; sample++)
    audioBytes.writeInt16LE(
      Math.round(Math.sin((sample * Math.PI * 2 * 440) / 16000) * 1200),
      44 + sample * 2,
    );
  await page.route("**/test-video-*.webm", (route) =>
    route.fulfill({ contentType: "video/webm", body: videoBytes }),
  );
  await page.route("**/test-audio.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: audioBytes }),
  );
  const asset = {
    id: "image-1",
    name: "Northern coast",
    kind: "image",
    duration: 5,
    origin: "Upload",
    status: "ready",
    src: `${origin}/test-media.svg`,
  };
  const videoAsset = {
    ...asset,
    id: "video-1",
    name: "Coast video",
    kind: "video",
    duration: 2,
    thumbnail: asset.src,
    src: `${origin}/test-video-a.webm`,
  };
  const videoB = {
    ...videoAsset,
    id: "video-2",
    name: "Coast video B",
    src: `${origin}/test-video-b.webm`,
  };
  const audioAsset = {
    ...asset,
    id: "audio-1",
    name: "Ambient audio",
    kind: "audio",
    duration: 2,
    src: `${origin}/test-audio.wav`,
  };
  const waitingAsset = {
    ...videoAsset,
    id: "waiting-1",
    name: "Processing footage",
    status: "processing",
    src: undefined,
    duration: 0,
  };
  const brokenThumbnail = {
    ...asset,
    id: "image-fallback",
    name: "Missing thumbnail",
    thumbnail: `${origin}/missing-thumbnail.png`,
  };
  const mediaFixtures = [
    asset,
    videoAsset,
    videoB,
    audioAsset,
    waitingAsset,
    brokenThumbnail,
  ];
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
    assets: mediaFixtures,
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
      body: fs.readFileSync(
        path.join(root, "apps/studio/public/northern-light.svg"),
        "utf8",
      ),
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
            id: crypto.randomUUID(),
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
          ? project.assets.map((saved) => ({
              ...saved,
              src: mediaFixtures.find((item) => item.id === saved.id)?.src,
              thumbnail: mediaFixtures.find((item) => item.id === saved.id)
                ?.thumbnail,
            }))
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
  await page.locator("[data-editor-shell]").waitFor();
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  const geometry = async () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return {
        preview: rect("[data-preview-workspace]"),
        timeline: rect("[data-timeline-workspace]"),
        rail: rect("[data-editor-rail]"),
        context: rect("[data-project-tools]"),
        right: rect(".right-workspace"),
        frame: rect("[data-preview-frame]"),
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
      .locator('[data-project-tools] [data-slot="tabs-list"]')
      .first()
      .getAttribute("data-variant"),
    "line",
  );
  let bounds = await geometry();
  assert.equal(bounds.timeline.x, bounds.rail.x + bounds.rail.w + 12);
  assert.equal(bounds.timeline.w, 1440 - bounds.timeline.x - 12);
  assert.ok(
    bounds.rail.y < bounds.preview.y &&
      bounds.rail.h > bounds.preview.h + bounds.timeline.h,
  );
  assert.ok(
    bounds.preview.w >= 650 && bounds.frame.w > 500,
    JSON.stringify(bounds),
  );
  assert.ok(bounds.timeline.h >= 280 && bounds.timeline.h <= 380);
  assert.equal(bounds.rail.w, 72);
  const card = await page.locator(".media-item").first().boundingBox();
  assert.ok(
    card.height >= 60 && card.width >= 110 && card.width < 130,
    JSON.stringify(card),
  );
  const grid = await page
    .locator("[data-project-tools] .media-item")
    .first()
    .evaluate(
      (item) =>
        getComputedStyle(item.parentElement).gridTemplateColumns.split(" ")
          .length,
    );
  assert.equal(grid, 2);
  const library = page.locator("[data-project-tools]");
  const imageCard = library.locator(".media-item").filter({
    has: page.getByRole("button", {
      name: "Add Northern coast to timeline",
      exact: true,
    }),
  });
  const videoCard = library.locator(".media-item").filter({
    has: page.getByRole("button", {
      name: "Add Coast video to timeline",
      exact: true,
    }),
  });
  assert.equal(await imageCard.innerText(), "");
  assert.equal(await imageCard.locator("[data-media-duration]").count(), 0);
  assert.equal(
    await videoCard.locator("[data-media-duration]").innerText(),
    "00:02",
  );
  await videoCard.scrollIntoViewIfNeeded();
  await videoCard.screenshot({
    path: path.join(root, ".test-results/studio-editor-video-card.png"),
    animations: "disabled",
  });
  await imageCard.scrollIntoViewIfNeeded();
  assert.equal(
    await library.getByText("Northern coast", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Toggle media panel" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Toggle properties panel" }).count(),
    0,
  );
  assert.equal(await page.locator("#editor-ai-launcher svg").count(), 1);
  assert.ok(
    await page
      .locator("#editor-ai-launcher")
      .evaluate((button) => getComputedStyle(button).animationName !== "none"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator("#editor-ai-launcher")
      .evaluate((button) => getComputedStyle(button).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(await page.locator("[data-ai-header] > div svg").count(), 0);
  const railDetails = await page
    .locator("[data-editor-rail]")
    .evaluate((rail) => {
      const active = rail.querySelector('[aria-pressed="true"]');
      const logo = rail.querySelector("a svg").getBoundingClientRect();
      const box = rail.getBoundingClientRect();
      return {
        activeClasses: active.className,
        logoWidth: logo.width,
        logoHeight: logo.height,
        centered: Math.abs(logo.x + logo.width / 2 - box.x - box.width / 2) < 1,
      };
    });
  assert.ok(railDetails.activeClasses.includes("bg-primary "));
  assert.ok(railDetails.activeClasses.includes("text-primary-foreground"));
  assert.equal(railDetails.logoWidth, 28);
  assert.equal(railDetails.logoHeight, 28);
  assert.ok(railDetails.centered);
  const verifyRailTheme = async () => {
    const colors = await page.locator("[data-editor-rail]").evaluate((rail) => {
      const active = rail.querySelector('[aria-pressed="true"]');
      const resolve = (token) => {
        const probe = document.createElement("span");
        probe.style.color = `var(--${token})`;
        rail.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return {
        bg: getComputedStyle(rail).backgroundColor,
        sidebar: resolve("sidebar"),
        activeBg: getComputedStyle(active).backgroundColor,
        primary: resolve("primary"),
        activeFg: getComputedStyle(active).color,
        primaryFg: resolve("primary-foreground"),
      };
    });
    assert.equal(colors.bg, colors.sidebar);
    assert.equal(colors.activeBg, colors.primary);
    assert.equal(colors.activeFg, colors.primaryFg);
  };
  await verifyRailTheme();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("dark"),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("theme")),
    "light",
  );
  await page.waitForTimeout(250);
  await verifyRailTheme();
  await page.screenshot({
    path: path.join(root, ".test-results/studio-editor-polish-light.png"),
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".property-rail").count(), 0);
  assert.equal(await page.locator(".right-workspace").isVisible(), true);
  const transportLayout = async () =>
    page.evaluate(() => {
      const box = (selector) => {
        const b = document.querySelector(selector).getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return {
        time: box("[data-transport-time]"),
        playback: box("[data-transport-playback]"),
        display: box("[data-transport-display]"),
        composer: box("[data-ai-composer]"),
        suggestions: box("[data-ai-suggestions]"),
      };
    });
  let controls = await transportLayout();
  assert.ok(controls.time.right <= controls.playback.left);
  assert.ok(controls.playback.right <= controls.display.left);
  assert.ok(
    controls.suggestions.bottom <= controls.composer.top,
    "All AI suggestions must fit above the composer",
  );
  // Compact preview controls still perform real zoom, fit, and aspect changes.
  await page.getByRole("button", { name: "Preview zoom", exact: true }).click();
  await page.getByRole("menuitem", { name: "100%", exact: true }).click();
  assert.equal((await geometry()).frame.w, 1280);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  bounds = await geometry();
  assert.ok(bounds.frame.w <= 1440 && bounds.frame.h <= 900);
  assert.ok(Math.abs(bounds.frame.w / bounds.frame.h - 16 / 9) < 0.01);
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole("button", { name: "Preview zoom", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Fit to workspace", exact: true })
    .click();
  assert.ok((await geometry()).frame.w < 1280);
  await page
    .getByRole("button", { name: "Canvas aspect ratio", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "9:16", exact: true }).click();
  bounds = await geometry();
  assert.ok(Math.abs(bounds.frame.w / bounds.frame.h - 9 / 16) < 0.01);
  await page
    .getByRole("button", { name: "Canvas aspect ratio", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "16:9", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Describe an AI edit", exact: true })
    .press("Control+k");
  assert.ok(
    await page.locator("[data-ai-workspace]").isVisible(),
    "Shortcuts must ignore the AI prompt",
  );
  // The right workspace defaults to AI; selection opens a contextual inspector. AI replaces it and returns it on close.
  await page.locator(".timeline-clip").first().click();
  await page.getByText("Clip inspector", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Image", exact: true }).waitFor();
  bounds = await geometry();
  assert.equal(bounds.right.w, 300);
  const position = await page
    .getByRole("spinbutton", { name: "Position X", exact: true })
    .boundingBox();
  const inspector = await page.locator(".inspector-panel").boundingBox();
  assert.ok(
    position.y >= inspector.y,
    "First inspector fields must not be clipped",
  );
  await page
    .getByRole("slider", { name: "Seek preview", exact: true })
    .press("End");
  assert.equal(
    await page.locator(".preview-media").count(),
    1,
    "Project end must retain its final frame",
  );
  await page
    .getByRole("slider", { name: "Seek preview", exact: true })
    .press("Home");
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
  assert.equal(bounds.right.w, 300);
  await page
    .getByRole("button", { name: "Make this 9:16", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply 1 edit" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-preview-frame]").style.aspectRatio ===
      "9 / 16",
  );
  bounds = await geometry();
  assert.ok(Math.abs(bounds.frame.w / bounds.frame.h - 9 / 16) < 0.01);
  await page.getByRole("button", { name: "Undo changes" }).click();
  const composerBefore = await page.locator("[data-ai-composer]").boundingBox();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("textbox", { name: "Describe an AI edit", exact: true })
      .fill("Make this 9:16");
    await page
      .getByRole("button", { name: "Send AI command", exact: true })
      .click();
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll("[data-ai-proposal]").length === count,
      i + 2,
    );
  }
  const composerAfter = await page.locator("[data-ai-composer]").boundingBox();
  assert.equal(
    composerAfter.y,
    composerBefore.y,
    "Conversation growth must not move the composer",
  );
  await page
    .locator("[data-ai-proposal]")
    .last()
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await page.getByText("Proposal discarded", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close Blynta AI" }).click();
  assert.equal(await page.locator(".inspector-task").isVisible(), true);
  // Both side panels can be collapsed to reclaim all center space.
  await page.getByRole("button", { name: "Collapse contextual panel" }).click();
  await page.getByRole("button", { name: "Close properties panel" }).click();
  bounds = await geometry();
  assert.ok(bounds.preview.w >= 1300);
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open properties", exact: true })
    .click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".inspector-task").isVisible(), true);
  await page.getByRole("button", { name: "Close properties panel" }).click();
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
    await page.locator("[data-ai-workspace]").isVisible(),
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
        .querySelector("[data-editor-shell]")
        .style.getPropertyValue("--media-width"),
    ),
    "300px",
  );
  await page.mouse.up();

  const divider = page.getByRole("separator", { name: "Resize timeline" });
  await divider.focus();
  await divider.press("ArrowUp");
  await page.waitForTimeout(900);
  assert.equal(project.revision, revisionBeforeResize);
  bounds = await geometry();
  assert.ok(bounds.timeline.h > 306);
  const savedHeight = JSON.parse(
    await page.evaluate(() =>
      localStorage.getItem("blynta-studio:workspace:v7"),
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
  assert.equal(await page.locator("[data-track-header]").count(), 3);
  const headers = await page.locator("[data-track-header]").all();
  const lanes = await page.locator("[data-track-lane]").all();
  for (let i = 0; i < headers.length; i++) {
    const header = await headers[i].boundingBox();
    const lane = await lanes[i].boundingBox();
    assert.equal(header.y, lane.y, "Track controls must align with their lane");
    assert.equal(header.height, lane.height);
  }
  for (const width of [2560, 1920, 1600, 1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    await page.locator(".timeline-clip.clip-image").click();
    await page
      .getByRole("button", { name: "Open Blynta AI chat", exact: true })
      .click();
    bounds = await geometry();
    assert.equal(bounds.timeline.x, bounds.rail.x + bounds.rail.w + 12);
    assert.equal(bounds.timeline.w, width - bounds.timeline.x - 12);
    assert.equal(bounds.right.w, 300);
    assert.ok(bounds.preview.w >= 400, `${width}: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.frame.w > 180 && bounds.frame.h > 150);
    controls = await transportLayout();
    assert.ok(
      controls.time.right <= controls.playback.left,
      `${width}: time/transport overlap`,
    );
    assert.ok(
      controls.playback.right <= controls.display.left,
      `${width}: transport/display overlap`,
    );
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
  assert.ok(bounds.preview.w >= 880);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  assert.ok(await page.locator("[data-project-tools]").isVisible());
  controls = await transportLayout();
  assert.ok(
    controls.suggestions.bottom <= controls.composer.top,
    "Reference-sized AI suggestions must remain visible",
  );
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
  // Capture the populated workspace at the reference image's viewport.
  project = {
    ...project,
    name: "Coastal story",
    clips: project.clips.map((c) =>
      c.kind === "text"
        ? { ...c, name: "A quiet moment", y: 0, fontSize: 44 }
        : c,
    ),
  };
  await page.setViewportSize({ width: 1252, height: 786 });
  await page.waitForTimeout(150);
  await page.evaluate(() =>
    localStorage.setItem(
      "blynta-studio:workspace:v7",
      JSON.stringify({
        mediaWidth: 280,
        inspectorWidth: 300,
        aiWidth: 300,
        timelineHeight: 267,
        contextOpen: true,
        inspectorOpen: true,
      }),
    ),
  );
  await page.reload();
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  await page.getByText("What should we edit?", { exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-editor-shell]")
        ?.style.getPropertyValue("--timeline-height") === "267px",
  );
  assert.ok(await page.locator("[data-project-tools]").isVisible());
  await page.screenshot({
    animations: "disabled",
    path: path.join(root, ".test-results/studio-editor-reference-layout.png"),
  });
  // Real native drags from an empty timeline: video A/B, image, then audio.
  project = {
    ...project,
    name: "A long project title that must leave room for save state, Blynta AI, export, and account actions",
    assets: mediaFixtures,
    clips: [],
    tracks: [
      {
        id: "video",
        name: "Video 1",
        kind: "video",
        muted: false,
        hidden: false,
      },
    ],
  };
  await page.reload();
  await page.getByText("Start with your footage", { exact: true }).waitFor();
  const nativeDrop = async (assetId, time, valid = true) => {
    const source = page.locator(
      `[data-media-asset="${assetId}"] button[draggable]`,
    );
    await source.scrollIntoViewIfNeeded();
    const sourceBox = await source.boundingBox();
    const lane = page.locator('[data-track-lane][data-track-id="video"]');
    const laneBox = await lane.boundingBox();
    const contentBox = await page
      .locator("[data-timeline-content]")
      .boundingBox();
    const x = contentBox.x + time * 64;
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(x, laneBox.y + 32, { steps: 20 });
    await page.mouse.move(x, laneBox.y + 32);
    if (valid) {
      await page.locator("[data-drop-indicator]").waitFor();
      if (assetId === videoAsset.id)
        await page.screenshot({
          path: path.join(
            root,
            ".test-results/studio-editor-drag-insertion.png",
          ),
          animations: "disabled",
        });
    } else assert.equal(await page.locator("[data-drop-indicator]").count(), 0);
    await page.mouse.up();
  };
  const saveReady = async (predicate) => {
    for (let attempt = 0; attempt < 100 && !predicate(); attempt++)
      await page.waitForTimeout(100);
    assert.ok(predicate(), "Autosave must persist the tested document");
  };
  assert.equal(
    await page
      .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
      .evaluate((element) => element.scrollLeft),
    0,
  );
  await nativeDrop(videoAsset.id, 10);
  assert.equal(await page.locator(".timeline-clip").count(), 1);
  await nativeDrop(videoB.id, 11); // Collision resolves to the end of video A, at 12s.
  assert.equal(await page.locator(".timeline-clip").count(), 2);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".timeline-clip").count(), 1);
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await page.locator(".timeline-clip").count(), 2);
  await nativeDrop(asset.id, 14);
  await nativeDrop(audioAsset.id, 8);
  assert.equal(await page.locator(".timeline-clip").count(), 4);
  assert.equal(await page.locator("[data-track-header]").count(), 2);
  await saveReady(() => project.clips.length === 4);
  assert.deepEqual(
    project.clips.map((item) => [item.assetId, item.start, item.trackId]),
    [
      [videoAsset.id, 10, "video"],
      [videoB.id, 12, "video"],
      [asset.id, 14, "video"],
      [audioAsset.id, 8, "audio"],
    ],
  );
  const moving = page
    .locator(".timeline-clip")
    .filter({ hasText: videoB.name });
  const movingBox = await moving.boundingBox();
  await page.mouse.move(
    movingBox.x + movingBox.width / 2,
    movingBox.y + movingBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    movingBox.x + movingBox.width / 2 - 384,
    movingBox.y + movingBox.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
  assert.ok(
    (await moving.getAttribute("aria-label")).includes("starts at 6.0"),
  );
  await page.keyboard.press("Control+z");
  assert.ok(
    (await moving.getAttribute("aria-label")).includes("starts at 12.0"),
  );
  await page.keyboard.press("Control+Shift+z");
  await saveReady(
    () => project.clips.find((item) => item.assetId === videoB.id)?.start === 6,
  );
  await page.getByRole("button", { name: "Lock Video 1", exact: true }).click();
  await nativeDrop(videoB.id, 10, false);
  assert.equal(await page.locator(".timeline-clip").count(), 4);
  await page
    .getByRole("button", { name: "Unlock Video 1", exact: true })
    .click();
  assert.equal(
    await page
      .locator('[data-media-asset="waiting-1"] button[draggable]')
      .getAttribute("draggable"),
    "false",
  );
  await page
    .locator('[data-media-asset="image-fallback"]')
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => !document.querySelector('[data-media-asset="image-fallback"] img'),
  );
  await saveReady(
    () => !project.tracks.find((track) => track.id === "video").locked,
  );
  await page.reload();
  await page.locator(".timeline-clip").first().waitFor();
  assert.equal(await page.locator(".timeline-clip").count(), 4);
  const contentBox = await page
    .locator("[data-timeline-content]")
    .boundingBox();
  await page.mouse.click(contentBox.x + 11 * 64, contentBox.y + 18);
  await page.locator("video.preview-media").waitFor();
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector("video.preview-media").currentTime - 1) <
      0.12,
  );
  assert.ok(
    Math.abs(
      Number(
        await page
          .getByRole("slider", { name: "Timeline playhead", exact: true })
          .getAttribute("aria-valuenow"),
      ) - 11,
    ) < 0.05,
  );
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Pause video", exact: true }).click();
  assert.ok(
    Number(
      await page
        .getByRole("slider", { name: "Timeline playhead", exact: true })
        .getAttribute("aria-valuenow"),
    ) > 11.3,
  );
  await page.mouse.click(contentBox.x + 9 * 64, contentBox.y + 18);
  await page.locator("audio").waitFor({ state: "attached" });
  await page.waitForFunction(
    () => Math.abs(document.querySelector("audio").currentTime - 1) < 0.12,
  );
  const playheadKnob = await page
    .locator('.ruler-seek [data-slot="slider-thumb"]')
    .boundingBox();
  await page.mouse.move(playheadKnob.x + 5, playheadKnob.y + 4);
  await page.mouse.down();
  await page.mouse.move(contentBox.x + 11 * 64, playheadKnob.y + 4, {
    steps: 10,
  });
  await page.mouse.up();
  assert.ok(
    Math.abs(
      Number(
        await page
          .getByRole("slider", { name: "Timeline playhead", exact: true })
          .getAttribute("aria-valuenow"),
      ) - 11,
    ) < 0.1,
  );
  const beforeZoom = project.revision;
  for (const percent of [25, 50, 75, 100, 150, 200]) {
    await page
      .getByRole("button", { name: "Preview zoom", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: `${percent}%`, exact: true })
      .click();
    assert.equal((await geometry()).frame.w, (1280 * percent) / 100);
  }
  const preview = await page.locator("[data-preview-viewport]").boundingBox();
  await page.mouse.move(preview.x + 30, preview.y + 30);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  await page
    .getByRole("button", { name: "Preview zoom", exact: true })
    .filter({ hasText: "150%" })
    .waitFor();
  await page.getByRole("button", { name: "Preview zoom", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Fit to workspace", exact: true })
    .click();
  await page.waitForTimeout(900);
  assert.equal(
    project.revision,
    beforeZoom,
    "Preview zoom is workspace state, not an autosave edit",
  );
  await page
    .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
    .evaluate((element) => {
      element.scrollLeft = 500;
    });
  await nativeDrop(brokenThumbnail.id, 22);
  await saveReady(() => project.clips.length === 5);
  assert.equal(
    project.clips.at(-1).start,
    22,
    "drop time must include timeline horizontal scroll",
  );
  await page
    .getByRole("slider", { name: "Seek preview", exact: true })
    .press("End");
  assert.ok(
    await page
      .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
      .evaluate((element) => element.scrollLeft > 0),
  );
  await page
    .getByRole("slider", { name: "Seek preview", exact: true })
    .press("Home");
  assert.equal(
    await page
      .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
      .evaluate((element) => element.scrollLeft),
    0,
  );
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("dark"),
  );
  await page.goto(`${origin}/dashboard`);
  await page.locator("#studio-sidebar").waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    false,
  );
  await page.reload();
  await page.locator("#studio-sidebar").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("theme")),
    "light",
  );
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Appearance", exact: true }).hover();
  await page.getByRole("menuitem", { name: "system", exact: true }).click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("theme")),
    "system",
  );
  await page.goto(`${origin}/editor/${project.id}`);
  await page.locator(".timeline-clip").first().waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    true,
  );
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Switch to dark mode" }).waitFor();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: path.join(root, ".test-results/studio-editor-multiple-media.png"),
    animations: "disabled",
  });
  // A long occupied clip must not make a successful addition appear lost.
  project = {
    ...project,
    assets: mediaFixtures,
    clips: [{ ...clip, duration: 300 }],
    tracks: [
      {
        id: "video",
        name: "Video 1",
        kind: "video",
        muted: false,
        hidden: false,
      },
    ],
  };
  await page.reload();
  await page.locator(".timeline-clip").first().waitFor();
  await nativeDrop(videoAsset.id, 10);
  await saveReady(() => project.clips.length === 2);
  assert.equal(project.clips.at(-1).start, 300);
  assert.ok(
    await page
      .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
      .evaluate((element) => element.scrollLeft > 0),
  );
  const revealed = await page
    .locator(".timeline-clip")
    .filter({ hasText: videoAsset.name })
    .boundingBox();
  const visibleTimeline = await page
    .locator("[data-timeline-workspace]")
    .boundingBox();
  assert.ok(
    revealed.x >= visibleTimeline.x &&
      revealed.x < visibleTimeline.x + visibleTimeline.width,
  );
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Pause video", exact: true }).click();
  assert.equal(
    await page
      .locator('[data-timeline-workspace] [data-slot="scroll-area-viewport"]')
      .evaluate((element) => element.scrollLeft),
    0,
    "pausing must not jump back to a previously selected distant clip",
  );
  // Empty projects retain the workspace, and smaller viewports scroll internally.
  project = { ...project, clips: [], assets: [] };
  await page.reload();
  await page.getByText("Start with your footage", { exact: true }).waitFor();
  assert.ok(await page.locator("[data-timeline-workspace]").isVisible());
  assert.equal(await page.locator(".timeline-clip").count(), 0);
  await page.screenshot({
    animations: "disabled",
    path: path.join(root, ".test-results/studio-editor-empty.png"),
  });
  for (const width of [768, 640, 390]) {
    await page.setViewportSize({ width, height: 786 });
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      ),
      false,
    );
    bounds = await geometry();
    assert.ok(bounds.timeline.x >= bounds.rail.x + bounds.rail.w);
    assert.ok(bounds.timeline.y + bounds.timeline.h <= 786);
  }
  await page.screenshot({
    animations: "disabled",
    path: path.join(root, ".test-results/studio-editor-mobile.png"),
  });
  assert.deepEqual(errors, []);
  console.log(
    "Workspace browser checks passed: native sequential video/image/audio drops, collisions, long-clip reveal, scrolled coordinates, locked/processing media, history, save/reload, real video/audio playback synchronization, playhead dragging, all preview zooms and Ctrl-wheel, reduced motion, dashboard/editor theme persistence and system mode, responsive geometry, AI scrolling, autosave and export UI. API transport is mocked; playable media fixtures are generated locally.",
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({
        path: path.join(root, ".test-results/studio-workspace-failure.png"),
      })
      .catch(() => {});
    console.error(
      "Browser failure page:",
      page.url(),
      (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 1600),
    );
  }
  throw error;
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
