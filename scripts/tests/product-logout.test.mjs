import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const ts = require("typescript");
const source = readFileSync(
  new URL("../../packages/auth/src/client.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

function client(signOut) {
  const exports = {};
  const navigation = [];
  runInNewContext(compiled, {
    exports,
    require: () => ({ signOut }),
    window: { location: { assign: (path) => navigation.push(path) } },
  });
  return { ...exports, navigation };
}

test("logout suppresses competing session redirects and ignores a stale signed-out callback", async () => {
  let complete;
  const calls = [];
  const api = client((options) => {
    calls.push(options);
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const pending = api.logoutProduct();
  assert.equal(api.isProductLogoutInProgress(), true);
  assert.equal(api.navigation.length, 0);
  api.redirectProductSessionLoss();
  assert.equal(api.navigation.length, 0);
  await api.logoutProduct();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    redirect: false,
    redirectTo: "/auth/logged-out",
  });
  complete({ url: "/signed-out" });
  await pending;
  assert.deepEqual(api.navigation, ["/auth/logged-out"]);
  assert.equal(api.isProductLogoutInProgress(), true);
});

test("a failed sign-out does not navigate and releases the logout guard for retry", async () => {
  const api = client(() => Promise.reject(new Error("network failure")));
  await assert.rejects(api.logoutProduct(), /network failure/);
  assert.equal(api.isProductLogoutInProgress(), false);
  assert.deepEqual(api.navigation, []);
});

test("session loss in another tab navigates to the logout landing without restarting SSO or signing out again", () => {
  const api = client(() =>
    assert.fail("Session loss must not revoke another session"),
  );
  api.redirectProductSessionLoss();
  assert.deepEqual(api.navigation, ["/auth/logged-out"]);
});
