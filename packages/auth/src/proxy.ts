import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { authSecret } from "./backend";

/** Cookie checks only. Revocation and refresh run in layouts/route functions. */
export function productProxy(clientId: string) {
  return async function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;
    // Old bundles/bookmarks must not render a removed page or restart consumer SSO.
    if (
      path === "/signed-out" &&
      ["blynta-main", "blynta-studio"].includes(clientId)
    )
      return NextResponse.redirect(new URL("/auth/logged-out", request.url));
    if (
      [
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/auth/",
        "/share/",
      ].some((prefix) => path.startsWith(prefix))
    ) {
      return NextResponse.next();
    }
    const admin = clientId === "blynta-admin";
    const central = admin || process.env.CENTRAL_AUTH_ENABLED === "true";
    const secure = central
      ? process.env.NODE_ENV === "production"
      : request.nextUrl.protocol === "https:";
    const cookieName = central
      ? `${secure ? "__Host-" : ""}${admin ? "blynta-admin" : `blynta-${clientId}`}-session`
      : clientId === "blynta-studio" && process.env.AUTH_COOKIE_DOMAIN
        ? process.env.AUTH_COOKIE_NAME || "__Secure-authjs.session-token"
        : `${secure ? "__Secure-" : ""}authjs.session-token`;
    const token = await getToken({
      req: request,
      secret: authSecret(clientId),
      cookieName,
      salt: cookieName,
    }).catch(() => null);
    if (
      !token ||
      (admin && (token.role !== "admin" || token.sessionKind !== "admin")) ||
      (central &&
        (typeof token.sessionToken !== "string" ||
          typeof token.expiresAt !== "number" ||
          token.expiresAt <= Date.now()))
    ) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", path + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  };
}
