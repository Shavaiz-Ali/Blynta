import { spawn, execFileSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const apps = [
  ["app", 3200],
  ["admin", 3201],
  ["studio", 3202],
  ["auth", 3203],
  ["web", 3204],
];
const children = [];
mkdirSync(resolve(root, ".test-results"), { recursive: true });
function stop() {
  for (const { child, log } of children.reverse()) {
    try {
      if (child.exitCode === null) {
        if (process.platform === "win32")
          execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            windowsHide: true,
            stdio: "ignore",
            timeout: 10000,
          });
        else child.kill("SIGTERM");
      }
    } catch {
      child.kill();
    }
    child.stdout.destroy();
    child.stderr.destroy();
    log.end();
    child.unref();
  }
}
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(143);
});
try {
  for (const [name, port] of apps) {
    const child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      {
        cwd: resolve(root, "apps", name),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "production",
          CENTRAL_AUTH_ENABLED: "false",
          AUTH_SECRET: `synthetic-production-startup-${name}-secret`,
          NEXTAUTH_SECRET: `synthetic-production-startup-${name}-secret`,
          AUTH_URL: `http://localhost:${port}`,
          AUTH_APP_URL: "http://localhost:3203",
          MAIN_APP_URL: "http://localhost:3200",
        },
      },
    );
    const log = createWriteStream(
      resolve(root, ".test-results", `startup-${name}.log`),
    );
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    children.push({ child, log });
    const url = `http://localhost:${port}${name === "web" ? "/" : "/login"}`;
    const deadline = Date.now() + 60000;
    let response;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error(`${name} exited: inspect startup-${name}.log`);
      try {
        response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        if (response.status < 500) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(
      response && response.status < 500,
      `Production startup failed for ${name}`,
    );
    assert.equal(response.status, 200, `${name} page must render successfully`);
    console.log(
      `PASS: apps/${name} production server renders ${name === "web" ? "/" : "/login"} (200)`,
    );
  }
} finally {
  stop();
}
