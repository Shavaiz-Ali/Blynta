/**
 * middleware.ts — Next.js App Router middleware.
 *
 * Checks for the presence of NextAuth's session cookie directly, instead of
 * creating a second NextAuth() instance on the Edge runtime. This avoids a
 * whole class of bugs where the Edge-runtime NextAuth instance (previously
 * created via `NextAuth(authConfig)` here) lacked `secret`/`trustHost` and
 * silently fell back to bad defaults (e.g. localhost:3000 in callbackUrl).
 *
 * This is a coarse-grained check — it only confirms a session cookie exists,
 * it does not verify the JWT signature. That's fine for route gating: actual
 * authorization/session validity is still enforced server-side wherever the
 * real session is read (route handlers, server components via `auth()`).
 */

import { NextResponse, type NextRequest } from "next/server";

// NextAuth v5 (Auth.js) cookie names differ based on whether the request is
// secure (HTTPS) or not. Check both so this works in local dev (http) and
// production (https) without extra config.
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token", // v5 default, secure/HTTPS
  "authjs.session-token", // v5 default, non-secure/HTTP (local dev)
  "__Secure-next-auth.session-token", // v4-style fallback, in case of legacy cookies
  "next-auth.session-token", // v4-style fallback, non-secure
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => !!request.cookies.get(name));
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const isLoggedIn = hasSessionCookie(request);

  const isAuthPage =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/signup") ||
    nextUrl.pathname.startsWith("/forgot-password");

  // Let auth pages through unconditionally (logged-in users will be
  // redirected away by the login page itself if needed).
  if (isAuthPage) {
    return NextResponse.next();
  }

  // All other routes require a session cookie to be present.
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth          (NextAuth's own REST endpoints / OAuth callbacks)
     * - _next/static      (static assets)
     * - _next/image       (image optimization files)
     * - favicon.ico, etc  (static root files)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};