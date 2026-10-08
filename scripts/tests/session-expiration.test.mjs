import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionState } from "../../packages/auth/src/session-state.ts";
import { createApiClient } from "../../packages/api-client/src/index.ts";

test("five simultaneous 401s produce one expiration and one fresh sign-in action", async () => {
  const state = createSessionState();
  let notifications = 0;
  state.subscribe(() => notifications++);
  let resolutions = 0;
  let requests = 0;
  const client = createApiClient(
    "https://api.example.test",
    async () => {
      const call = ++resolutions;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return call === 1 ? "old-access-token" : undefined;
    },
    {
      onExpired: () => state.expire("/my-clips/123?panel=clips"),
      isBlocked: () => state.getSnapshot() !== "active",
    },
  );
  client.defaults.adapter = async (config) => {
    requests++;
    throw {
      config,
      response: {
        status: 401,
        data: {
          success: false,
          error: { message: "Expired", code: "SESSION_EXPIRED" },
        },
      },
    };
  };
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => client.get("/jobs")),
  );
  assert.ok(
    results.every((r) => r.status === "rejected" && r.reason.status === 401),
  );
  assert.equal(state.getSnapshot(), "expired");
  assert.equal(notifications, 1);
  assert.equal(resolutions, 2, "one initial lookup, one shared refresh");
  assert.equal(requests, 5);
  await assert.rejects(client.post("/jobs"), (error) => error.status === 401);
  assert.equal(requests, 5, "authenticated actions blocked before transport");
  assert.equal(
    state.beginAuthorization(),
    "/auth/start?returnTo=%2Fmy-clips%2F123%3Fpanel%3Dclips",
  );
  assert.equal(state.beginAuthorization(), null);
  assert.equal(notifications, 2);
});

test("403 never expires the session or refreshes authentication", async () => {
  const state = createSessionState();
  let resolutions = 0;
  const client = createApiClient(
    "https://api.example.test",
    async () => {
      resolutions++;
      return "token";
    },
    { onExpired: () => state.expire("/billing"), isBlocked: () => false },
  );
  client.defaults.adapter = async (config) => {
    throw { config, response: { status: 403, data: {} } };
  };
  await assert.rejects(client.get("/admin"), (error) => error.status === 403);
  assert.equal(state.getSnapshot(), "active");
  assert.equal(resolutions, 1);
});

test("valid requests and a refreshed API token leave product session active", async () => {
  const state = createSessionState();
  let lookup = 0;
  const client = createApiClient(
    "https://api.example.test",
    async () => (++lookup === 1 ? "stale" : "fresh"),
    {
      onExpired: () => state.expire("/my-clips/123"),
      isBlocked: () => state.getSnapshot() !== "active",
    },
  );
  let requests = 0;
  client.defaults.adapter = async (config) => {
    requests++;
    if (config.headers.get("Authorization") === "Bearer stale")
      throw { config, response: { status: 401, data: {} } };
    return {
      config,
      status: 200,
      statusText: "OK",
      headers: {},
      data: { success: true, data: { id: "123" } },
    };
  };
  assert.deepEqual((await client.get("/jobs")).data, { id: "123" });
  assert.equal(requests, 2);
  assert.equal(state.getSnapshot(), "active");
});

test("a rejected refreshed token expires once without a retry loop", async () => {
  const state = createSessionState();
  let requests = 0;
  const client = createApiClient(
    "https://api.example.test",
    async () => "invalid",
    {
      onExpired: () => state.expire("/dashboard"),
      isBlocked: () => state.getSnapshot() !== "active",
    },
  );
  client.defaults.adapter = async (config) => {
    requests++;
    throw { config, response: { status: 401, data: {} } };
  };
  await assert.rejects(client.get("/jobs"), (error) => error.status === 401);
  assert.equal(requests, 2);
  assert.equal(state.getSnapshot(), "expired");
});

import { safeReturnTo } from "../../packages/auth/src/return-to.ts";
test("return destinations reject external and auth-loop URLs while retaining nested queries", () => {
  for (const input of [
    "https://evil.example",
    "//evil.example",
    "/%2f%2fevil.example",
    "/\\evil.example",
    "/auth/callback?code=stale",
    "/login",
    "/%61uth/start",
    "/path%00",
    "/%invalid",
  ])
    assert.equal(safeReturnTo(input), "/dashboard");
  assert.equal(
    safeReturnTo("/my-clips/123?panel=clips"),
    "/my-clips/123?panel=clips",
  );
});

test("shared clients without expiration callbacks still attach bearer credentials", async () => {
  const client = createApiClient(
    "https://api.example.test",
    async () => "admin-token",
  );
  client.defaults.adapter = async (config) => {
    assert.equal(config.headers.get("Authorization"), "Bearer admin-token");
    return {
      config,
      status: 200,
      statusText: "OK",
      headers: {},
      data: { success: true, data: true },
    };
  };
  assert.equal((await client.get("/admin")).data, true);
});

test("anonymous authentication endpoints do not expire the product session", async () => {
  const state = createSessionState();
  const client = createApiClient(
    "https://api.example.test",
    async () => {
      throw Error("Public endpoint must not request a session");
    },
    {
      onExpired: () => state.expire("/login"),
      isBlocked: () => false,
      requiresAuthentication: (config) => !config.url.startsWith("/auth/"),
    },
  );
  client.defaults.adapter = async (config) => {
    throw { config, response: { status: 401, data: {} } };
  };
  await assert.rejects(
    client.post("/auth/login"),
    (error) => error.status === 401,
  );
  assert.equal(state.getSnapshot(), "active");
});
