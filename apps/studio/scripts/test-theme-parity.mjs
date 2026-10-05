import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../../..");
const { chromium } = createRequire(import.meta.url)(
  process.env.STUDIO_PLAYWRIGHT_PATH,
);
const servers = [],
  fixtures = [];
let browser;
const source = `"use client";
import {AppInput,AppSelect,AppTabs,AppViewModeToggle,AppMediaCard,AppButton,AppTextarea,AppSidebarItem} from "@blynta/ui";
export default function Page(){return <main className="p-8 max-w-2xl space-y-6"><h1>Shared Blynta UI</h1><nav className="bg-sidebar p-3 space-y-2"><AppSidebarItem id="main-nav-active" label="Projects" icon={<span/>} active/><AppSidebarItem id="rail-nav-active" label="Media" icon={<span/>} active rail/><AppSidebarItem id="main-nav-idle" label="Library" icon={<span/>}/><AppSidebarItem id="rail-nav-idle" label="Audio" icon={<span/>} rail/></nav><div className="media-panel-body space-y-4"><AppInput aria-label="Search" placeholder="Search your projects" className="bg-background/80"/><AppSelect aria-label="Sort" className="bg-background/80" value="recent" options={[{value:"recent",label:"Last edited"}]}/><AppTabs value="library" tabs={[{value:"library",label:"Library"},{value:"uploads",label:"Uploads"}]}/><AppViewModeToggle mode="grid" onChange={()=>{}}/><AppTextarea aria-label="Prompt" placeholder="Describe an edit"/><AppButton>New project</AppButton></div><AppMediaCard className="studio-project-card"><div className="aspect-video bg-muted"/><div className="p-4"><h2>Project preview</h2></div></AppMediaCard></main>}
`;
const fields = [
  "backgroundColor",
  "color",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "boxShadow",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "height",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "outlineStyle",
  "outlineWidth",
];
async function styles(page) {
  return page.evaluate((fields) => {
    const selectors = {
      input: "input",
      select: '[data-slot="select-trigger"]',
      tab: '[role="tab"][aria-selected="true"]',
      card: '[data-slot="card"]',
      button: "button:not([role]):not([aria-pressed])",
      textarea: "textarea",
    };
    return Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => {
        const c = getComputedStyle(document.querySelector(selector));
        return [key, Object.fromEntries(fields.map((k) => [k, c[k]]))];
      }),
    );
  }, fields);
}
try {
  for (const [index, app] of ["app", "studio"].entries()) {
    const dir = path.join(root, "apps", app, "app/auth/ui-parity-check");
    assert.equal(fs.existsSync(dir), false);
    fs.mkdirSync(dir, { recursive: true });
    fixtures.push(dir);
    fs.writeFileSync(path.join(dir, "page.tsx"), source);
    const port = 3215 + index;
    const log = fs.createWriteStream(
      path.join(root, ".test-results/theme-parity-" + app + ".log"),
    );
    const server = spawn(
      process.execPath,
      [
        path.join(root, "apps", app, "node_modules/next/dist/bin/next"),
        "dev",
        "--webpack",
        "-p",
        String(port),
      ],
      {
        cwd: path.join(root, "apps", app),
        windowsHide: true,
        env: {
          ...process.env,
          CENTRAL_AUTH_ENABLED: "false",
          AUTH_SECRET: "ui-parity-test-only-secret",
          AUTH_TRUST_HOST: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.pipe(log);
    server.stderr.pipe(log);
    servers.push(server);
    for (let i = 0; i < 60; i++) {
      try {
        await fetch("http://localhost:" + port + "/api/auth/session");
        break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const p = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    await p.goto("http://localhost:" + (3215 + i) + "/auth/ui-parity-check", {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await p.getByRole("heading", { name: "Shared Blynta UI" }).waitFor();
    await p.evaluate(() => document.fonts.ready);
    pages.push(p);
  }
  for (const theme of ["light", "dark"]) {
    for (const p of pages)
      await p.evaluate((theme) => {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(theme);
      }, theme);
    await new Promise((r) => setTimeout(r, 400));
    const navColors = async (page, id) =>
      page.locator(id).evaluate((el) => {
        const c = getComputedStyle(el);
        return {
          background: c.backgroundColor,
          color: c.color,
          shadow: c.boxShadow,
          radius: c.borderRadius,
        };
      });
    assert.deepEqual(
      await navColors(pages[1], "#rail-nav-active"),
      await navColors(pages[0], "#main-nav-active"),
      theme + " active editor/main navigation colors differ",
    );
    assert.deepEqual(
      await navColors(pages[1], "#rail-nav-idle"),
      await navColors(pages[0], "#main-nav-idle"),
      theme + " idle editor/main navigation colors differ",
    );
    await pages[0].locator("#main-nav-idle").hover();
    await pages[1].locator("#rail-nav-idle").hover();
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(
      await navColors(pages[1], "#rail-nav-idle"),
      await navColors(pages[0], "#main-nav-idle"),
      theme + " hovered editor/main navigation colors differ",
    );
    for (const p of pages) await p.mouse.move(0, 0);
    assert.deepEqual(
      await styles(pages[1]),
      await styles(pages[0]),
      theme + " shared UI differs",
    );
    for (const p of pages)
      await p.getByRole("textbox", { name: "Search", exact: true }).focus();
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(
      await styles(pages[1]),
      await styles(pages[0]),
      theme + " focused input differs",
    );
    for (const [i, p] of pages.entries())
      await p.screenshot({
        path: path.join(
          root,
          ".test-results/theme-parity-" +
            ["main", "studio"][i] +
            "-" +
            theme +
            ".png",
        ),
        fullPage: true,
      });
  }
  console.log(
    "Main app / Studio computed styles match: navigation active/idle/hover, input, select, tabs, cards, button, textarea; light, dark and input focus.",
  );
} finally {
  if (browser) await browser.close();
  for (const server of servers) {
    try {
      execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 10000,
      });
    } catch {
      server.kill();
    }
  }
  for (const dir of fixtures) {
    assert.ok(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const app of ["app", "studio"]) {
    const dir = path.join(root, "apps", app, ".next/dev/types");
    const validator = path.join(dir, "validator.ts");
    if (
      fs.existsSync(validator) &&
      fs.readFileSync(validator, "utf8").includes("ui-parity-check")
    )
      fs.rmSync(validator);
    const route = path.join(dir, "app/auth/ui-parity-check");
    if (fs.existsSync(route))
      fs.rmSync(route, { recursive: true, force: true });
  }
}
