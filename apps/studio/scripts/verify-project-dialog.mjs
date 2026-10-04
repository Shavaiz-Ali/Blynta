import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH);
const root = path.resolve(import.meta.dirname, "..");
const fixture = path.join(root, "app/auth/dialog-verification/page.tsx");
if (fs.existsSync(fixture))
  throw new Error("Verification route already exists");
fs.mkdirSync(path.dirname(fixture), { recursive: true });
fs.writeFileSync(
  fixture,
  `"use client";
import { useState } from "react";
import { NewProjectDialog } from "@/features/studio/projects/components/NewProjectDialog";
export default function Page() { const [open,setOpen] = useState(true); return <NewProjectDialog open={open} onOpenChange={setOpen} onCreate={()=>{}} />; }
`,
);
const server = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "3222"],
  {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, MAIN_APP_URL: "https://blynta.vercel.app" },
    stdio: "ignore",
  },
);
let browser;
try {
  for (let count = 0; count < 60; count++) {
    try {
      await fetch("http://localhost:3222/api/auth/session");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const out = path.join(root, "dialog-verification");
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let uploadCalls = 0,
      completes = 0;
    await page.route("**/api/studio/**", (route) => {
      const url = route.request().url();
      let data = {
        id: "507f1f77bcf86cd799439011",
        name: "Test",
        ratio: "16:9",
        revision: 0,
        tracks: [],
        clips: [],
        assets: [],
      };
      if (url.endsWith("/upload")) {
        uploadCalls++;
        data = {
          assetId: "asset-1",
          uploadUrl: "https://storage.invalid/upload",
        };
      }
      if (url.endsWith("/complete")) completes++;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    });
    await page.route("https://storage.invalid/upload", (route) =>
      route.abort("failed"),
    );
    await page.goto("http://localhost:3222/auth/dialog-verification", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.getByRole("button", { name: /Blank project/ }).click();
    await page.getByRole("button", { name: /Start blank/ }).waitFor();
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({
      path: path.join(out, `${width}-blank.png`),
      caret: "initial",
    });
    await page.getByRole("button", { name: /Upload video/ }).click();
    const dialog = page.getByRole("dialog");
    const overflow = await dialog.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    assert.equal(overflow, false);
    await page.screenshot({
      path: path.join(out, `${width}-upload.png`),
      caret: "initial",
    });
    await page.getByLabel("Upload project media").setInputFiles({
      name: "test.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("test"),
    });
    await page
      .getByRole("alert")
      .filter({ hasText: "Your upload could not reach media storage." })
      .waitFor();
    assert.equal(uploadCalls, 1);
    assert.equal(completes, 0);
    assert.equal(
      await page.getByRole("button", { name: "Browse files" }).isEnabled(),
      true,
    );
    assert.deepEqual(errors, []);
    results.push({ width, overflow, uploadCalls, completes, errors });
    await page.close();
  }
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  if (browser) await browser.close();
  try {
    if (server.exitCode === null) {
      if (process.platform === "win32")
        execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else server.kill();
    }
  } catch {
    server.kill();
  } finally {
    fs.unlinkSync(fixture);
    const validator = path.join(root, ".next/dev/types/validator.ts");
    if (
      fs.existsSync(validator) &&
      fs
        .readFileSync(validator, "utf8")
        .includes("auth/dialog-verification/page.js")
    )
      fs.unlinkSync(validator);
  }
}
