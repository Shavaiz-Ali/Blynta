import "./types";
import { callIdentity, IdentityRequestError } from "./identity-client";
import { authSecret } from "./backend";
export { callIdentity, IdentityRequestError } from "./identity-client";
import NextAuth, { AuthError, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode, decode } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { safeReturnTo } from "./return-to";
export { safeReturnTo } from "./return-to";

export function configuredUrl(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(`Invalid ${name}`);
  return url;
}

/** Auth.js redirects locally first; only configured consumer origins are used. */
export function productLogoutLanding(product: "main" | "studio") {
  return function GET() {
    const destination = new URL(
      "/product-logout",
      configuredUrl("AUTH_APP_URL"),
    );
    destination.searchParams.set("from", product);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}

type BackendSession = {
  id: string;
  email: string;
  role: string;
  sessionToken: string;
  accessToken: string;
  accessTokenExpires: number;
  expiresAt: number;
  sessionKind?: "consumer" | "admin";
};
type Transaction = {
  state: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
  clientId: string;
  redirectUri: string;
};
const cookieName = (clientId: string, state: string) =>
  `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-${clientId}-transaction-${state}`;
const options = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
});
const transactionSecret = (clientId: string) => {
  const secret = authSecret(clientId);
  if (!secret || secret.startsWith("replace-with-"))
    throw new Error(
      "Configure an independent AUTH_SECRET for this application",
    );
  return secret;
};

export function startAuthorization(
  clientId: string,
  appEnv: string,
  fallback = "/dashboard",
) {
  return async function GET(request: Request) {
    const own = configuredUrl(appEnv);
    const central = configuredUrl("AUTH_APP_URL");
    const requestUrl = new URL(request.url);
    const params = requestUrl.searchParams;
    // Set the transaction on the callback host, never a preview/alias host.
    if (requestUrl.origin !== own.origin) {
      const canonical = new URL("/auth/start", own);
      canonical.search = params.toString();
      return NextResponse.redirect(canonical);
    }
    let restartReturnTo = fallback;
    if (params.has("restart"))
      restartReturnTo = await authorizationReturnTo(
        clientId,
        params.get("restart"),
      );
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const transaction: Transaction = {
      state,
      verifier,
      returnTo: safeReturnTo(
        params.get("returnTo") || params.get("callbackUrl"),
        restartReturnTo,
      ),
      expiresAt: Date.now() + 600000,
      clientId,
      redirectUri: new URL("/auth/callback", own).href,
    };
    const authorize = new URL("/authorize", central);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: transaction.redirectUri,
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    if (params.get("screen") === "signup")
      authorize.searchParams.set("screen", "signup");
    if (params.get("ref"))
      authorize.searchParams.set("ref", params.get("ref")!);
    const response = NextResponse.redirect(authorize);
    const prefix = cookieName(clientId, "");
    const existing = (await cookies())
      .getAll()
      .filter((cookie) => cookie.name.startsWith(prefix));
    // Bound abandoned attempts without overwriting another active tab.
    for (const cookie of existing.slice(0, Math.max(0, existing.length - 3)))
      response.cookies.set(cookie.name, "", { ...options(), maxAge: 0 });
    response.cookies.set(
      cookieName(clientId, state),
      await encode({
        token: { ...transaction },
        secret: transactionSecret(clientId),
        salt: cookieName(clientId, state),
        maxAge: 600,
      }),
      options(),
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
}

async function readTransaction(
  clientId: string,
  state: unknown,
): Promise<Transaction> {
  if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state))
    throw new Error("Invalid transaction");
  const raw = (await cookies()).get(cookieName(clientId, state))?.value;
  if (!raw) throw new Error("Invalid transaction");
  const decoded = await decode({
    token: raw,
    secret: transactionSecret(clientId),
    salt: cookieName(clientId, state),
  });
  if (
    !decoded ||
    typeof decoded.state !== "string" ||
    typeof decoded.verifier !== "string" ||
    typeof decoded.returnTo !== "string" ||
    typeof decoded.expiresAt !== "number" ||
    typeof decoded.redirectUri !== "string"
  )
    throw new Error("Invalid transaction");
  const transaction = decoded as unknown as Transaction;
  const expected = Buffer.from(transaction.state);
  const received = Buffer.from(state);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received) ||
    transaction.expiresAt <= Date.now() ||
    transaction.clientId !== clientId
  )
    throw new Error("Invalid transaction");
  return transaction;
}

/** Per-product Auth.js encrypted cookie contains the opaque server credential, never the public session JSON. */
export function createProductAuth(clientId: string, appEnv: string) {
  const shared = sessionCallbacks("consumer", "product");
  return NextAuth({
    pages: { signIn: "/auth/start", error: "/auth/recover" },
    secret: authSecret(clientId),
    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
    cookies: {
      sessionToken: {
        name: `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-${clientId}-session`,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
    providers: [
      Credentials({
        id: "blynta",
        credentials: { code: {}, state: {} },
        async authorize(credentials) {
          try {
            const transaction = await readTransaction(
              clientId,
              credentials.state,
            );
            if (
              transaction.redirectUri !==
                new URL("/auth/callback", configuredUrl(appEnv)).href ||
              typeof credentials.code !== "string"
            )
              return null;
            const result = await callIdentity<BackendSession>("sso/token", {
              grant_type: "authorization_code",
              code: credentials.code,
              client_id: clientId,
              redirect_uri: transaction.redirectUri,
              code_verifier: transaction.verifier,
            });
            (await cookies()).set(cookieName(clientId, transaction.state), "", {
              ...options(),
              maxAge: 0,
            });
            return result;
          } catch {
            return null;
          }
        },
      }),
    ],
    ...shared,
    callbacks: {
      ...shared.callbacks,
      async redirect({ url, baseUrl }) {
        const destination = new URL(url, baseUrl);
        if (destination.origin !== new URL(baseUrl).origin) return baseUrl;
        // Accept sign-out requests from cached bundles without restoring the old page.
        if (destination.pathname === "/signed-out")
          return new URL("/auth/logged-out", baseUrl).href;
        return destination.href;
      },
    },
  });
}

/** Admin deliberately has no SSO or social provider and ignores consumer rollout flags. */
export function createAdminAuth() {
  return NextAuth({
    pages: { signIn: "/login", error: "/login" },
    secret: authSecret("blynta-admin"),
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    cookies: {
      sessionToken: {
        name: `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-admin-session`,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(credentials) {
          if (
            typeof credentials.email !== "string" ||
            typeof credentials.password !== "string"
          )
            return null;
          try {
            const result = await callIdentity<BackendSession>("admin/login", {
              email: credentials.email,
              password: credentials.password,
            });
            return result.role === "admin" && result.sessionKind === "admin"
              ? result
              : null;
          } catch {
            return null;
          }
        },
      }),
    ],
    ...sessionCallbacks("admin", "product"),
  });
}

export function sessionCallbacks(
  kind: "consumer" | "admin" = "consumer",
  logoutScope: "product" | "all" = "product",
): Pick<NextAuthConfig, "callbacks" | "events"> {
  return {
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const identity = user as Partial<BackendSession>;
          Object.assign(token, {
            id: identity.id,
            role: identity.role,
            sessionKind: identity.sessionKind || "consumer",
            sessionToken: identity.sessionToken,
            expiresAt: identity.expiresAt,
            accessToken: identity.accessToken,
            accessTokenExpires: identity.accessTokenExpires,
          });
        }
        if (
          typeof token.sessionToken !== "string" ||
          (typeof token.expiresAt === "number" && token.expiresAt <= Date.now())
        )
          return null;
        // Check revocation on every session read; token is also validated by the API guard.
        try {
          const fresh = await callIdentity<
            Omit<BackendSession, "sessionToken" | "expiresAt">
          >(kind === "admin" ? "admin/session" : "sso/session", {
            sessionToken: token.sessionToken,
          });
          if (
            kind === "admin" &&
            (fresh.role !== "admin" || fresh.sessionKind !== "admin")
          )
            return null;
          Object.assign(token, fresh);
          token.email = fresh.email;
          delete token.authError;
        } catch (error) {
          if (
            kind === "admin" ||
            (error instanceof IdentityRequestError && error.status === 401)
          )
            return null;
          // Keep the encrypted credential during outages, but never expose a stale API token.
          token.authError = "service_unavailable";
          delete token.accessToken;
        }
        return token;
      },
      async session({ session, token }) {
        session.authError = token.authError;
        session.user.id = String(token.id || "");
        session.user.role = String(token.role || "user");
        // Existing API clients require bearer tokens; only a five-minute token is exposed.
        session.accessToken =
          typeof token.accessToken === "string" ? token.accessToken : undefined;
        return session;
      },
    },
    events: {
      async signOut(message) {
        if (
          "token" in message &&
          typeof message.token?.sessionToken === "string"
        )
          await callIdentity(kind === "admin" ? "admin/logout" : "sso/logout", {
            sessionToken: message.token.sessionToken,
            scope: logoutScope,
          });
      },
    },
  };
}

export function finishAuthorization(
  clientId: string,
  signIn: (
    provider: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>,
) {
  return async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    let transaction: Transaction;
    try {
      transaction = await readTransaction(clientId, params.get("state"));
    } catch {
      console.warn("[blynta-auth] callback recovery", {
        client: clientId,
        reason: "transaction_missing_or_invalid",
      });
      return authorizationRecovery(request);
    }
    if (!params.get("code") || params.get("error"))
      return authorizationRecovery(request, transaction.returnTo);
    // Auth.js throws its own redirect; deliberately allow that to propagate.
    try {
      await signIn("blynta", {
        code: params.get("code"),
        state: params.get("state"),
        redirectTo: safeReturnTo(transaction.returnTo),
      });
    } catch (error) {
      if (error instanceof AuthError)
        return authorizationRecovery(request, transaction.returnTo);
      throw error; // Preserve the successful Auth.js NEXT_REDIRECT.
    }
    return new Response(null, { status: 204 });
  };
}

function authorizationRecovery(request: Request, returnTo = "/dashboard") {
  const url = new URL("/auth/recover", request.url);
  url.searchParams.set("returnTo", safeReturnTo(returnTo));
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function productSignInDestination() {
  const returnTo = safeReturnTo((await headers()).get("x-blynta-return-to"));
  const start =
    process.env.CENTRAL_AUTH_ENABLED === "true"
      ? "/auth/start?returnTo="
      : "/login?callbackUrl=";
  return start + encodeURIComponent(returnTo);
}

export async function authorizationReturnTo(clientId: string, state: unknown) {
  try {
    return safeReturnTo((await readTransaction(clientId, state)).returnTo);
  } catch {
    return "/dashboard";
  }
}
