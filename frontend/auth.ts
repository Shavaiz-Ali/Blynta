/**
 * auth.ts — Main Auth.js (next-auth v5) configuration.
 *
 * Runs in the Node.js runtime only (not Edge). Contains:
 *  - CredentialsProvider  → calls NestJS POST /auth/login
 *  - GoogleProvider       → OAuth; calls NestJS POST /auth/google in signIn callback
 *  - FacebookProvider     → OAuth; calls NestJS POST /auth/facebook in signIn callback
 *  - jwt()  callback      → persists id + role onto the token
 *  - session() callback   → exposes id + role on the client-side session
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { authConfig } from "./auth.config";

// ---------------------------------------------------------------------------
// Backend API helper
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error(
    "NEXT_PUBLIC_BACKEND_URL is not set. Add it to .env.local (e.g. http://localhost:5001)"
  );
}

/** Shape returned by the NestJS backend inside the `data` envelope. */
interface BackendUser {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}

/** Standard NestJS API response envelope. */
type BackendResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

/**
 * Call the NestJS backend and unwrap the envelope.
 * Returns the `data` payload on success, or throws an Error with the
 * backend's message on failure — so callers can catch and handle gracefully.
 */
async function callBackend<T>(
  path: string,
  body: Record<string, string>
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // next-auth runs in a server context; disable Next.js caching here.
    cache: "no-store",
  });

  const json: BackendResponse<T> = await res.json();

  if (!json.success) {
    // Use the backend's message so we have useful logs, but callers should
    // not surface the raw message directly to the browser.
    throw new Error(json.error.message ?? "Authentication failed");
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days — aligned with backend JWT expiresIn ('7d')

  providers: [
    // ------------------------------------------------------------------
    // 1. Credentials (email + password) — calls NestJS POST /auth/login
    // ------------------------------------------------------------------
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        try {
          const user = await callBackend<BackendUser>("/auth/login", {
            email,
            password,
          });

          // Return the user object; Auth.js embeds this in the JWT via jwt().
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            accessToken: user.accessToken,
          };
        } catch {
          // Returning null signals "invalid credentials" to Auth.js.
          // Auth.js will redirect to /login?error=CredentialsSignin.
          return null;
        }
      },
    }),

    // ------------------------------------------------------------------
    // 2. Google OAuth
    // ------------------------------------------------------------------
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ------------------------------------------------------------------
    // 3. Facebook OAuth
    // ------------------------------------------------------------------
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ------------------------------------------------------------------
    // signIn() — intercept successful OAuth logins before the session is
    // created and call the NestJS backend to register/link the social user.
    // The backend's { id, email, role } is stored on `token.backendUser`
    // (via a shared object on `user`) for the jwt() callback to pick up.
    // ------------------------------------------------------------------
    async signIn({ user, account, profile }) {
      // Credentials provider: authorize() already validated → allow.
      if (!account || account.provider === "credentials") return true;

      try {
        if (account.provider === "google") {
          const backendUser = await callBackend<BackendUser>("/auth/google", {
            providerId: profile?.sub ?? account.providerAccountId,
            email: profile?.email ?? user.email ?? "",
            name: profile?.name ?? user.name ?? "",
            avatarUrl: (profile as { picture?: string })?.picture ?? user.image ?? "",
          });
          // Stash on user so jwt() can read it at trigger="signIn"
          user.id = backendUser.id;
          user.email = backendUser.email;
          (user as { role?: string }).role = backendUser.role;
          (user as { accessToken?: string }).accessToken = backendUser.accessToken;
          return true;
        }

        if (account.provider === "facebook") {
          const backendUser = await callBackend<BackendUser>("/auth/facebook", {
            providerId: account.providerAccountId,
            email: user.email ?? "",
            name: user.name ?? "",
            avatarUrl: user.image ?? "",
          });
          user.id = backendUser.id;
          user.email = backendUser.email;
          (user as { role?: string }).role = backendUser.role;
          (user as { accessToken?: string }).accessToken = backendUser.accessToken;
          return true;
        }

        // Unknown provider — deny by default.
        return false;
      } catch (err) {
        console.error(`[auth] signIn callback error for ${account.provider}:`, err);
        // Return false to show auth error page; does NOT crash the server.
        return false;
      }
    },

    // ------------------------------------------------------------------
    // jwt() — called every time a JWT is created or updated.
    //   trigger="signIn" : first login — `user` is populated.
    //   trigger="update" : subsequent requests — only `token` is available.
    // ------------------------------------------------------------------
    async jwt({ token, user }) {
      // On first sign-in, `user` is the object returned by authorize()
      // (Credentials) or mutated in signIn() (OAuth).
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
        const at = (user as { accessToken?: string }).accessToken;
        if (at) token.accessToken = at;
      }
      return token;
    },

    // ------------------------------------------------------------------
    // session() — shapes the client-visible session object.
    // Only what you explicitly return here is accessible via useSession().
    // ------------------------------------------------------------------
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      const at = token.accessToken as string | undefined;
      if (at) {
        (session as { accessToken?: string }).accessToken = at;
      }
      return session;
    },
  },
});
