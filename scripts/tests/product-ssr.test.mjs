import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

// Exercise real production bundles with encrypted product cookies and a synthetic
// identity backend. No production accounts or credentials are used.
for (const [app, client, route, secretName] of [
  ["app", "blynta-main", "/dashboard", "BLYNTA_APP_AUTH_SECRET"],
  ["studio", "blynta-studio", "/home", "BLYNTA_STUDIO_AUTH_SECRET"],
]) {
  test(`${app}: authenticated production SSR survives identity failures`, async (t) => {
    const root = new URL(`../../apps/${app}/`, import.meta.url);
    const require = createRequire(new URL("package.json", root));
    const { encode } = await import(
      pathToFileURL(require.resolve("next-auth/jwt"))
    );
    const secret = `synthetic-${app}-secret-for-production-ssr-regression`;
    let status = 200;
    let disconnect = false;
    const backend = createServer((request, response) => {
      if (disconnect) return request.socket.destroy();
      response.writeHead(status, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          status === 200
            ? {
                success: true,
                data: {
                  id: "synthetic-user",
                  email: "ssr@example.invalid",
                  role: "user",
                  accessToken: "synthetic-access",
                  accessTokenExpires: Date.now() + 300000,
                },
              }
            : {
                success: false,
                error: { code: "UPSTREAM_ERROR", message: "Unavailable" },
              },
        ),
      );
    });
    await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
    const portProbe = createServer();
    await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
    const port = portProbe.address().port;
    await new Promise((resolve) => portProbe.close(resolve));
    const origin = `http://localhost:${port}`;
    let logs = "";
    const child = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "start", "-p", String(port)],
      {
        cwd: fileURLToPath(root),
        env: {
          ...process.env,
          NODE_ENV: "production",
          CENTRAL_AUTH_ENABLED: "true",
          AUTH_TRUST_HOST: "true",
          [secretName]: secret,
          MAIN_APP_URL: "https://app.blynta.com",
          STUDIO_APP_URL: "https://studio.blynta.com",
          AUTH_APP_URL: "https://auth.blynta.com",
          BACKEND_SERVICE_URL: `http://127.0.0.1:${backend.address().port}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    t.after(async () => {
      child.kill();
      backend.closeAllConnections();
      await new Promise((resolve) => backend.close(resolve));
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`${origin}/api/auth/session`);
        ready = true;
        break;
      } catch {}
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, logs);
    const name = `__Host-blynta-${client}-session`;
    const cookie = `${name}=${await encode({
      secret,
      salt: name,
      maxAge: 3600,
      token: {
        id: "synthetic-user",
        email: "ssr@example.invalid",
        role: "user",
        sessionToken: "synthetic-opaque-session",
        expiresAt: Date.now() + 3600000,
        accessToken: "synthetic-access",
        accessTokenExpires: Date.now() + 300000,
      },
    })}`;
    for (const scenario of [
      "healthy",
      "disconnected",
      403,
      429,
      500,
      502,
      503,
    ]) {
      await t.test(String(scenario), async () => {
        status = typeof scenario === "number" ? scenario : 200;
        disconnect = scenario === "disconnected";
        const options = { headers: { cookie }, redirect: "manual" };
        const sessionResponse = await fetch(
          `${origin}/api/auth/session`,
          options,
        );
        assert.equal(sessionResponse.status, 200);
        const session = await sessionResponse.json();
        assert.equal(session.user.id, "synthetic-user");
        if (scenario !== "healthy") {
          assert.equal(session.authError, "service_unavailable");
          assert.equal(session.accessToken, undefined);
        } else assert.equal(session.accessToken, "synthetic-access");
        const response = await fetch(origin + route, options);
        const html = await response.text();
        assert.equal(response.status, 200, logs);
        assert.equal(response.headers.get("location"), null);
        assert.doesNotMatch(html, /"digest"\s*:/);
      });
    }
    disconnect = false;
    status = 401;
    await t.test("revoked session still requires sign-in", async () => {
      const response = await fetch(origin + route, {
        headers: { cookie },
        redirect: "manual",
      });
      assert.equal(response.status, 307);
      assert.match(response.headers.get("location"), /^\/auth\/start\?/);
    });
    assert.doesNotMatch(
      logs,
      /Cannot read properties of undefined|Invalid hook call/,
    );
  });
}
