/**
 * middleware.ts — Next.js App Router middleware.
 *
 * Wraps NextAuth v5's edge middleware handler via auth.config.ts.
 * CRITICAL: the `matcher` must explicitly exclude the NextAuth API
 * endpoints (/api/auth/*). If the middleware runs its `authorized()`
 * callback on those routes when a session cookie is absent, it will
 * redirect (or return the login page HTML) for JSON-only REST calls
 * like /api/auth/session — which then fails to parse as JSON with:
 *     "Unexpected token '<', '<!DOCTYPE' ... is not valid JSON"
 *
 * Excluding /api/auth/* from the matcher prevents this entire class of
 * bugs without any change to NextAuth's own route handling.
 */

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: proxy } = NextAuth(authConfig);

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
