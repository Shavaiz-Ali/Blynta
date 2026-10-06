import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

let source = fs.readFileSync(
  new URL("../app/api/workspace/[...path]/route.ts", import.meta.url),
  "utf8",
);
source = source
  .replace(
    /import \{ auth \} from [^;]+;/,
    "const auth = () => globalThis.workspaceTestAuth();",
  )
  .replace(
    /import \{ backendUrl \} from [^;]+;/,
    'const backendUrl = () => "https://backend.example.test";',
  )
  .replace(
    /import \{ NextResponse \} from [^;]+;/,
    "const NextResponse = { json: Response.json };",
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { GET, PATCH } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.workspaceTestAuth = async () => ({
  accessToken: "server-only-test-token",
});
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return Response.json({ success: true, data: { count: 3 } });
};
const context = (path) => ({
  params: Promise.resolve({ path: path.split("/") }),
});
try {
  for (const path of [
    "users/other",
    "billing/paddle/webhook",
    "../users/me",
    "notifications/other/read",
  ]) {
    assert.equal(
      (
        await GET(
          new Request("https://studio.example.test/api/workspace/x"),
          context(path),
        )
      ).status,
      404,
    );
  }
  assert.equal(calls.length, 0);
  const url = "https://studio.example.test/api/workspace/notifications";
  assert.equal(
    (
      await PATCH(
        new Request(url, {
          method: "PATCH",
          headers: { origin: "https://attacker.example.test" },
        }),
        context("notifications/read-all"),
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  globalThis.workspaceTestAuth = async () => null;
  assert.equal((await GET(new Request(url), context("users/me"))).status, 401);
  assert.equal(calls.length, 0);
  globalThis.workspaceTestAuth = async () => ({
    accessToken: "server-only-test-token",
  });
  const response = await GET(
    new Request(`${url}?page=2&limit=5&userId=other`),
    context("notifications"),
  );
  assert.equal(response.status, 200);
  assert.equal(
    calls[0].url,
    "https://backend.example.test/notifications?page=2&limit=5",
  );
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer server-only-test-token",
  );
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(
    (await response.text()).includes("server-only-test-token"),
    false,
  );
  assert.equal(
    (
      await PATCH(
        new Request(url, {
          method: "PATCH",
          headers: { origin: "https://studio.example.test" },
        }),
        context("notifications/507f1f77bcf86cd799439011/read"),
      )
    ).status,
    200,
  );
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  assert.equal(
    (await GET(new Request(url), context("notifications"))).status,
    503,
  );
  console.log(
    "Workspace proxy checks passed: endpoint allowlist, CSRF, authentication, token isolation, query allowlist, no-store, notification updates, and service failure.",
  );
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.workspaceTestAuth;
}
