import test from "node:test";
import assert from "node:assert/strict";
import { backendUrl } from "../../packages/auth/src/backend.ts";
const names = [
  "BACKEND_SERVICE_URL",
  "BACKEND_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_API_URL",
];
function withBinding(value, callback) {
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  names.forEach((name) => delete process.env[name]);
  if (value !== undefined) process.env.BACKEND_SERVICE_URL = value;
  try {
    callback();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}
test("backend service URLs accept trusted internal HTTP and external HTTPS bindings", () => {
  withBinding("http://127.0.0.1:5001/", () =>
    assert.equal(backendUrl(), "http://127.0.0.1:5001"),
  );
  withBinding("https://backend.example.test/", () =>
    assert.equal(backendUrl(), "https://backend.example.test"),
  );
});
test("backend URL errors do not echo embedded credentials", () => {
  for (const value of [
    "file:///secret",
    "https://user:secret@backend.example.test",
    "invalid-url",
  ])
    withBinding(value, () => {
      assert.throws(
        backendUrl,
        (error) =>
          !String(error).includes("user:secret") &&
          /valid HTTP/.test(String(error)),
      );
    });
});
