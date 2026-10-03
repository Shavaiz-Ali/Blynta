import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth, identityCookieName } from "@/auth";
import { callIdentity, IdentityRequestError } from "@blynta/auth/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parameters = Object.fromEntries(url.searchParams);
  try {
    await callIdentity("sso/validate-request", parameters);
  } catch (error) {
    return new Response("Invalid authorization request", {
      status:
        error instanceof IdentityRequestError &&
        ["backend_unavailable", "backend_configuration"].includes(error.code)
          ? 503
          : 400,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  // Keep the authorization request in a host-only HttpOnly cookie across signup and provider callbacks.
  // Backend validation happens before any product redirect; invalid requests never redirect to the supplied URI.
  const session = await auth();
  if (!session?.user) {
    const login = new URL(
      parameters.screen === "signup" ? "/signup" : "/login",
      url,
    );
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
    response.cookies.set(
      `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-authorization`,
      JSON.stringify(pending),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET!,
    cookieName: identityCookieName,
    salt: identityCookieName,
  });
  if (typeof token?.sessionToken !== "string")
    return new Response("Sign-in required", { status: 401 });
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
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return new Response(
      "Invalid or expired authorization request. Return to the product and start sign-in again.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
}
