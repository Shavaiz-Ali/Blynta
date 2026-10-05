import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
const root = path.resolve(import.meta.dirname, "../../..");
const runtime = process.env.STUDIO_PLAYWRIGHT_PATH;
if (!runtime)
  throw new Error(
    "Set STUDIO_PLAYWRIGHT_PATH to an installed playwright package.",
  );
const require = createRequire(import.meta.url);
const { chromium } = require(runtime);
const port = 3214;
const origin = `http://localhost:${port}`;
const secret = "studio-workspace-test-only-secret-32-characters";
const log = fs.createWriteStream(
  path.join(root, ".test-results/studio-ui-consistency.log"),
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
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
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
    thumbnail: `${origin}/test-media.svg`,
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
  let slowProject = true;
  let slowDashboard = true;
  await page.route("**/api/studio/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === "GET" && url.pathname.endsWith(project.id) && slowProject) {
      slowProject = false;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (
      method === "GET" &&
      url.pathname.endsWith("/projects") &&
      slowDashboard
    ) {
      slowDashboard = false;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
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
        assets: input.document.assets.map((a) =>
          a.id === asset.id
            ? { ...a, src: asset.src, thumbnail: asset.thumbnail }
            : a,
        ),
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

  await page.goto(origin + "/editor/" + project.id, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByRole("status", { name: "Loading editor", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(root, ".test-results/editor-loading.png"),
  });
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  const geometry = async () =>
    page.evaluate(() => {
      const box = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return {
        preview: box(".preview-area"),
        right: box(".right-workspace"),
        rail: box(".property-rail"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
  await page.getByRole("button", { name: "Basic", exact: true }).click();
  let b = await geometry();
  console.log("Desktop geometry", b);
  assert.ok(Math.abs(b.preview.h - b.right.h) < 2);
  assert.ok(Math.abs(b.preview.y - b.right.y) < 2);
  assert.ok(b.preview.w > 400);
  assert.equal(b.overflow, false);
  await page.screenshot({
    path: path.join(root, ".test-results/editor-shared-light.png"),
  });
  await page.getByRole("button", { name: "Open Blynta AI chat" }).click();
  await page.getByRole("heading", { name: "What should we edit?" }).waitFor();
  b = await geometry();
  assert.ok(Math.abs(b.preview.h - b.right.h) < 2);
  await page
    .getByRole("button", { name: "Make this 9:16", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply 1 edit" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".preview-frame").style.aspectRatio === "9 / 16",
  );
  await page.getByRole("button", { name: "Switch theme" }).click();
  await page.screenshot({
    path: path.join(root, ".test-results/editor-shared-dark.png"),
  });
  await page.getByRole("button", { name: "Close Blynta AI" }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  assert.equal(await page.locator(".timeline-clip").count(), 2);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page.getByRole("tab", { name: "Uploads", exact: true }).click();
  await page.getByRole("tab", { name: "Images", exact: true }).click();
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole("button", { name: "Toggle media panel" }).click();
    if (await page.locator(".right-workspace").isVisible())
      await page
        .getByRole("button", { name: "Toggle properties panel" })
        .click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(root, ".test-results/editor-library-" + width + ".png"),
    });
    if (await page.locator(".tool-panel").isVisible())
      await page.getByRole("button", { name: "Toggle media panel" }).click();
    await page.screenshot({
      path: path.join(root, ".test-results/editor-shared-" + width + ".png"),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await page.locator(".studio-project-skeleton").first().waitFor();
  await page.screenshot({
    path: path.join(root, ".test-results/dashboard-loading.png"),
    fullPage: true,
  });
  await page.locator(".studio-project-card").first().waitFor();
  await page.locator(".studio-project-card img").first().waitFor();
  assert.ok((await page.locator(".studio-project-card img").count()) > 0);
  await page.screenshot({
    path: path.join(root, ".test-results/dashboard-shared-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Blank project", exact: false })
    .click();
  const blank = page.getByRole("button", { name: "Start blank", exact: true });
  await blank.waitFor();
  assert.ok(
    await blank.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const svg = el.querySelector("svg").getBoundingClientRect();
      return svg.y >= r.y && svg.bottom <= r.bottom;
    }),
  );
  await page.screenshot({
    path: path.join(root, ".test-results/project-dialog-shared.png"),
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Switch theme" }).click();
  await page.screenshot({
    path: path.join(root, ".test-results/dashboard-shared-light.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Open Studio navigation" }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: path.join(root, ".test-results/sidebar-shared-mobile.png"),
  });
  slowProject = true;
  await page.goto(origin + "/editor/" + project.id, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("status", { name: "Loading editor", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(root, ".test-results/editor-loading-mobile.png"),
  });
  await page.getByRole("region", { name: "Video preview" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Shared UI browser checks passed: aligned inspector and AI; responsive editor/dashboard; shared tabs; editing; thumbnails; blank button; mobile sidebar; both themes. API responses mocked.",
  );
} finally {
  await browser?.close();
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 10000,
      });
    } catch {
      server.kill();
    }
  } else server.kill();
  log.end();
}
