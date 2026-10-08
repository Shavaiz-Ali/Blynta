import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { pendingName, pendingOptions, recovery } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret } from "@blynta/auth/backend";
import { auth, identityCookieName } from "@/auth";
import { callIdentity, IdentityRequestError } from "@blynta/auth/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parameters = Object.fromEntries(url.searchParams);
  try {
    await callIdentity("sso/validate-request", parameters);
  } catch (error) {
    return recovery(
      request,
      parameters.client_id,
      error instanceof IdentityRequestError ? error.code : "invalid_request",
      parameters.state,
    );
  }
  // Keep the authorization request in a host-only HttpOnly cookie across signup and provider callbacks.
  // Backend validation happens before any product redirect; invalid requests never redirect to the supplied URI.
  const session = await auth();
  if (session?.authError)
    return recovery(
      request,
      parameters.client_id,
      "backend_unavailable",
      parameters.state,
    );
  if (!session?.user) {
    const login = new URL(
      parameters.screen === "signup" ? "/signup" : "/login",
      url,
    );
    login.searchParams.set("transaction", parameters.state);
    login.searchParams.set("client", parameters.client_id);
    if (parameters.ref)
      login.searchParams.set("ref", parameters.ref.slice(0, 128));
    const pending = {
      client_id: parameters.client_id,
      redirect_uri: parameters.redirect_uri,
      response_type: parameters.response_type,
      state: parameters.state,
      code_challenge: parameters.code_challenge,
      code_challenge_method: parameters.code_challenge_method,
    };
    const response = NextResponse.redirect(login);
    const existing = (await cookies())
      .getAll()
      .filter((cookie) => cookie.name.startsWith(pendingName() + "-"));
    for (const cookie of existing.slice(0, Math.max(0, existing.length - 3)))
      response.cookies.set(cookie.name, "", { ...pendingOptions, maxAge: 0 });
    response.cookies.set(
      `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-authorization`,
      JSON.stringify({ state: parameters.state }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      },
    );
    response.cookies.set(
      pendingName(parameters.state),
      await encode({
        token: pending,
        secret: authSecret("blynta-identity")!,
        salt: pendingName(parameters.state),
        maxAge: 600,
      }),
      pendingOptions,
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const token = await getToken({
    req: request,
    secret: authSecret("blynta-identity"),
    cookieName: identityCookieName,
    salt: identityCookieName,
  }).catch(() => null);
  if (typeof token?.sessionToken !== "string")
    return recovery(
      request,
      parameters.client_id,
      "identity_missing",
      parameters.state,
    );
  try {
    const result = await callIdentity<{
      code: string;
      state: string;
      redirect_uri: string;
    }>("sso/authorize", { ...parameters, sessionToken: token.sessionToken });
    const destination = new URL(result.redirect_uri);
    destination.search = new URLSearchParams({
      code: result.code,
      state: result.state,
    }).toString();
    const response = NextResponse.redirect(destination);
    response.cookies.set(
      `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-authorization`,
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      },
    );
    response.cookies.set(pendingName(parameters.state), "", {
      ...pendingOptions,
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return recovery(
      request,
      parameters.client_id,
      "authorization_failed",
      parameters.state,
    );
  }
}
