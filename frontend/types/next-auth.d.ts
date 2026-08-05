/**
 * Module augmentation for Auth.js (next-auth v5).
 * Adds `id` and `role` to the Session and JWT types so that
 * TypeScript understands the custom fields we persist on the token
 * and expose on the client-side session object.
 */

import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  // Returned by `authorize()` in CredentialsProvider and used
  // as the `user` param in the `jwt()` callback on first sign-in.
  interface User extends DefaultUser {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    /** Holds OAuth backend user data between signIn() and jwt() callbacks */
    backendUser?: { id: string; email: string; role: string };
  }
}
