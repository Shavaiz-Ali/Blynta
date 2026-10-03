import "./types";
import { callIdentity } from "./identity-client";
import { authSecret } from "./backend";
export { callIdentity, IdentityRequestError } from "./identity-client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode, decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function safeReturnTo(
  candidate: unknown,
  fallback = "/dashboard",
): string {
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(candidate)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded))
      return fallback;
  } catch {
    return fallback;
  }
  const url = new URL(candidate, "https://application.invalid");
  return url.origin === "https://application.invalid"
    ? url.pathname + url.search + url.hash
    : fallback;
}

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
const cookieName = (clientId: string) =>
  `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-${clientId}-transaction`;
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
    const params = new URL(request.url).searchParams;
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const transaction: Transaction = {
      state,
      verifier,
      returnTo: safeReturnTo(
        params.get("returnTo") || params.get("callbackUrl"),
        fallback,
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
    response.cookies.set(
      cookieName(clientId),
      await encode({
        token: { ...transaction },
        secret: transactionSecret(clientId),
        salt: cookieName(clientId),
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
  const raw = (await cookies()).get(cookieName(clientId))?.value;
  if (!raw || typeof state !== "string") throw new Error("Invalid transaction");
  const decoded = await decode({
    token: raw,
    secret: transactionSecret(clientId),
    salt: cookieName(clientId),
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
  return NextAuth({
    pages: { signIn: "/login", error: "/login" },
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
            (await cookies()).set(cookieName(clientId), "", {
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
    ...sessionCallbacks("consumer", "product"),
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
        if (typeof token.sessionToken !== "string") return null;
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
        } catch {
          return null;
        }
        return token;
      },
      async session({ session, token }) {
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
      return new Response(
        "Invalid or expired authentication request. Start sign-in again.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }
    if (!params.get("code") || params.get("error"))
      return new Response("Authentication failed. Start sign-in again.", {
        status: 400,
      });
    // Auth.js throws its own redirect; deliberately allow that to propagate.
    await signIn("blynta", {
      code: params.get("code"),
      state: params.get("state"),
      redirectTo: safeReturnTo(transaction.returnTo),
    });
    return new Response(null, { status: 204 });
  };
}
