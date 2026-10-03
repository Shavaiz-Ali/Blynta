import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  callIdentity,
  IdentityRequestError,
} from "../../packages/auth/src/identity-client.ts";

await test("Identity transport", async (t) => {
  const previous = Object.fromEntries(
    [
      "BACKEND_SERVICE_URL",
      "BACKEND_URL",
      "NEXT_PUBLIC_BACKEND_URL",
      "SSO_BRIDGE_SECRET",
      "NODE_ENV",
    ].map((key) => [key, process.env[key]]),
  );
  let status = 200;
  let body = { success: true, data: { id: "synthetic-user" } };
  let raw;
  const server = createServer((request, response) => {
    assert.equal(request.url, "/auth/sso/login");
    assert.equal(request.headers["x-blynta-auth-bridge"], "synthetic-bridge");
    response.writeHead(status, { "content-type": "application/json" });
    response.end(raw ?? JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.BACKEND_URL = `http://127.0.0.1:${server.address().port}`;
  delete process.env.BACKEND_SERVICE_URL;
  process.env.SSO_BRIDGE_SECRET = "synthetic-bridge";
  const credentials = {
    email: "synthetic@example.invalid",
    password: "synthetic-password",
  };
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await t.test(
    "a successful backend response keeps the identity contract",
    async () => {
      assert.deepEqual(await callIdentity("sso/login", credentials, true), {
        id: "synthetic-user",
      });
    },
  );
  await t.test(
    "runtime binding wins over the public URL and permits internal HTTP in production",
    async () => {
      const backend = process.env.BACKEND_URL;
      const mode = process.env.NODE_ENV;
      process.env.BACKEND_SERVICE_URL = backend;
      process.env.BACKEND_URL = "https://unreachable.example.invalid";
      process.env.NODE_ENV = "production";
      try {
        assert.deepEqual(await callIdentity("sso/login", credentials, true), {
          id: "synthetic-user",
        });
        delete process.env.BACKEND_SERVICE_URL;
        process.env.BACKEND_URL = backend;
        await assert.rejects(callIdentity("sso/login", credentials, true), {
          code: "backend_configuration",
        });
      } finally {
        delete process.env.BACKEND_SERVICE_URL;
        process.env.BACKEND_URL = backend;
        if (mode === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = mode;
      }
    },
  );
  for (const [httpStatus, backendCode, expectedCode] of [
    [401, "INVALID_CREDENTIALS", "invalid_credentials"],
    [401, "UNAUTHORIZED", "backend_configuration"],
    [404, "NOT_FOUND", "backend_configuration"],
    [429, "TOO_MANY_REQUESTS", "rate_limited"],
    [503, "INTERNAL_ERROR", "backend_unavailable"],
    [403, "FORBIDDEN", "authentication_failed"],
  ]) {
    await t.test(
      `HTTP ${httpStatus}/${backendCode} remains distinguishable from a bad password`,
      async () => {
        status = httpStatus;
        body = {
          success: false,
          error: {
            code: backendCode,
            message: credentials.password + process.env.SSO_BRIDGE_SECRET,
          },
        };
        await assert.rejects(
          callIdentity("sso/login", credentials, true),
          (error) => {
            assert.ok(error instanceof IdentityRequestError);
            assert.equal(error.code, expectedCode);
            assert.equal(error.status, httpStatus);
            assert.equal(
              (error.message + JSON.stringify(error)).includes(
                credentials.password,
              ),
              false,
            );
            assert.equal(
              (error.message + JSON.stringify(error)).includes(
                process.env.SSO_BRIDGE_SECRET,
              ),
              false,
            );
            return true;
          },
        );
      },
    );
  }
  await t.test(
    "malformed upstream responses do not masquerade as invalid credentials",
    async () => {
      status = 200;
      raw = "<html>not an identity response</html>";
      await assert.rejects(callIdentity("sso/login", credentials, true), {
        code: "backend_unavailable",
      });
      raw = undefined;
    },
  );
  await t.test(
    "missing bridge configuration fails before sending credentials",
    async () => {
      delete process.env.SSO_BRIDGE_SECRET;
      await assert.rejects(callIdentity("sso/login", credentials, true), {
        code: "backend_configuration",
      });
      process.env.SSO_BRIDGE_SECRET = "synthetic-bridge";
    },
  );
  await t.test("connection errors are service outages", async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await assert.rejects(callIdentity("sso/login", credentials, true), {
      code: "backend_unavailable",
    });
  });
  await t.test(
    "unsafe backend URLs are rejected before credentials are sent",
    async () => {
      for (const backend of [
        "http://remote.example",
        "https://user:password@example.test",
        "https://example.test?secret=1",
      ]) {
        process.env.BACKEND_URL = backend;
        await assert.rejects(callIdentity("sso/login", credentials, true), {
          code: "backend_configuration",
        });
      }
    },
  );
});
