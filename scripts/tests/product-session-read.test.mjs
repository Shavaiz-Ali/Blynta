import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readProductSession,
  SessionUnavailableError,
} from "../../packages/auth/src/session-read.ts";

test("session polling distinguishes verified logout from transport and HTTP failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const failure of [
    new Error("ECONNREFUSED"),
    new Error("TimeoutError"),
    401,
    403,
    429,
    500,
    502,
    503,
    "<html>gateway error</html>",
    {},
    false,
  ]) {
    globalThis.fetch = async () => {
      if (failure instanceof Error) throw failure;
      if (typeof failure === "number")
        return new Response("failure", { status: failure });
      return new Response(
        typeof failure === "string" ? failure : JSON.stringify(failure),
      );
    };
    await assert.rejects(
      readProductSession(),
      (error) =>
        error instanceof SessionUnavailableError && error.status === 503,
    );
  }
  globalThis.fetch = async () => Response.json(null);
  assert.equal(await readProductSession(), null);
  for (const session of [
    { user: { id: "test" } },
    { user: { id: "test" }, authError: "service_unavailable" },
  ]) {
    globalThis.fetch = async () => Response.json(session);
    assert.deepEqual(await readProductSession(), session);
  }
});
