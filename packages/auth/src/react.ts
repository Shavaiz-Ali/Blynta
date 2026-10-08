"use client";

// Providers and consumers must resolve the same Auth.js context, even when pnpm
// installs separate peer dependency variants for each Next.js application.
export {
  SessionProvider,
  SessionContext,
  useSession,
  signIn,
  signOut,
} from "next-auth/react";
export { readProductSession } from "./session-read";
