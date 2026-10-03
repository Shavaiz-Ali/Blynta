import { authSecret, backendUrl } from "@blynta/auth/backend";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

interface BackendUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  accessToken: string;
}

type BackendResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

async function callBackend<T>(
  path: string,
  body: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${backendUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-blynta-auth-bridge": process.env.SSO_BRIDGE_SECRET || "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json: BackendResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error.message ?? "Authentication failed");
  }

  return json.data;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: authSecret("blynta-admin"),
  providers: [
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

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
            role: user.role,
            accessToken: user.accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session as { accessToken?: string }).accessToken =
          typeof token.accessToken === "string" ? token.accessToken : undefined;
      }
      return session;
    },
  },
});
