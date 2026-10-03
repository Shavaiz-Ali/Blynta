import { spawn, execFileSync } from "node:child_process";
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const products = [
  ["apps/app", 3100, "blynta-main"],
  ["apps/admin", 3101, "blynta-admin"],
  ["apps/studio", 3102, "blynta-studio"],
  ["apps/auth", 3103, "identity"],
];
const backend = "http://localhost:5101";
const origins = {
  AUTH_APP_URL: "http://localhost:3103",
  MAIN_APP_URL: "http://localhost:3100",
  ADMIN_APP_URL: "http://localhost:3101",
  STUDIO_APP_URL: "http://localhost:3102",
};
const env = {
  ...process.env,
  ...origins,
  NODE_ENV: "development",
  CENTRAL_AUTH_ENABLED: "true",
  BACKEND_SERVICE_URL: backend,
  BACKEND_URL: backend,
  BLYNTA_APP_AUTH_SECRET: "synthetic-bound-main-secret-32-characters",
  BLYNTA_ADMIN_AUTH_SECRET: "synthetic-bound-admin-secret-32-characters",
  BLYNTA_STUDIO_AUTH_SECRET: "synthetic-bound-studio-secret-32-characters",
  BLYNTA_AUTH_SECRET: "synthetic-bound-identity-secret-32-characters",
  NEXT_PUBLIC_BACKEND_URL: backend,
  NEXT_PUBLIC_API_URL: backend,
  SSO_BRIDGE_SECRET: "synthetic-integration-bridge-secret",
  JWT_SECRET: "synthetic-integration-jwt-secret",
  GOOGLE_CLIENT_ID: "synthetic-google-client",
  GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
  FACEBOOK_CLIENT_ID: "synthetic-facebook-client",
  FACEBOOK_CLIENT_SECRET: "synthetic-facebook-secret",
  BLYNTA_TEST_FIXTURE: "true",
  TS_NODE_PREFER_TS_EXTS: "true",
  SSO_CLIENTS: JSON.stringify(
    Object.fromEntries(
      products
        .filter(([, , client]) =>
          ["blynta-main", "blynta-studio"].includes(client),
        )
        .map(([, port, client]) => [
          client,
          [`http://localhost:${port}/auth/callback`],
        ]),
    ),
  ),
};
const children = [];
mkdirSync(resolve(root, ".test-results"), { recursive: true });
function start(name, args, cwd, extra = {}) {
  const log = createWriteStream(
    resolve(root, ".test-results", `${name.replaceAll("/", "-")}.log`),
  );
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...extra },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push({ child, log });
  return child;
}
function stop() {
  for (const { child, log } of children.reverse()) {
    if (child.exitCode === null) {
      try {
        if (process.platform === "win32")
          execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            windowsHide: true,
            stdio: "ignore",
            timeout: 10000,
          });
        else child.kill("SIGTERM");
      } catch {
        child.kill();
      }
    }
    child.stdout.destroy();
    child.stderr.destroy();
    log.end();
    child.unref();
  }
  // Windows terminates Next child trees abruptly. Discard only generated development
  // types from these test servers so partially written files cannot poison later builds.
  for (const [app] of products)
    for (const name of ["routes.d.ts", "validator.ts", "link.d.ts"]) {
      const generated = resolve(root, app, ".next/dev/types", name);
      if (
        !generated.startsWith(resolve(root, app) + "/") &&
        !generated.startsWith(resolve(root, app) + "\\")
      )
        throw new Error("Invalid generated type path");
      if (existsSync(generated)) unlinkSync(generated);
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
async function ready(url) {
  const end = Date.now() + 240000;
  while (Date.now() < end) {
    if (children.some(({ child }) => child.exitCode !== null))
      throw new Error("A test server exited; inspect .test-results logs");
    try {
      const r = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`Service failed to start: ${url}`);
}

class Browser {
  cookies = new Map();
  async request(url, options = {}) {
    const target = new URL(url);
    const headers = new Headers(options.headers);
    // All test apps are on localhost. Browser cookies are scoped by host/path, not port.
    headers.set(
      "cookie",
      [...this.cookies]
        .filter(([, cookie]) => target.pathname.startsWith(cookie.path))
        .map(([name, cookie]) => `${name}=${cookie.value}`)
        .join("; "),
    );
    const response = await fetch(url, {
      ...options,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(180000),
    });
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attributes] = raw.split(";");
      const split = pair.indexOf("=");
      const name = pair.slice(0, split);
      if (
        pair.slice(split + 1) &&
        !attributes.some((a) => /max-age=0/i.test(a)) &&
        (name.endsWith("-session") ||
          name.endsWith("-transaction") ||
          name === "blynta-authorization")
      ) {
        assert.ok(
          attributes.some((a) => a.trim().toLowerCase() === "httponly"),
        );
        assert.ok(
          attributes.some((a) => a.trim().toLowerCase() === "samesite=lax"),
        );
        assert.ok(attributes.some((a) => a.trim().toLowerCase() === "path=/"));
        assert.ok(
          !attributes.some((a) => a.trim().toLowerCase().startsWith("domain=")),
        );
      }
      const value = pair.slice(split + 1);
      const cookiePath =
        attributes
          .find((a) => a.trim().toLowerCase().startsWith("path="))
          ?.trim()
          .slice(5) || "/";
      if (!value || attributes.some((a) => /max-age=0/i.test(a)))
        this.cookies.delete(name);
      else this.cookies.set(name, { value, path: cookiePath });
    }
    const location = response.headers.get("location");
    if (location) {
      const u = new URL(location, url);
      for (const name of [
        "token",
        "accessToken",
        "refreshToken",
        "sessionToken",
      ])
        if (
          name === "token" &&
          ["/forgot-password", "/reset-password"].includes(u.pathname)
        )
          continue;
        else
          assert.equal(
            u.searchParams.has(name),
            false,
            "Reusable credentials must never appear in redirects",
          );
    }
    return response;
  }
  async follow(response, base) {
    const location = response.headers.get("location");
    assert.ok(
      location,
      `Expected redirect, received ${response.status}: ${await response.text()}`,
    );
    return this.request(new URL(location, base).href);
  }
  async login(email = "existing@example.test", password = "Test-password-123") {
    const csrf = await (
      await this.request(`${origins.AUTH_APP_URL}/api/auth/csrf`)
    ).json();
    const response = await this.request(
      `${origins.AUTH_APP_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-auth-return-redirect": "1",
          origin: origins.AUTH_APP_URL,
        },
        body: new URLSearchParams({
          email,
          password,
          csrfToken: csrf.csrfToken,
          callbackUrl: `${origins.AUTH_APP_URL}/continue`,
        }),
      },
    );
    const result = await response.json();
    assert.ok(!result.url.includes("error="), "Credential login failed");
    return this.request(result.url);
  }
  async adminLogin(email = "admin@example.test", success = true) {
    const own = origins.ADMIN_APP_URL;
    const csrf = await (await this.request(own + "/api/auth/csrf")).json();
    const response = await this.request(
      own + "/api/auth/callback/credentials",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-auth-return-redirect": "1",
          origin: own,
        },
        body: new URLSearchParams({
          email,
          password: "Test-password-123",
          csrfToken: csrf.csrfToken,
          callbackUrl: own + "/",
        }),
      },
    );
    const result = await response.json();
    if (!success) return result;
    assert.ok(!result.url.includes("error="), "Admin credential login failed");
    const session = await (
      await this.request(own + "/api/auth/session")
    ).json();
    assert.equal(session.user?.role, "admin");
    return { session };
  }
  async logout(port) {
    const own = "http://localhost:" + port;
    const csrf = await (await this.request(own + "/api/auth/csrf")).json();
    return (
      await this.request(own + "/api/auth/signout", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-auth-return-redirect": "1",
          origin: own,
        },
        body: new URLSearchParams({
          csrfToken: csrf.csrfToken,
          callbackUrl:
            port === 3100 || port === 3102 ? "/signed-out" : "/login",
        }),
      })
    ).json();
  }
  async product(port, returnTo, login = false, email) {
    const origin = `http://localhost:${port}`;
    const start = await this.request(
      `${origin}/auth/start?returnTo=${encodeURIComponent(returnTo)}`,
    );
    const authorizeUrl = start.headers.get("location");
    assert.ok(authorizeUrl?.includes("/authorize?"));
    let authorization = await this.request(authorizeUrl);
    if (login) {
      assert.ok(authorization.headers.get("location")?.includes("/login"));
      const page = await this.follow(authorization, origins.AUTH_APP_URL);
      assert.equal(page.status, 200);
      authorization = await this.login(email);
      authorization = await this.follow(authorization, origins.AUTH_APP_URL);
    }
    const callbackUrl = authorization.headers.get("location");
    assert.ok(
      callbackUrl?.startsWith(origin + "/auth/callback?"),
      `Authorization failed (${authorization.status}): ${await authorization.text()}`,
    );
    const callback = await this.request(callbackUrl);
    const final = new URL(callback.headers.get("location") || "", origin);
    assert.equal(final.origin, origin);
    assert.equal(
      final.pathname + final.search,
      returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/dashboard",
    );
    const session = await (
      await this.request(`${origin}/api/auth/session`)
    ).json();
    assert.ok(session.user?.id);
    assert.ok(session.accessToken);
    assert.equal(session.sessionToken, undefined);
    return { session, callbackUrl };
  }
}

try {
  start(
    "backend",
    [
      "-r",
      "ts-node/register",
      "-r",
      "tsconfig-paths/register",
      "test/sso-fixture.ts",
    ],
    resolve(root, "backend"),
  );
  await ready(backend + "/health");
  for (const [app, port] of products)
    start(
      app,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      resolve(root, app),
      {
        AUTH_URL: `http://localhost:${port}`,
        AUTH_SECRET: `synthetic-unique-${app}-secret-32-characters`,
        NEXTAUTH_SECRET: `synthetic-unique-${app}-secret-32-characters`,
      },
    );
  await Promise.all(
    products.map(([, port]) => ready(`http://localhost:${port}/api/auth/csrf`)),
  );
  console.log(
    "PASS: all four frontend dev servers and isolated Nest backend started",
  );
  const discovery = new Browser();
  const consumerProviders = await (
    await discovery.request(origins.AUTH_APP_URL + "/api/auth/providers")
  ).json();
  assert.deepEqual(Object.keys(consumerProviders).sort(), [
    "credentials",
    "facebook",
    "google",
  ]);
  const enabledProviders = await (
    await discovery.request(origins.AUTH_APP_URL + "/api/providers")
  ).json();
  assert.ok(
    JSON.stringify(enabledProviders).includes("google") &&
      JSON.stringify(enabledProviders).includes("facebook"),
  );
  console.log(
    "PASS: central consumer Google/Facebook registration and enabled-provider discovery are retained",
  );
  for (const [app, port] of products.slice(0, 3)) {
    const anonymous = new Browser();
    const protectedPage = await anonymous.request(
      `http://localhost:${port}${port === 3101 ? "/" : "/dashboard"}?original=1`,
    );
    assert.equal(protectedPage.status, 307);
    assert.equal(
      new URL(protectedPage.headers.get("location"), `http://localhost:${port}`)
        .pathname,
      "/login",
    );
    const loginEntry = await anonymous.follow(
      protectedPage,
      `http://localhost:${port}`,
    );
    if (port === 3101) {
      assert.equal(loginEntry.status, 200);
      assert.ok((await loginEntry.text()).includes("Admin Portal"));
    } else
      assert.equal(
        new URL(loginEntry.headers.get("location"), "http://localhost:" + port)
          .pathname,
        "/auth/start",
      );
    const configured = await (
      await anonymous.request(`http://localhost:${port}/api/auth/providers`)
    ).json();
    assert.deepEqual(
      Object.keys(configured),
      port === 3101 ? ["credentials"] : ["blynta"],
    );
    console.log(
      `PASS: ${app} protects routes and exposes only central code exchange`,
    );
  }
  const standalone = new Browser();
  const standaloneContinuation = await standalone.login();
  assert.equal(standaloneContinuation.status, 307);
  assert.equal(
    standaloneContinuation.headers.get("location"),
    `${origins.MAIN_APP_URL}/auth/start`,
  );
  const standaloneStart = await standalone.follow(
    standaloneContinuation,
    origins.AUTH_APP_URL,
  );
  const standaloneAuthorization = await standalone.follow(
    standaloneStart,
    origins.MAIN_APP_URL,
  );
  const standaloneCallback = await standalone.follow(
    standaloneAuthorization,
    origins.AUTH_APP_URL,
  );
  assert.equal(
    standaloneCallback.headers.get("location"),
    `${origins.MAIN_APP_URL}/dashboard`,
  );
  const standaloneSession = await (
    await standalone.request(`${origins.MAIN_APP_URL}/api/auth/session`)
  ).json();
  assert.equal(standaloneSession.user?.email, "existing@example.test");
  assert.equal(
    (await standalone.request(origins.ADMIN_APP_URL + "/")).status,
    307,
  );
  console.log(
    "PASS: standalone Auth login → continue → Main dashboard session",
  );
  const studio = new Browser();
  const first = await studio.product(3102, "/dashboard?source=original", true);
  assert.equal(first.session.user.email, "existing@example.test");
  console.log(
    "PASS: Studio → Auth → email/password → original Studio destination",
  );
  const main = await studio.product(3100, "/dashboard?source=sso");
  assert.equal(main.session.user.id, first.session.user.id);
  console.log(
    "PASS: Studio → Main SSO reuses identity without another credential prompt",
  );
  await studio.product(3102, "/editor/synthetic-project?panel=timeline");
  console.log("PASS: original Studio editor destination survives central SSO");
  const securityStart = await studio.request(
    `${origins.STUDIO_APP_URL}/auth/start`,
  );
  const transaction = [...studio.cookies].find(([name]) =>
    name.endsWith("blynta-studio-transaction"),
  );
  assert.ok(
    transaction && transaction[1].value.split(".").length === 5,
    "Transaction must be encrypted JWE",
  );
  const securityAuthorization = await studio.follow(
    securityStart,
    origins.STUDIO_APP_URL,
  );
  const securityCallback = new URL(
    securityAuthorization.headers.get("location"),
  );
  for (const state of [null, "wrong-state"]) {
    const changed = new URL(securityCallback);
    if (state === null) changed.searchParams.delete("state");
    else changed.searchParams.set("state", state);
    assert.equal((await studio.request(changed.href)).status, 400);
  }
  const savedTransaction = transaction[1].value;
  transaction[1].value = "tampered-transaction";
  assert.equal((await studio.request(securityCallback.href)).status, 400);
  transaction[1].value = savedTransaction;
  await studio.request(securityCallback.href);
  console.log(
    "PASS: missing/wrong callback state and tampered transaction fail before session establishment",
  );
  const csrfAttempt = await new Browser().request(
    `${origins.AUTH_APP_URL}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-auth-return-redirect": "1",
      },
      body: new URLSearchParams({
        email: "existing@example.test",
        password: "Test-password-123",
      }),
    },
  );
  assert.ok((await csrfAttempt.json()).url.includes("MissingCSRF"));
  console.log("PASS: credential login requires Auth.js CSRF protection");
  const normalAdmin = await studio.adminLogin("existing@example.test", false);
  assert.ok(normalAdmin.url.includes("error="));
  assert.equal(
    (
      await (
        await studio.request(origins.ADMIN_APP_URL + "/api/auth/session")
      ).json()
    )?.user,
    undefined,
  );
  assert.equal((await studio.request(origins.ADMIN_APP_URL + "/")).status, 307);
  assert.equal(
    (
      await fetch(backend + "/admin/probe", {
        headers: { authorization: "Bearer " + main.session.accessToken },
      })
    ).status,
    403,
  );
  console.log(
    "PASS: consumer identity cannot establish Admin session or enter Admin UI/API",
  );
  const direct = await new Browser().request(first.callbackUrl);
  assert.equal(direct.status, 400);
  const replay = await studio.request(first.callbackUrl);
  assert.equal(replay.status, 400);
  console.log(
    "PASS: missing transaction, manipulated callback and consumed transaction rejected",
  );
  await studio.product(3102, "https://malicious.example/path");
  console.log(
    "PASS: external return destination replaced with safe relative fallback",
  );

  console.log("CHECK: signup authorization");
  const newUser = new Browser();
  const signupStart = await newUser.request(
    "http://localhost:3102/auth/start?screen=signup&returnTo=%2Fdashboard",
  );
  const signupAuth = await newUser.follow(signupStart, origins.STUDIO_APP_URL);
  assert.ok(signupAuth.headers.get("location")?.includes("/signup"));
  console.log("CHECK: backend signup");
  const signup = await fetch(backend + "/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "signup@example.test",
      name: "Signup Fixture",
      password: "Test-password-123",
    }),
  });
  assert.equal(signup.status, 201);
  console.log("CHECK: backend email verification");
  const otp = (await (await fetch(backend + "/test/otp")).json()).data.otp;
  const verify = await fetch(backend + "/auth/verify-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "signup@example.test", otp }),
  });
  assert.equal(verify.status, 201);
  const otpReplay = await fetch(backend + "/auth/verify-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "signup@example.test", otp }),
  });
  assert.equal(otpReplay.status, 400);
  console.log("CHECK: signup session handoff");
  let continuation = await newUser.login("signup@example.test");
  continuation = await newUser.follow(continuation, origins.AUTH_APP_URL);
  const signupCallback = await newUser.follow(
    continuation,
    origins.STUDIO_APP_URL,
  );
  assert.ok(signupCallback.headers.get("location")?.endsWith("/dashboard"));
  console.log(
    "PASS: product signup → existing OTP verification → central login → product callback",
  );
  const requestReset = async (email) =>
    fetch(backend + "/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  const resetResponse = await (
    await requestReset("signup@example.test")
  ).json();
  const unknownResponse = await (
    await requestReset("unknown@example.test")
  ).json();
  assert.deepEqual(resetResponse.data, unknownResponse.data);
  const resetToken = (await (await fetch(backend + "/test/reset-token")).json())
    .data.token;
  const legacyResetLink = await newUser.request(
    `${origins.MAIN_APP_URL}/forgot-password?token=${resetToken}`,
  );
  assert.equal(
    new URL(legacyResetLink.headers.get("location")).origin,
    origins.AUTH_APP_URL,
  );
  const centralLegacyReset = await newUser.follow(
    legacyResetLink,
    origins.MAIN_APP_URL,
  );
  assert.equal(
    new URL(centralLegacyReset.headers.get("location"), origins.AUTH_APP_URL)
      .pathname,
    "/reset-password",
  );
  const originalMailLink = await newUser.request(
    `${origins.MAIN_APP_URL}/reset-password?token=${resetToken}`,
  );
  assert.equal(
    new URL(originalMailLink.headers.get("location")).pathname,
    "/reset-password",
  );
  assert.equal(
    new URL(originalMailLink.headers.get("location")).origin,
    origins.AUTH_APP_URL,
  );
  assert.equal(
    (await newUser.follow(centralLegacyReset, origins.AUTH_APP_URL)).status,
    200,
  );
  assert.equal(
    (
      await newUser.request(
        `${origins.AUTH_APP_URL}/verify-email?email=signup%40example.test`,
      )
    ).status,
    200,
  );
  const reset = async () =>
    fetch(backend + "/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        newPassword: "Reset-password-456",
      }),
    });
  const resetResults = await Promise.all([reset(), reset()]);
  assert.deepEqual(resetResults.map((r) => r.status).sort(), [201, 400]);
  assert.equal((await reset()).status, 400);
  const invalidated = await (
    await newUser.request(`${origins.STUDIO_APP_URL}/api/auth/session`)
  ).json();
  assert.equal(invalidated?.user, undefined);
  await newUser.login("signup@example.test", "Reset-password-456");
  await newUser.product(3102, "/dashboard");
  console.log(
    "PASS: recovery compatibility, non-enumerating response, reset single-use, session revocation and new password login",
  );

  const administrator = new Browser();
  const privileged = await administrator.adminLogin();
  assert.equal(privileged.session.user.role, "admin");
  const privilegedPage = await administrator.request(
    origins.ADMIN_APP_URL + "/",
  );
  assert.equal(privilegedPage.status, 200);
  assert.ok((await privilegedPage.text()).includes("Blynta Admin"));
  assert.equal(
    (
      await fetch(backend + "/admin/probe", {
        headers: { authorization: `Bearer ${privileged.session.accessToken}` },
      })
    ).status,
    200,
  );
  console.log(
    "PASS: Admin credentials → independent session → authoritative admin authorization",
  );
  await fetch(backend + "/test/admin-role?role=user");
  assert.equal(
    (
      await (
        await administrator.request(origins.ADMIN_APP_URL + "/api/auth/session")
      ).json()
    )?.user,
    undefined,
  );
  assert.equal(
    (await administrator.request(origins.ADMIN_APP_URL + "/")).status,
    307,
  );
  assert.equal(
    (
      await fetch(backend + "/admin/probe", {
        headers: { authorization: "Bearer " + privileged.session.accessToken },
      })
    ).status,
    401,
  );
  await fetch(backend + "/test/admin-role?role=admin");
  console.log(
    "PASS: current role removal invalidates Admin session, UI and previously issued API token",
  );
  const mainBrowser = new Browser();
  await mainBrowser.product(3100, "/dashboard", true);
  console.log("PASS: Main → Auth → email/password → Main");
  await mainBrowser.product(3102, "/dashboard?source=main");
  console.log("PASS: Main → Studio SSO without another credential prompt");
  const invalid = await mainBrowser.request(
    origins.AUTH_APP_URL +
      "/authorize?response_type=code&client_id=blynta-main&redirect_uri=https%3A%2F%2Fevil.example%2Fcallback&state=" +
      "s".repeat(43) +
      "&code_challenge=" +
      "a".repeat(43) +
      "&code_challenge_method=S256",
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("location"), null);
  const anonymousInvalid = await new Browser().request(
    new URL("/authorize" + new URL(invalid.url).search, origins.AUTH_APP_URL)
      .href,
  );
  assert.equal(anonymousInvalid.status, 400);
  console.log("PASS: authorization endpoint refuses an unregistered callback");
  await studio.logout(3103);
  assert.equal(
    (
      await (
        await studio.request(origins.STUDIO_APP_URL + "/api/auth/session")
      ).json()
    )?.user,
    undefined,
  );
  assert.equal(
    (
      await fetch(backend + "/users/me", {
        headers: { authorization: "Bearer " + main.session.accessToken },
      })
    ).status,
    401,
  );
  await studio.product(3100, "/dashboard", true);
  console.log(
    "PASS: explicit central logout revokes consumer sessions and permits fresh login",
  );
  const post = (path, body, headers = {}) =>
    fetch(backend + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const identity = (
    await (
      await post(
        "/auth/sso/login",
        {
          email: "logout-security@example.test",
          password: "Test-password-123",
        },
        { "x-blynta-auth-bridge": env.SSO_BRIDGE_SECRET },
      )
    ).json()
  ).data;
  const verifier = "v".repeat(43);
  const grant = (
    await (
      await post("/auth/sso/authorize", {
        sessionToken: identity.sessionToken,
        client_id: "blynta-main",
        redirect_uri: `${origins.MAIN_APP_URL}/auth/callback`,
        response_type: "code",
        state: "s".repeat(43),
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      })
    ).json()
  ).data;
  const exchange = {
    grant_type: "authorization_code",
    code: grant.code,
    client_id: "blynta-main",
    redirect_uri: `${origins.MAIN_APP_URL}/auth/callback`,
    code_verifier: verifier,
  };
  const missingVerifier = { ...exchange };
  delete missingVerifier.code_verifier;
  assert.equal((await post("/auth/sso/token", missingVerifier)).status, 400);
  assert.equal(
    (
      await post("/auth/sso/token", {
        ...exchange,
        code_verifier: "w".repeat(43),
      })
    ).status,
    400,
  );
  assert.equal((await post("/auth/sso/token", exchange)).status, 201);
  assert.equal((await post("/auth/sso/token", exchange)).status, 400);
  console.log(
    "PASS: HTTP exchange rejects missing/wrong PKCE verifier and replay; correct verifier succeeds",
  );
  for (const [name, port] of [
    ["app", 3100],
    ["studio", 3102],
    ["admin", 3101],
    ["auth", 3103],
  ]) {
    const browser = new Browser();
    const app = await browser.product(
      3100,
      "/dashboard",
      true,
      "logout-" + name + "@example.test",
    );
    const studioSession = await browser.product(3102, "/dashboard");
    const admin = await browser.adminLogin();
    // Two tabs share the browser cookie jar; each revalidates its own product.
    const secondTab = new Browser();
    secondTab.cookies = browser.cookies;
    const result = await browser.logout(port);
    if (port === 3100 || port === 3102) {
      assert.ok(result.url.endsWith("/signed-out"));
      assert.equal((await browser.request(result.url)).status, 200);
    }
    for (const [testPort, alive] of [
      [3100, port !== 3100 && port !== 3103],
      [3102, port !== 3102 && port !== 3103],
      [3101, port !== 3101],
      [3103, port !== 3103],
    ]) {
      const session = await (
        await secondTab.request(
          "http://localhost:" + testPort + "/api/auth/session",
        )
      ).json();
      assert.equal(
        !!session?.user,
        alive,
        name + " logout affected port " + testPort,
      );
    }
    for (const [token, alive] of [
      [app.session.accessToken, port !== 3100 && port !== 3103],
      [studioSession.session.accessToken, port !== 3102 && port !== 3103],
      [admin.session.accessToken, port !== 3101],
    ]) {
      assert.equal(
        (
          await fetch(backend + "/users/me", {
            headers: { authorization: "Bearer " + token },
          })
        ).status,
        alive ? 200 : 401,
      );
    }
    if (port === 3100 || port === 3102)
      await browser.product(port, "/dashboard");
    console.log(
      "PASS: " +
        name +
        " logout isolation across two shared-cookie tabs, issued API tokens and silent consumer re-entry",
    );
  }
  const malformed = new Browser();
  malformed.cookies.set("blynta-admin-session", {
    value: "malformed",
    path: "/",
  });
  assert.equal(
    (await malformed.request(origins.ADMIN_APP_URL + "/")).status,
    307,
  );
  console.log("PASS: malformed Admin cookie fails closed");
  console.log(
    "All isolated HTTP auth boundary checks passed. Real OAuth consent and deployment remain manual checks.",
  );
} finally {
  stop();
}
