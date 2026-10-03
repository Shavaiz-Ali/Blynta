/**
 * AuthProvider — wraps the app with Auth.js's SessionProvider so that
 * any client component can call `useSession()` to read the current session.
 *
 * Must be a "use client" component because SessionProvider uses React context.
 */

"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
