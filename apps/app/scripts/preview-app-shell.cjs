/* eslint-disable @typescript-eslint/no-require-imports -- Local visual fixture, no app route or authentication changes. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  createFixture,
  load,
  workspaceMocks,
} = require("./app-shell-harness.cjs");
const root = path.resolve(__dirname, "..");

async function start() {
  const postcss = Module.createRequire(require.resolve("@tailwindcss/postcss"))(
    "postcss",
  );
  const css = await postcss([require("@tailwindcss/postcss")()]).process(
    fs.readFileSync(path.join(root, "app/globals.css"), "utf8"),
    { from: path.join(root, "app/globals.css") },
  );
  const fixture = createFixture();
  const workspace = workspaceMocks();
  const { StudioWorkspace } = load("features/ai-editor/StudioWorkspace.tsx", {
    ...fixture.mocks,
    ...workspace.mocks,
  });
  const routes = new Set([
    "/dashboard",
    "/studio",
    "/studio/clip-preview",
    "/my-clips",
    "/billing",
  ]);
  http
    .createServer((request, response) => {
      const route = new URL(request.url, "http://localhost").pathname;
      if (route === "/style.css") {
        response.setHeader("Content-Type", "text/css");
        response.end(css.css);
        return;
      }
      if (!routes.has(route)) {
        response.writeHead(404);
        response.end();
        return;
      }
      fixture.setPath(route);
      const content =
        route === "/studio/clip-preview"
          ? React.createElement(StudioWorkspace, workspace)
          : React.createElement(
              fixture.PageContent,
              null,
              React.createElement(
                "p",
                { className: "text-sm text-muted-foreground" },
                "Shared shell visual fixture. Feature content and account APIs are mocked; controls are rendered by production components.",
              ),
              React.createElement(
                "div",
                { className: "rounded-xl border bg-card p-6" },
                "Page content",
              ),
            );
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        `<!doctype html><html class="dark"><head><title>Blynta shell fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-background text-foreground">${renderToStaticMarkup(React.createElement(fixture.AppShell, null, content))}</body></html>`,
      );
    })
    .listen(4318, "127.0.0.1", () =>
      console.log("Shell fixture: http://127.0.0.1:4318/dashboard"),
    );
}
start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
