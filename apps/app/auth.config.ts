/**
 * auth.config.ts — Edge-compatible NextAuth configuration.
 *
 * This file contains only the parts of the Auth.js config that must run on
 * the Edge runtime (e.g. middleware). It intentionally does NOT import Node.js
 * modules (like `crypto` or any database adapter).
 *
 * Full providers (with their `authorize` logic) are added in auth.ts.
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  /**
   * Redirect unauthenticated users to /login.
   * The actual provider list is merged in auth.ts.
   */
  pages: {
    signIn: "/login",
    error: "/login", // Auth errors redirect back to login with ?error= param
  },

  providers: [],

  callbacks: {
    /**
     * Controls whether a request is allowed to access a protected route.
     * Used by middleware (middleware.ts) — must be Edge-safe.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/signup") ||
        nextUrl.pathname.startsWith("/forgot-password");

      // Let auth pages through unconditionally (logged-in users will be
      // redirected away by the login page itself if needed).
      if (isAuthPage) return true;

      // All other routes require authentication.
      return isLoggedIn;
    },
  },
};
